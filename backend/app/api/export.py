"""
Export Conversion API Router
POST /export         → enqueue a conversion job, returns 202 + task_id
GET  /export/status  → poll job status by task_id
GET  /export/download → download converted file by task_id

Now supports BOTH local conversion and Google Cloud Batch (with adaptive sampling).
Set USE_BATCH=True in environment to use batch processing.
"""
import os
import uuid
import asyncio
import tempfile
import shutil
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, Dict
from enum import Enum

from fastapi import APIRouter, HTTPException, BackgroundTasks, UploadFile, File, Form
from fastapi.responses import FileResponse
from pydantic import BaseModel

router = APIRouter(tags=["export"])

USE_BATCH = os.environ.get("USE_BATCH", "false").lower() == "true"

if USE_BATCH:
    from app.api.batch_service import run_batch_export, is_vector_input

# ─── In-memory task store ────────────────────────────────────────────────────
_export_tasks: Dict[str, dict] = {}

EXPORT_DIR = Path(tempfile.gettempdir()) / "griidai_exports"
EXPORT_DIR.mkdir(exist_ok=True)

MAX_EXPORT_SIZE_MB = int(os.environ.get("MAX_EXPORT_SIZE_MB", "500"))


# ─── Enums & Models ─────────────────────────────────────────────────────────
class ExportFormat(str, Enum):
    # Vector formats (from GeoParquet / GeoJSON source)
    GEOJSON = "geojson"
    SHAPEFILE = "shapefile"
    KML = "kml"
    # Raster formats (from COG / GeoTIFF source)
    GEOTIFF = "geotiff"
    PNG = "png"
    JPEG = "jpeg"
    JPEG2000 = "jpeg2000"


class ExportStatus(str, Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    SUCCESS = "SUCCESS"
    FAILURE = "FAILURE"


class ExportRequest(BaseModel):
    file_id: str                     # entity/product ID or file path
    target_format: ExportFormat
    source_url: Optional[str] = None  # optional direct URL to source file
    provider: str = "local"          # "local", "usgs", "copernicus"
    target_crs: Optional[int] = None  # EPSG code for reprojection, None = keep original


class ExportStatusResponse(BaseModel):
    task_id: str
    status: ExportStatus
    progress: int = 0               # 0-100
    message: str = ""
    download_url: Optional[str] = None
    created_at: Optional[str] = None
    format: Optional[str] = None


class ExportAccepted(BaseModel):
    task_id: str
    status: str = "PENDING"
    message: str = "Export job queued"


# ─── Vector format classification ───────────────────────────────────────────
VECTOR_FORMATS = {ExportFormat.GEOJSON, ExportFormat.SHAPEFILE, ExportFormat.KML}
RASTER_FORMATS = {ExportFormat.GEOTIFF, ExportFormat.PNG, ExportFormat.JPEG, ExportFormat.JPEG2000}


# ─── Background conversion worker ───────────────────────────────────────────
async def _run_export_task(task_id: str, req: ExportRequest):
    """Run the conversion in the background. Updates the in-memory task store."""
    task = _export_tasks[task_id]
    task["status"] = ExportStatus.PROCESSING
    task["progress"] = 10

    try:
        if USE_BATCH:
            output_gcs_url = await _run_batch_export(task_id, req)
            task["status"] = ExportStatus.SUCCESS
            task["progress"] = 100
            task["output_path"] = output_gcs_url
            task["download_url"] = output_gcs_url
            task["message"] = "Batch conversion complete"
            return

        output_path: Optional[str] = None

        if req.target_format in VECTOR_FORMATS:
            output_path = await _convert_vector(task_id, req)
        elif req.target_format in RASTER_FORMATS:
            output_path = await _convert_raster(task_id, req)
        else:
            raise ValueError(f"Unsupported format: {req.target_format}")

        if output_path and os.path.exists(output_path):
            task["status"] = ExportStatus.SUCCESS
            task["progress"] = 100
            task["output_path"] = output_path
            task["download_url"] = f"/api/export/download?task_id={task_id}"
            task["message"] = "Conversion complete"
        else:
            raise FileNotFoundError("Conversion produced no output file")

    except Exception as e:
        task["status"] = ExportStatus.FAILURE
        task["progress"] = 0
        task["message"] = f"Export failed: {str(e)}"
        print(f"ERROR: Export task {task_id} failed: {e}", flush=True)


async def _run_batch_export(task_id: str, req: ExportRequest) -> str:
    """Run conversion via Google Cloud Batch with adaptive sampling."""
    task = _export_tasks[task_id]
    task["progress"] = 20
    task["message"] = "Preparing batch export..."

    source = req.source_url or req.file_id
    fmt = req.target_format.value
    region = "us-east1"

    bucket_name, blob_path = _parse_gcs_uri(source)
    stem = blob_path.rsplit(".", 1)[0] if "." in blob_path else blob_path

    ext_map = {
        "geojson": ".geojson", "shapefile": ".zip", "kml": ".kml",
        "geotiff": ".tif", "png": ".zip", "jpeg": ".jpg", "jpeg2000": ".jp2",
    }
    gcs_output = f"gs://{bucket_name}/exports/{stem}_export{ext_map.get(fmt, '.bin')}"
    gcs_output_base = f"gs://{bucket_name}/exports/{stem}_meta"

    def progress_callback(msg: str):
        task["message"] = msg
        if "Sample job" in msg:
            task["progress"] = 30
        elif "RAM needed" in msg:
            task["progress"] = 50
        elif "Selected machine" in msg:
            task["progress"] = 60
        elif "Full job submitted" in msg:
            task["progress"] = 70
        elif "Conversion complete" in msg:
            task["progress"] = 95

    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        None,
        lambda: run_batch_export(source, fmt, gcs_output, gcs_output_base, region, progress_callback)
    )
    return result


