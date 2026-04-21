"""
GCS Bucket Files API Router
GET  /gcs/files           → list files in the target GCS bucket
GET  /gcs/download-url    → generate a signed download URL for a blob
POST /gcs/batch-export    → submit a Cloud Batch export job
GET  /gcs/batch-export/status → poll batch job status
GET  /gcs/batch-export/download → download the exported output file
"""
import os
import time
import datetime
from typing import Optional, List

from fastapi import APIRouter, HTTPException, Query, UploadFile, File, BackgroundTasks
from pydantic import BaseModel

from google.cloud import storage, batch_v1
from google.oauth2 import service_account

from app.api.batch_service import run_batch_export

router = APIRouter(tags=["gcs"])

# ─── Config ──────────────────────────────────────────────────────────────────
SA_FILE = os.path.join(
    os.path.dirname(__file__), "..", "..", "griidai-backend-sa.json"
)
PROJECT_ID = "assetrx-slr"
SA_EMAIL = "griidai-backend-sa@assetrx-slr.iam.gserviceaccount.com"
DEFAULT_BUCKET = "griidai-data"
DEFAULT_PREFIX = "sample/"

GDAL_IMAGE = "ghcr.io/osgeo/gdal:ubuntu-full-3.8.5"
BOOT_DISK_GB = 100
USE_SPOT = True

VECTOR_FORMATS = ["geojson", "shapefile", "kml", "geoparquet"]
RASTER_FORMATS = ["geotiff", "png", "jpeg", "jpeg2000"]

# In-memory store for batch jobs
_batch_jobs: dict = {}


# ─── Helpers ─────────────────────────────────────────────────────────────────
def _get_credentials():
    return service_account.Credentials.from_service_account_file(SA_FILE)


def _get_storage_client():
    creds = _get_credentials()
    return storage.Client(credentials=creds, project=PROJECT_ID)


def _classify_file(filename: str) -> str:
    """Classify a file as raster, vector, or unknown based on extension."""
    ext = os.path.splitext(filename)[1].lower()
    raster_exts = {".tif", ".tiff", ".png", ".jpg", ".jpeg", ".geotiff"}
    vector_exts = {".parquet", ".geojson", ".json", ".shp", ".kml", ".gpkg"}
    if ext in raster_exts:
        return "raster"
    elif ext in vector_exts:
        return "vector"
    return "unknown"


def _parse_gcs_uri(uri: str):
    stripped = uri.replace("gs://", "")
    bucket = stripped.split("/")[0]
    blob = "/".join(stripped.split("/")[1:])
    return bucket, blob


# ─── Pydantic Models ─────────────────────────────────────────────────────────
class GcsFileItem(BaseModel):
    name: str
    full_path: str
    gcs_uri: str
    size_bytes: int
    file_type: str  # raster | vector | unknown
    updated: Optional[str] = None


class GcsFilesResponse(BaseModel):
    bucket: str
    prefix: str
    files: List[GcsFileItem]


class BatchExportRequest(BaseModel):
    gcs_uri: str        # e.g. gs://griidai-data/sample/FL_Pinalles_Water.tif
    target_format: str  # geotiff | png | jpeg | geojson | shapefile | kml
    target_crs: Optional[int] = None  # EPSG code for reprojection, None = keep original


class BatchExportAccepted(BaseModel):
    job_id: str
    job_name: str
    gcs_output: str
    status: str = "SUBMITTED"
    message: str = "Batch export job submitted"


class BatchExportStatusResponse(BaseModel):
    job_id: str
    status: str
    gcs_output: str
    download_url: Optional[str] = None
    message: str = ""

# ─── Background Worker for Adaptive Batch ────────────────────────────────────
import asyncio

async def _run_adaptive_batch_task(job_id: str, gcs_uri: str, fmt: str, gcs_output: str, gcs_output_base: str, region: str):
    job_info = _batch_jobs[job_id]
    job_info["status"] = "RUNNING"
    job_info["message"] = "Starting adaptive batch export..."

    def progress_callback(msg: str):
        job_info["message"] = msg
        print(f"[Batch {job_id}] {msg}")

    try:
        loop = asyncio.get_event_loop()
        # run_batch_export is synchronous (blocking) because it polls internally
        await loop.run_in_executor(
            None,
            lambda: run_batch_export(gcs_uri, fmt, gcs_output, gcs_output_base, region, progress_callback)
        )
        job_info["status"] = "SUCCEEDED"
        job_info["message"] = "Batch export completed successfully"
    except Exception as e:
        job_info["status"] = "FAILED"
        job_info["message"] = f"Failed: {str(e)}"
        print(f"ERROR: Adaptive batch {job_id} failed: {e}")


