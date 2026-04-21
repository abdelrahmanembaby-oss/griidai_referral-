"""
Upload API Router
POST /upload         → Upload a GIS file (COG, GeoTIFF, Shapefile, GeoParquet, etc.) to the server
GET  /uploads        → List all uploaded files with metadata
DELETE /uploads/{filename} → Delete an uploaded file
"""
import os
import shutil
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import JSONResponse
from pydantic import BaseModel

router = APIRouter(tags=["upload"])

# ─── Storage directory ────────────────────────────────────────────────────────
# Files are persisted in a dedicated folder next to the backend.
BASE_DIR = Path(__file__).resolve().parent.parent.parent  # /backend
UPLOADS_DIR = BASE_DIR / "gis_uploads"
UPLOADS_DIR.mkdir(exist_ok=True)

# ─── Supported extensions ────────────────────────────────────────────────────
RASTER_EXTENSIONS = {".tif", ".tiff", ".cog"}
VECTOR_EXTENSIONS = {".shp", ".geojson", ".json", ".parquet", ".gpkg", ".kml", ".zip"}
ALLOWED_EXTENSIONS = RASTER_EXTENSIONS | VECTOR_EXTENSIONS


def _file_type(filename: str) -> str:
    """Return 'raster', 'vector', or 'unknown' based on file extension."""
    ext = Path(filename).suffix.lower()
    if ext in RASTER_EXTENSIONS:
        return "raster"
    if ext in VECTOR_EXTENSIONS:
        return "vector"
    return "unknown"


# ─── Pydantic models ─────────────────────────────────────────────────────────
class UploadedFile(BaseModel):
    filename: str
    path: str          # Server-side absolute path (used as file_id in export)
    size_bytes: int
    file_type: str     # 'raster' | 'vector' | 'unknown'
    extension: str


class UploadResponse(BaseModel):
    message: str
    file: UploadedFile


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.post("/upload", response_model=UploadResponse, status_code=201)
async def upload_gis_file(file: UploadFile = File(...)):
    """
    Upload a GIS file to the server's persistent storage.
    Supported: .tif/.tiff/.cog (raster), .shp/.geojson/.parquet/.gpkg/.kml/.zip (vector)
    """
    filename = file.filename or "uploaded_file"
    ext = Path(filename).suffix.lower()

    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Unsupported file type '{ext}'. "
                f"Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
            ),
        )

    dest_path = UPLOADS_DIR / filename

    # Handle duplicate filenames by adding a numeric suffix
    counter = 1
    while dest_path.exists():
        stem = Path(filename).stem
        dest_path = UPLOADS_DIR / f"{stem}_{counter}{ext}"
        counter += 1

    with open(dest_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    size = dest_path.stat().st_size
    ftype = _file_type(dest_path.name)

    return UploadResponse(
        message="File uploaded successfully",
        file=UploadedFile(
            filename=dest_path.name,
            path=str(dest_path),
            size_bytes=size,
            file_type=ftype,
            extension=ext,
        ),
    )


@router.get("/uploads", response_model=List[UploadedFile])
async def list_uploaded_files():
    """Return metadata for all files stored in the GIS uploads directory."""
    files: List[UploadedFile] = []
    for f in sorted(UPLOADS_DIR.iterdir()):
        if f.is_file():
            ext = f.suffix.lower()
            files.append(
                UploadedFile(
                    filename=f.name,
                    path=str(f),
                    size_bytes=f.stat().st_size,
                    file_type=_file_type(f.name),
                    extension=ext,
                )
            )
    return files


@router.delete("/uploads/{filename}", status_code=200)
async def delete_uploaded_file(filename: str):
    """Delete an uploaded GIS file from the server."""
    # Prevent path traversal
    safe_name = Path(filename).name
    file_path = UPLOADS_DIR / safe_name
    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"File '{safe_name}' not found")
    file_path.unlink()
    return {"message": f"File '{safe_name}' deleted successfully"}