def _parse_gcs_uri(uri: str):
    stripped = uri.replace("gs://", "")
    bucket = stripped.split("/")[0]
    blob = "/".join(stripped.split("/")[1:])
    return bucket, blob


# ─── Vector converters ──────────────────────────────────────────────────────
async def _convert_vector(task_id: str, req: ExportRequest) -> str:
    """Convert a vector source (GeoParquet, GeoJSON, etc.) to the target format."""
    task = _export_tasks[task_id]
    task["progress"] = 20

    # Import GDAL/OGR via geopandas + fiona (lazy import to avoid hard dep)
    try:
        import geopandas as gpd
    except ImportError:
        raise RuntimeError(
            "geopandas is not installed. Install with: pip install geopandas pyarrow fiona"
        )

    task["progress"] = 30
    task["message"] = "Reading source data..."

    # Determine source path/URL
    source = req.source_url or req.file_id

    # Read the source file
    loop = asyncio.get_event_loop()
    gdf = await loop.run_in_executor(None, lambda: gpd.read_file(source))

    task["progress"] = 60
    task["message"] = "Converting..."

    # Reproject if target_crs is specified
    if req.target_crs:
        task["message"] = f"Reprojecting to EPSG:{req.target_crs}..."
        gdf = gdf.to_crs(epsg=req.target_crs)
        task["progress"] = 70

    # Prepare output
    task_dir = EXPORT_DIR / task_id
    task_dir.mkdir(exist_ok=True)

    if req.target_format == ExportFormat.GEOJSON:
        out_path = str(task_dir / "export.geojson")
        await loop.run_in_executor(None, lambda: gdf.to_file(out_path, driver="GeoJSON"))

    elif req.target_format == ExportFormat.SHAPEFILE:
        out_path = str(task_dir / "export.shp")
        # Truncate column names to 10 chars for shapefile compatibility
        rename_map = {}
        used_names = set()
        for col in gdf.columns:
            if col == "geometry":
                continue
            short = col[:10]
            counter = 1
            while short in used_names:
                suffix = str(counter)
                short = col[:10 - len(suffix)] + suffix
                counter += 1
            used_names.add(short)
            if short != col:
                rename_map[col] = short
        if rename_map:
            gdf = gdf.rename(columns=rename_map)
        await loop.run_in_executor(None, lambda: gdf.to_file(out_path, driver="ESRI Shapefile"))
        # Zip up the shapefile components
        zip_path = str(task_dir / "export_shapefile")
        shutil.make_archive(zip_path, "zip", str(task_dir))
        out_path = zip_path + ".zip"

    elif req.target_format == ExportFormat.KML:
        out_path = str(task_dir / "export.kml")
        # KML requires WGS84
        if gdf.crs and gdf.crs.to_epsg() != 4326:
            task["message"] = "Reprojecting to WGS84 for KML..."
            gdf = gdf.to_crs(epsg=4326)
        await loop.run_in_executor(
            None, lambda: gdf.to_file(out_path, driver="KML")
        )
    else:
        raise ValueError(f"Unsupported vector format: {req.target_format}")

    task["progress"] = 90
    return out_path