# ═════════════════════════════════════════════════════════════════════════════
#  BATCH JOB SCRIPTS (from batch.py)
# ═════════════════════════════════════════════════════════════════════════════

def _build_download_script(gcs_input: str, fmt: str) -> str:
    local_input = "/tmp/input.parquet" if fmt in VECTOR_FORMATS else "/tmp/input.tif"
    return f"""#!/bin/bash
set -e
echo "⬇️  Downloading input from GCS..."
gsutil cp "{gcs_input}" {local_input}
echo "✅ Download done → {local_input}"
"""


def _build_convert_script(fmt: str, target_crs: Optional[int] = None) -> str:
    # Build reprojection block for vector
    if target_crs:
        vector_reproject = f"""
print("🔄 Reprojecting to EPSG:{target_crs}...")
gdf = gdf.to_crs(epsg={target_crs})
print(f"   New CRS: {{gdf.crs}}")
"""
    else:
        vector_reproject = ""

    if fmt in VECTOR_FORMATS:
        return f"""#!/bin/bash
set -e
echo "🗺️  Converting to {fmt.upper()}..."

python3 -m ensurepip --upgrade 2>/dev/null || (curl -sS https://bootstrap.pypa.io/get-pip.py | python3)
python3 -m pip install pyarrow geopandas fiona --quiet

python3 - <<'PYEOF'
import geopandas as gpd, fiona
print("📖 Reading GeoParquet...")
gdf = gpd.read_parquet("/tmp/input.parquet")
print(f"   Rows: {{len(gdf):,}} | CRS: {{gdf.crs}}")
{vector_reproject}
fmt = "{fmt}"
if fmt == "geojson":
    gdf.to_file("/tmp/output.geojson", driver="GeoJSON")
elif fmt == "geoparquet":
    gdf.to_parquet("/tmp/output.parquet")
elif fmt == "shapefile":
    gdf.to_file("/tmp/output.shp", driver="ESRI Shapefile")
    import zipfile, os
    with zipfile.ZipFile("/tmp/output_shp.zip", "w", zipfile.ZIP_DEFLATED) as zf:
        for shp_ext in [".shp", ".dbf", ".shx", ".prj"]:
            f = f"/tmp/output{{shp_ext}}"
            if os.path.exists(f):
                zf.write(f, os.path.basename(f))
elif fmt == "kml":
    if str(gdf.crs) != "EPSG:4326":
        print("🔄 KML requires EPSG:4326, reprojecting...")
        gdf = gdf.to_crs(epsg=4326)
    fiona.supported_drivers["KML"] = "rw"
    gdf.to_file("/tmp/output.kml", driver="KML")
print("✅ Conversion done")
PYEOF
"""

    # Build raster reprojection step (gdalwarp before gdal_translate)
    if target_crs:
        warp_step = f"""
echo "🔄 Reprojecting raster to EPSG:{target_crs}..."
gdalwarp -t_srs EPSG:{target_crs} \\
    -r bilinear \\
    -multi \\
    --config GDAL_CACHEMAX 4000 \\
    --config GDAL_NUM_THREADS ALL_CPUS \\
    /tmp/input.tif /tmp/reprojected.tif
mv /tmp/reprojected.tif /tmp/input.tif
echo "✅ Reprojection done"
"""
    else:
        warp_step = ""

    translate_opts = {
        "geotiff": "-of GTiff -co COMPRESS=LZW -co TILED=YES -co BIGTIFF=IF_SAFER",
        "png":     "-of PNG -scale",
        "jpeg":    "-of JPEG -co QUALITY=85 -scale",
        "jpeg2000": "-of JP2OpenJPEG -co QUALITY=100 -co REVERSIBLE=YES",
    }[fmt]

    ext = {"geotiff": ".tif", "png": ".png", "jpeg": ".jpg", "jpeg2000": ".jp2"}[fmt]

    # ── FIX: world_block بدون أي leading spaces ──
    world_block = ""
    if fmt == "png":
        world_block = """\
echo "🗺️  Generating world file..."
python3 - <<'PYEOF'
from osgeo import gdal
gdal.UseExceptions()
ds = gdal.Open('/tmp/input.tif')
gt = ds.GetGeoTransform()
with open('/tmp/output.pgw', 'w') as f:
    f.write(f'{gt[1]}\\n{gt[4]}\\n{gt[2]}\\n{gt[5]}\\n{gt[0]}\\n{gt[3]}\\n')
print('✅ World file written')
PYEOF
python3 - <<'ZIPEOF'
import zipfile, os
files = ["/tmp/output.png", "/tmp/output.pgw"]
with zipfile.ZipFile("/tmp/output_png.zip", "w", zipfile.ZIP_DEFLATED) as zf:
    for f in files:
        if os.path.exists(f):
            zf.write(f, os.path.basename(f))
print("✅ ZIP created → /tmp/output_png.zip")
ZIPEOF
"""

    return f"""#!/bin/bash
set -e
export GDAL_CACHEMAX=4000
export GDAL_NUM_THREADS=ALL_CPUS
export CHECK_DISK_FREE_SPACE=FALSE

{warp_step}
echo "🔄 Converting to {fmt.upper()}..."
TIME_START=$(date +%s%N)

gdal_translate {translate_opts} \\
    --config GDAL_CACHEMAX 4000 \\
    --config GDAL_NUM_THREADS ALL_CPUS \\
    /tmp/input.tif /tmp/output{ext}

TIME_END=$(date +%s%N)
ELAPSED=$(( (TIME_END - TIME_START) / 1000000 ))
echo "⚡ Conversion done in ${{ELAPSED}}ms — $(du -h /tmp/output{ext} | cut -f1)"

{world_block}"""