# ─── Raster converters ──────────────────────────────────────────────────────
async def _convert_raster(task_id: str, req: ExportRequest) -> str:
    """Convert a raster source (COG, GeoTIFF) to the target format."""
    task = _export_tasks[task_id]
    task["progress"] = 20

    try:
        import rasterio
        from rasterio.enums import Compression
        import numpy as np
    except ImportError:
        raise RuntimeError(
            "rasterio is not installed. Install with: pip install rasterio numpy"
        )

    task["progress"] = 30
    task["message"] = "Reading source raster..."

    source = req.source_url or req.file_id
    loop = asyncio.get_event_loop()

    task_dir = EXPORT_DIR / task_id
    task_dir.mkdir(exist_ok=True)

    if req.target_format == ExportFormat.GEOTIFF:
        out_path = str(task_dir / "export.tif")

        def _convert_geotiff():
            with rasterio.open(source) as src:
                profile = src.profile.copy()
                profile.update(
                    driver="GTiff",
                    compress="lzw",
                    tiled=True,
                    blockxsize=256,
                    blockysize=256,
                )

                # Reproject if target_crs is specified
                if req.target_crs:
                    from rasterio.warp import calculate_default_transform, reproject, Resampling
                    from rasterio.crs import CRS as RioCRS
                    dst_crs = RioCRS.from_epsg(req.target_crs)
                    transform, width, height = calculate_default_transform(
                        src.crs, dst_crs, src.width, src.height, *src.bounds
                    )
                    profile.update(
                        crs=dst_crs,
                        transform=transform,
                        width=width,
                        height=height,
                    )
                    with rasterio.open(out_path, "w", **profile) as dst:
                        for i in range(1, src.count + 1):
                            reproject(
                                source=rasterio.band(src, i),
                                destination=rasterio.band(dst, i),
                                src_transform=src.transform,
                                src_crs=src.crs,
                                dst_transform=transform,
                                dst_crs=dst_crs,
                                resampling=Resampling.bilinear,
                            )
                else:
                    with rasterio.open(out_path, "w", **profile) as dst:
                        for _, window in src.block_windows(1):
                            data = src.read(window=window)
                            dst.write(data, window=window)

        await loop.run_in_executor(None, _convert_geotiff)

    elif req.target_format == ExportFormat.PNG:
        out_path = str(task_dir / "export.png")
        pgw_path = str(task_dir / "export.pgw")

        def _convert_png():
            with rasterio.open(source) as src:
                # Reproject first if needed
                if req.target_crs:
                    from rasterio.warp import calculate_default_transform, reproject, Resampling
                    from rasterio.crs import CRS as RioCRS
                    import tempfile as _tmpmod
                    dst_crs = RioCRS.from_epsg(req.target_crs)
                    transform, width, height = calculate_default_transform(
                        src.crs, dst_crs, src.width, src.height, *src.bounds
                    )
                    reproj_path = str(task_dir / "reproj_temp.tif")
                    reproj_profile = src.profile.copy()
                    reproj_profile.update(crs=dst_crs, transform=transform, width=width, height=height)
                    with rasterio.open(reproj_path, "w", **reproj_profile) as rdst:
                        for i in range(1, src.count + 1):
                            reproject(
                                source=rasterio.band(src, i),
                                destination=rasterio.band(rdst, i),
                                src_transform=src.transform,
                                src_crs=src.crs,
                                dst_transform=transform,
                                dst_crs=dst_crs,
                                resampling=Resampling.bilinear,
                            )
                    src_for_png = rasterio.open(reproj_path)
                else:
                    src_for_png = src

                # Read up to 3 bands for RGB or 1 band for grayscale
                band_count = min(src_for_png.count, 3)
                data = src_for_png.read(list(range(1, band_count + 1)))

                # Normalize to 0-255
                for i in range(data.shape[0]):
                    band = data[i].astype(float)
                    nodata = src.nodata
                    if nodata is not None:
                        valid = band[band != nodata]
                    else:
                        valid = band.flatten()
                    if len(valid) > 0:
                        vmin, vmax = np.percentile(valid, [2, 98])
                        if vmax > vmin:
                            band = np.clip((band - vmin) / (vmax - vmin) * 255, 0, 255)
                        else:
                            band = np.zeros_like(band)
                    data[i] = band.astype(np.uint8)

                profile = {
                    "driver": "PNG",
                    "dtype": "uint8",
                    "width": src.width,
                    "height": src.height,
                    "count": band_count,
                }
                with rasterio.open(out_path, "w", **profile) as dst:
                    dst.write(data)

                # Write world file (.pgw)
                write_transform = src_for_png.transform
                with open(pgw_path, "w") as wf:
                    wf.write(f"{write_transform.a}\n")   # pixel size X
                    wf.write(f"{write_transform.d}\n")   # rotation row
                    wf.write(f"{write_transform.b}\n")   # rotation col
                    wf.write(f"{write_transform.e}\n")   # pixel size Y (negative)
                    wf.write(f"{write_transform.c}\n")   # upper-left X
                    wf.write(f"{write_transform.f}\n")   # upper-left Y

                if req.target_crs and src_for_png is not src:
                    src_for_png.close()

        await loop.run_in_executor(None, _convert_png)

    elif req.target_format == ExportFormat.JPEG:
        out_path = str(task_dir / "export.jpg")

        def _convert_jpeg():
            with rasterio.open(source) as src:
                if src.count < 1:
                    raise ValueError("Source raster has no bands, cannot convert to JPEG")

                # Reproject first if needed
                if req.target_crs:
                    from rasterio.warp import calculate_default_transform, reproject, Resampling
                    from rasterio.crs import CRS as RioCRS
                    dst_crs = RioCRS.from_epsg(req.target_crs)
                    transform, width, height = calculate_default_transform(
                        src.crs, dst_crs, src.width, src.height, *src.bounds
                    )
                    reproj_path = str(task_dir / "reproj_temp.tif")
                    reproj_profile = src.profile.copy()
                    reproj_profile.update(crs=dst_crs, transform=transform, width=width, height=height)
                    with rasterio.open(reproj_path, "w", **reproj_profile) as rdst:
                        for i in range(1, src.count + 1):
                            reproject(
                                source=rasterio.band(src, i),
                                destination=rasterio.band(rdst, i),
                                src_transform=src.transform,
                                src_crs=src.crs,
                                dst_transform=transform,
                                dst_crs=dst_crs,
                                resampling=Resampling.bilinear,
                            )
                    src_for_jpeg = rasterio.open(reproj_path)
                else:
                    src_for_jpeg = src

                # JPEG must be exactly 3 bands (RGB)
                if src_for_jpeg.count >= 3:
                    data = src_for_jpeg.read([1, 2, 3])
                else:
                    # Grayscale → replicate across 3 bands
                    band = src_for_jpeg.read(1)
                    data = np.stack([band, band, band])

                # Normalize to 0-255, strip nodata
                for i in range(3):
                    band = data[i].astype(float)
                    nodata = src.nodata
                    if nodata is not None:
                        band[band == nodata] = 0
                        valid = band[band != 0]
                    else:
                        valid = band.flatten()
                    if len(valid) > 0:
                        vmin, vmax = np.percentile(valid, [2, 98])
                        if vmax > vmin:
                            band = np.clip((band - vmin) / (vmax - vmin) * 255, 0, 255)
                        else:
                            band = np.zeros_like(band)
                    data[i] = band.astype(np.uint8)

                profile = {
                    "driver": "JPEG",
                    "dtype": "uint8",
                    "width": src.width,
                    "height": src.height,
                    "count": 3,
                    "quality": 85,
                }
                with rasterio.open(out_path, "w", **profile) as dst:
                    dst.write(data)

                if req.target_crs and src_for_jpeg is not src:
                    src_for_jpeg.close()

        await loop.run_in_executor(None, _convert_jpeg)
    else:
        raise ValueError(f"Unsupported raster format: {req.target_format}")

    task["progress"] = 90
    return out_path


# ═════════════════════════════════════════════════════════════════════════════
#  API Endpoints
# ═════════════════════════════════════════════════════════════════════════════

@router.post("/export", response_model=ExportAccepted, status_code=202)
async def create_export(req: ExportRequest, background_tasks: BackgroundTasks):
    """Enqueue an export conversion job. Returns 202 immediately."""

    # Validate format compatibility (basic check)
    if req.target_format in VECTOR_FORMATS and req.provider == "raster_only":
        raise HTTPException(
            status_code=400,
            detail="Cannot export raster-only source to a vector format"
        )

    task_id = str(uuid.uuid4())
    _export_tasks[task_id] = {
        "task_id": task_id,
        "status": ExportStatus.PENDING,
        "progress": 0,
        "message": "Queued for processing",
        "download_url": None,
        "output_path": None,
        "format": req.target_format.value,
        "created_at": datetime.utcnow().isoformat(),
    }

    # Run conversion in the background
    background_tasks.add_task(_run_export_task, task_id, req)

    return ExportAccepted(task_id=task_id)


@router.post("/export/upload", response_model=ExportAccepted, status_code=202)
async def upload_and_export(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    target_format: ExportFormat = Form(...)
):
    """Upload a file directly and enqueue an export conversion job."""
    task_id = str(uuid.uuid4())
    
    # Save uploaded file to temp directory
    upload_dir = EXPORT_DIR / "uploads"
    upload_dir.mkdir(exist_ok=True)
    
    file_path = upload_dir / f"{task_id}_{file.filename}"
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Validate format compatibility (basic check)
    ext = os.path.splitext(file.filename)[1].lower()
    is_raster = ext in [".tif", ".tiff", ".png", ".jpg", ".jpeg"]
    if target_format in VECTOR_FORMATS and is_raster:
        raise HTTPException(
            status_code=400,
            detail="Cannot export raster image to a vector format"
        )

    _export_tasks[task_id] = {
        "task_id": task_id,
        "status": ExportStatus.PENDING,
        "progress": 0,
        "message": "Queued for processing",
        "download_url": None,
        "output_path": None,
        "format": target_format.value,
        "created_at": datetime.utcnow().isoformat(),
    }

    req = ExportRequest(
        file_id=str(file_path),
        target_format=target_format,
        provider="local_upload"
    )

    # Run conversion in the background
    background_tasks.add_task(_run_export_task, task_id, req)

    return ExportAccepted(task_id=task_id)