def _build_upload_script(gcs_output: str, fmt: str) -> str:
    local_output = {
        "geojson":   "/tmp/output.geojson",
        "geoparquet": "/tmp/output.parquet",
        "shapefile": "/tmp/output_shp.zip",
        "kml":       "/tmp/output.kml",
        "geotiff":   "/tmp/output.tif",
        "png":       "/tmp/output_png.zip",
        "jpeg":      "/tmp/output.jpg",
        "jpeg2000":  "/tmp/output.jp2",
    }[fmt]

    return f"""#!/bin/bash
set -e
echo "⬆️  Uploading output to GCS..."
gsutil cp "{local_output}" "{gcs_output}"
echo "🎉 Done → {gcs_output}"
"""


def _submit_batch_job(gcs_input: str, fmt: str, gcs_output: str, creds, region: str, target_crs: Optional[int] = None):
    client = batch_v1.BatchServiceClient(credentials=creds)

    # Runnable 1: Download (HOST)
    runnable_dl = batch_v1.Runnable()
    runnable_dl.script = batch_v1.Runnable.Script()
    runnable_dl.script.text = _build_download_script(gcs_input, fmt)

    # Runnable 2: Convert (GDAL container)
    runnable_convert = batch_v1.Runnable()
    runnable_convert.container = batch_v1.Runnable.Container()
    runnable_convert.container.image_uri = GDAL_IMAGE
    runnable_convert.container.entrypoint = "/bin/bash"
    runnable_convert.container.commands = ["-c", _build_convert_script(fmt, target_crs)]
    runnable_convert.container.volumes = ["/tmp:/tmp"]

    # Runnable 3: Upload (HOST)
    runnable_ul = batch_v1.Runnable()
    runnable_ul.script = batch_v1.Runnable.Script()
    runnable_ul.script.text = _build_upload_script(gcs_output, fmt)

    # Task
    task = batch_v1.TaskSpec()
    task.runnables = [runnable_dl, runnable_convert, runnable_ul]
    task.compute_resource = batch_v1.ComputeResource()
    task.compute_resource.cpu_milli = 4000
    task.compute_resource.memory_mib = 8192

    group = batch_v1.TaskGroup()
    group.task_count = 1
    group.task_spec = task

    # Allocation
    alloc = batch_v1.AllocationPolicy()
    sa = batch_v1.ServiceAccount()
    sa.email = SA_EMAIL

    inst = batch_v1.AllocationPolicy.InstancePolicyOrTemplate()
    inst.policy = batch_v1.AllocationPolicy.InstancePolicy()
    inst.policy.machine_type = "c2d-highcpu-4"
    inst.policy.boot_disk = batch_v1.AllocationPolicy.Disk()
    inst.policy.boot_disk.size_gb = BOOT_DISK_GB
    inst.policy.boot_disk.type_ = "pd-ssd"
    if USE_SPOT:
        inst.policy.provisioning_model = (
            batch_v1.AllocationPolicy.ProvisioningModel.SPOT
        )

    alloc.instances = [inst]
    alloc.service_account = sa

    # Job
    job = batch_v1.Job()
    job.task_groups = [group]
    job.allocation_policy = alloc
    job.logs_policy = batch_v1.LogsPolicy()
    job.logs_policy.destination = batch_v1.LogsPolicy.Destination.CLOUD_LOGGING

    job_id = f"griidai-export-{int(time.time())}"
    request = batch_v1.CreateJobRequest()
    request.job = job
    request.job_id = job_id
    request.parent = f"projects/{PROJECT_ID}/locations/{region}"

    result = client.create_job(request)
    return result.name, job_id


# ═════════════════════════════════════════════════════════════════════════════
#  API ENDPOINTS
# ═════════════════════════════════════════════════════════════════════════════

@router.get("/gcs/files", response_model=GcsFilesResponse)
async def list_gcs_files(
    bucket: str = Query(DEFAULT_BUCKET),
    prefix: str = Query(DEFAULT_PREFIX),
):
    """List all files in a GCS bucket/prefix."""
    try:
        client = _get_storage_client()
        bucket_obj = client.bucket(bucket)
        blobs = list(bucket_obj.list_blobs(prefix=prefix))

        files = []
        for blob in blobs:
            # Skip "directory" markers (blobs ending in /)
            if blob.name.endswith("/"):
                continue
            filename = os.path.basename(blob.name)
            if not filename:
                continue
            files.append(
                GcsFileItem(
                    name=filename,
                    full_path=blob.name,
                    gcs_uri=f"gs://{bucket}/{blob.name}",
                    size_bytes=blob.size or 0,
                    file_type=_classify_file(filename),
                    updated=blob.updated.isoformat() if blob.updated else None,
                )
            )

        return GcsFilesResponse(bucket=bucket, prefix=prefix, files=files)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list GCS files: {str(e)}")


@router.post("/gcs/upload")
async def upload_file_to_gcs(file: UploadFile = File(...)):
    """Uploads a file directly to the configured GCS bucket under DEFAULT_PREFIX."""
    try:
        client = _get_storage_client()
        bucket = client.bucket(DEFAULT_BUCKET)
        
        # We upload to DEFAULT_PREFIX with the original filename
        blob_name = f"{DEFAULT_PREFIX}{file.filename}"
        blob = bucket.blob(blob_name)
        
        # Read file contents and upload
        contents = await file.read()
        blob.upload_from_string(contents, content_type=file.content_type)
        
        return {
            "success": True,
            "message": f"File {file.filename} uploaded successfully to gs://{DEFAULT_BUCKET}/{blob_name}",
            "gcs_uri": f"gs://{DEFAULT_BUCKET}/{blob_name}"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload file to GCS: {str(e)}")


@router.post("/gcs/upload-raw-osm")
async def upload_raw_osm(file: UploadFile = File(...)):
    """Uploads robust raw OSM GeoJSON to the configured GCS bucket under osm_raw/."""
    try:
        client = _get_storage_client()
        bucket = client.bucket(DEFAULT_BUCKET)
        
        timestamp = int(time.time())
        filename = file.filename if file.filename else "osm_layer.geojson"
        blob_name = f"osm_raw/{timestamp}_{filename}"
        blob = bucket.blob(blob_name)
        
        contents = await file.read()
        blob.upload_from_string(contents, content_type=file.content_type)
        
        return {
            "success": True,
            "message": f"OSM Raw data uploaded successfully",
            "gcs_uri": f"gs://{DEFAULT_BUCKET}/{blob_name}"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload raw OSM to GCS: {str(e)}")

EXPORTS_PREFIX = "exports/"


@router.get("/gcs/exports", response_model=GcsFilesResponse)
def list_export_files():
    """Lists exported (non-zipped) files from the exports/ folder in GCS bucket."""
    try:
        client = _get_storage_client()
        blobs = client.list_blobs(DEFAULT_BUCKET, prefix=EXPORTS_PREFIX)

        files = []
        for blob in blobs:
            # Skip "directory" objects and compressed .zip files
            if blob.name.endswith("/") or blob.name.lower().endswith(".zip"):
                continue
            filename = os.path.basename(blob.name)
            files.append({
                "name": filename,
                "full_path": blob.name,
                "gcs_uri": f"gs://{DEFAULT_BUCKET}/{blob.name}",
                "size_bytes": blob.size,
                "file_type": _classify_file(filename),
                "updated": blob.updated.isoformat() if blob.updated else None,
            })

        return GcsFilesResponse(
            bucket=DEFAULT_BUCKET, prefix=EXPORTS_PREFIX, files=files
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list export files: {str(e)}")


@router.get("/gcs/download-url")
async def get_download_url(
    gcs_uri: str = Query(..., description="Full GCS URI, e.g. gs://bucket/path/file.tif"),
):
    """Generate a signed download URL for a GCS blob (valid 1 hour)."""
    try:
        bucket_name, blob_path = _parse_gcs_uri(gcs_uri)
        client = _get_storage_client()
        bucket_obj = client.bucket(bucket_name)
        blob = bucket_obj.blob(blob_path)

        if not blob.exists():
            raise HTTPException(status_code=404, detail=f"File not found: {gcs_uri}")

        filename = os.path.basename(blob_path)
        url = blob.generate_signed_url(
            version="v4",
            expiration=datetime.timedelta(hours=1),
            method="GET",
            response_disposition=f'attachment; filename="{filename}"',
        )
        return {"download_url": url, "gcs_uri": gcs_uri, "filename": filename}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate download URL: {str(e)}")


@router.post("/gcs/batch-export", response_model=BatchExportAccepted)
async def submit_batch_export(req: BatchExportRequest, background_tasks: BackgroundTasks):
    """Submit a GCP Batch export job for a GCS file."""
    fmt = req.target_format.lower()

    # Validate format
    all_formats = RASTER_FORMATS + VECTOR_FORMATS
    if fmt not in all_formats:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported format '{fmt}'. Supported: {all_formats}",
        )

    # Determine output path
    bucket_name, blob_path = _parse_gcs_uri(req.gcs_uri)
    stem = os.path.splitext(os.path.basename(blob_path))[0]
    ext_map = {
        "geojson": ".geojson", "shapefile": ".zip",
        "kml": ".kml", "geotiff": ".tif", "png": ".zip", "jpeg": ".jpg",
        "jpeg2000": ".jp2", "geoparquet": ".parquet"
    }
    
    # Route to appropriate folder based on input
    if "osm_raw/" in blob_path:
        out_folder = "osm_exports"
    else:
        out_folder = "exports"
        
    gcs_output = f"gs://{bucket_name}/{out_folder}/{stem}_export{ext_map[fmt]}"

    try:
        region = "us-east1"
        job_id = f"griidai-export-{int(time.time())}"
        gcs_output_base = f"gs://{bucket_name}/exports/{stem}_meta_{job_id}"

        # Store job info in memory
        _batch_jobs[job_id] = {
            "job_id": job_id,
            "job_name": f"Adaptive Batch {job_id}",
            "gcs_output": gcs_output,
            "format": fmt,
            "status": "QUEUED",
            "message": "Queued for background processing",
        }

        # Run the adaptive 2-step process in background
        background_tasks.add_task(
            _run_adaptive_batch_task,
            job_id, req.gcs_uri, fmt, gcs_output, gcs_output_base, region
        )

        return BatchExportAccepted(
            job_id=job_id,
            job_name=f"Adaptive Batch {job_id}",
            gcs_output=gcs_output,
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to sumbit batch job: {str(e)}")


@router.get("/gcs/batch-export/status", response_model=BatchExportStatusResponse)
async def get_batch_export_status(job_id: str = Query(...)):
    """Check the status of a GCP Batch export job (Adaptive)."""
    job_info = _batch_jobs.get(job_id)
    if not job_info:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    status_str = job_info["status"]
    download_url = None

    if status_str == "SUCCEEDED":
        download_url = f"/api/gcs/download-url?gcs_uri={job_info['gcs_output']}"

    return BatchExportStatusResponse(
        job_id=job_id,
        status=status_str,
        gcs_output=job_info["gcs_output"],
        download_url=download_url,
        message=job_info.get("message", f"Job is {status_str}"),
    )


# ═════════════════════════════════════════════════════════════════════════════
#  CRS LIST ENDPOINT
# ═════════════════════════════════════════════════════════════════════════════

CRS_LIST = [
    # Geographic
    {"code": 4326, "name": "WGS 84", "category": "Geographic"},
    {"code": 4269, "name": "NAD83", "category": "Geographic"},
    {"code": 4267, "name": "NAD27", "category": "Geographic"},
    {"code": 4258, "name": "ETRS89", "category": "Geographic"},
    {"code": 4674, "name": "SIRGAS 2000", "category": "Geographic"},
    # Web
    {"code": 3857, "name": "Web Mercator (Pseudo-Mercator)", "category": "Web"},
    # UTM WGS 84 North (popular zones)
    {"code": 32601, "name": "UTM Zone 1N (WGS 84)", "category": "UTM North"},
    {"code": 32610, "name": "UTM Zone 10N (WGS 84)", "category": "UTM North"},
    {"code": 32611, "name": "UTM Zone 11N (WGS 84)", "category": "UTM North"},
    {"code": 32612, "name": "UTM Zone 12N (WGS 84)", "category": "UTM North"},
    {"code": 32613, "name": "UTM Zone 13N (WGS 84)", "category": "UTM North"},
    {"code": 32614, "name": "UTM Zone 14N (WGS 84)", "category": "UTM North"},
    {"code": 32615, "name": "UTM Zone 15N (WGS 84)", "category": "UTM North"},
    {"code": 32616, "name": "UTM Zone 16N (WGS 84)", "category": "UTM North"},
    {"code": 32617, "name": "UTM Zone 17N (WGS 84)", "category": "UTM North"},
    {"code": 32618, "name": "UTM Zone 18N (WGS 84)", "category": "UTM North"},
    {"code": 32619, "name": "UTM Zone 19N (WGS 84)", "category": "UTM North"},
    {"code": 32620, "name": "UTM Zone 20N (WGS 84)", "category": "UTM North"},
    {"code": 32630, "name": "UTM Zone 30N (WGS 84)", "category": "UTM North"},
    {"code": 32631, "name": "UTM Zone 31N (WGS 84)", "category": "UTM North"},
    {"code": 32632, "name": "UTM Zone 32N (WGS 84)", "category": "UTM North"},
    {"code": 32633, "name": "UTM Zone 33N (WGS 84)", "category": "UTM North"},
    {"code": 32634, "name": "UTM Zone 34N (WGS 84)", "category": "UTM North"},
    {"code": 32635, "name": "UTM Zone 35N (WGS 84)", "category": "UTM North"},
    {"code": 32636, "name": "UTM Zone 36N (WGS 84)", "category": "UTM North"},
    {"code": 32637, "name": "UTM Zone 37N (WGS 84)", "category": "UTM North"},
    {"code": 32638, "name": "UTM Zone 38N (WGS 84)", "category": "UTM North"},
    {"code": 32639, "name": "UTM Zone 39N (WGS 84)", "category": "UTM North"},
    {"code": 32640, "name": "UTM Zone 40N (WGS 84)", "category": "UTM North"},
    # UTM WGS 84 South (popular zones)
    {"code": 32717, "name": "UTM Zone 17S (WGS 84)", "category": "UTM South"},
    {"code": 32718, "name": "UTM Zone 18S (WGS 84)", "category": "UTM South"},
    {"code": 32719, "name": "UTM Zone 19S (WGS 84)", "category": "UTM South"},
    {"code": 32720, "name": "UTM Zone 20S (WGS 84)", "category": "UTM South"},
    {"code": 32733, "name": "UTM Zone 33S (WGS 84)", "category": "UTM South"},
    {"code": 32734, "name": "UTM Zone 34S (WGS 84)", "category": "UTM South"},
    {"code": 32735, "name": "UTM Zone 35S (WGS 84)", "category": "UTM South"},
    {"code": 32736, "name": "UTM Zone 36S (WGS 84)", "category": "UTM South"},
    # Regional
    {"code": 2154, "name": "RGF93 / Lambert-93 (France)", "category": "Regional"},
    {"code": 27700, "name": "OSGB 1936 / British National Grid", "category": "Regional"},
    {"code": 28992, "name": "Amersfoort / RD New (Netherlands)", "category": "Regional"},
    {"code": 22770, "name": "Deir ez Zor / Syria Lambert", "category": "Regional"},
    {"code": 22992, "name": "Egypt 1907 / Red Belt", "category": "Regional"},
    {"code": 20436, "name": "Ain el Abd / UTM Zone 36N (Saudi)", "category": "Regional"},
    {"code": 2100, "name": "GGRS87 / Greek Grid", "category": "Regional"},
]


@router.get("/gcs/crs-list")
async def list_available_crs():
    """Return a curated list of common CRS (EPSG codes) for reprojection."""
    return {"crs_list": CRS_LIST}