@router.get("/export/status", response_model=ExportStatusResponse)
async def get_export_status(task_id: str):
    """Poll the status of an export task."""
    task = _export_tasks.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")

    return ExportStatusResponse(
        task_id=task["task_id"],
        status=task["status"],
        progress=task["progress"],
        message=task["message"],
        download_url=task.get("download_url"),
        created_at=task.get("created_at"),
        format=task.get("format"),
    )


@router.get("/export/download")
async def download_export(task_id: str):
    """Download the converted file once the task is complete."""
    task = _export_tasks.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")

    if task["status"] != ExportStatus.SUCCESS:
        raise HTTPException(
            status_code=400,
            detail=f"Task is not ready. Current status: {task['status']}"
        )

    output_path = task.get("output_path")
    if not output_path or not os.path.exists(output_path):
        raise HTTPException(status_code=404, detail="Output file not found")

    filename = os.path.basename(output_path)
    # Determine media type
    media_types = {
        ".geojson": "application/geo+json",
        ".shp": "application/x-shapefile",
        ".zip": "application/zip",
        ".kml": "application/vnd.google-earth.kml+xml",
        ".tif": "image/tiff",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".jp2": "image/jp2",
    }
    ext = os.path.splitext(filename)[1].lower()
    media_type = media_types.get(ext, "application/octet-stream")

    return FileResponse(
        path=output_path,
        filename=filename,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/export/formats")
async def list_formats():
    """Return the available export formats grouped by type."""
    return {
        "vector": [
            {"id": "geojson", "name": "GeoJSON", "extension": ".geojson",
             "description": "Lightweight, web-friendly vector format"},
            {"id": "shapefile", "name": "ESRI Shapefile", "extension": ".shp.zip",
             "description": "Industry-standard GIS vector format (zipped)"},
            {"id": "kml", "name": "KML", "extension": ".kml",
             "description": "Google Earth compatible format"},
        ],
        "raster": [
            {"id": "geotiff", "name": "GeoTIFF", "extension": ".tif",
             "description": "Georeferenced raster with LZW compression"},
            {"id": "png", "name": "PNG + World File", "extension": ".png",
             "description": "Portable image with georeference sidecar"},
            {"id": "jpeg", "name": "JPEG", "extension": ".jpg",
             "description": "Compressed image (3-band RGB, no alpha)"},
            {"id": "jpeg2000", "name": "JPEG 2000", "extension": ".jp2",
             "description": "High-fidelity compression (Supports Float32)"},
        ],
    }
