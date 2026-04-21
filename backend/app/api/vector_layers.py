"""
Vector Layers API Router
POST /vector-layers/upload
GET  /vector-layers/{job_id}/status
GET  /vector-layers/{job_id}/pmtiles-url
"""
import os
import shutil
import uuid
import zipfile
import threading
from typing import List
from pathlib import Path
from datetime import timedelta, datetime

from fastapi import APIRouter, HTTPException, UploadFile, File, Depends, BackgroundTasks
from sqlalchemy.orm import Session
from google.cloud import storage

from app.core.config import settings
from app.core.db import get_db
from app.models.vector_layer import VectorLayer
from app.api.batch_service import submit_shp_to_pmtiles_job, poll_job_status, get_credentials

router = APIRouter(tags=["vector-layers"])

BASE_DIR = Path(__file__).resolve().parent.parent.parent
TEMP_DIR = BASE_DIR / "temp_shp_uploads"
TEMP_DIR.mkdir(exist_ok=True)

GCS_BUCKET = "griidai-data"

def upload_to_gcs(local_file: str, gcs_blob_name: str, creds):
    client = storage.Client(credentials=creds)
    bucket = client.bucket(GCS_BUCKET)
    blob = bucket.blob(gcs_blob_name)
    blob.upload_from_filename(local_file)
    return f"gs://{GCS_BUCKET}/{gcs_blob_name}"

def generate_signed_url(gcs_uri: str, creds, hours=1):
    client = storage.Client(credentials=creds)
    bucket_name = gcs_uri.replace("gs://", "").split("/")[0]
    blob_name = "/".join(gcs_uri.replace("gs://", "").split("/")[1:])
    bucket = client.bucket(bucket_name)
    blob = bucket.blob(blob_name)
    
    url = blob.generate_signed_url(
        version="v4",
        expiration=timedelta(hours=hours),
        method="GET",
    )
    return url

def _run_batch_job_in_background(job_name: str, job_id: str, db: Session):
    try:
        creds = get_credentials()
        final_state = "UNKNOWN"
        for state in poll_job_status(job_name, creds):
            final_state = state
            layer = db.query(VectorLayer).filter(VectorLayer.id == job_id).first()
            if layer:
                if state in ("SUCCEEDED", "FAILED"):
                    layer.status = state
                    db.commit()
    except Exception as e:
        layer = db.query(VectorLayer).filter(VectorLayer.id == job_id).first()
        if layer:
            layer.status = "FAILED"
            layer.message = str(e)
            db.commit()

@router.post("/vector-layers/upload")
async def upload_shapefile(background_tasks: BackgroundTasks, files: List[UploadFile] = File(...), db: Session = Depends(get_db)):
    has_shp = any(f.filename.lower().endswith(".shp") for f in files)
    if not has_shp:
        raise HTTPException(status_code=400, detail="Missing .shp file in the upload")

    layer_name = next(f.filename.split(".")[0] for f in files if f.filename.lower().endswith(".shp"))
    job_id = f"shp-{uuid.uuid4().hex[:8]}"

    # Save files to temp directory
    job_dir = TEMP_DIR / job_id
    job_dir.mkdir(exist_ok=True)
    
    for f in files:
        file_path = job_dir / f.filename
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(f.file, buffer)

    # Zip the files
    zip_path = TEMP_DIR / f"{job_id}.zip"
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for f in job_dir.iterdir():
            zf.write(f, arcname=f.name)

    # Upload ZIP to GCS
    try:
        creds = get_credentials()
        gcs_zip = upload_to_gcs(str(zip_path), f"vector-uploads/{job_id}.zip", creds)
        gcs_pmtiles = f"gs://{GCS_BUCKET}/pmtiles/{job_id}.pmtiles"
        gcs_parquet = f"gs://{GCS_BUCKET}/pmtiles/{job_id}.parquet"
        
        # Submit Batch Job
        job_name, batch_job_id = submit_shp_to_pmtiles_job(gcs_zip, gcs_pmtiles, gcs_parquet, creds)
        
        # Save to DB
        layer = VectorLayer(
            id=job_id,
            layer_name=layer_name,
            gcs_shp=gcs_zip,
            gcs_pmtiles=gcs_pmtiles,
            gcs_parquet=gcs_parquet,
            status="RUNNING"
        )
        db.add(layer)
        db.commit()

        # Start background polling
        background_tasks.add_task(_run_batch_job_in_background, job_name, job_id, db)

    finally:
        # Cleanup temp local files
        if zip_path.exists():
            zip_path.unlink()
        shutil.rmtree(job_dir, ignore_errors=True)

    return {"job_id": job_id, "layer_name": layer_name, "status": "RUNNING"}

@router.get("/vector-layers/{job_id}/status")
async def get_status(job_id: str, db: Session = Depends(get_db)):
    layer = db.query(VectorLayer).filter(VectorLayer.id == job_id).first()
    if not layer:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return {
        "status": layer.status,
        "message": layer.message,
        "layer_name": layer.layer_name
    }

@router.get("/vector-layers/{job_id}/pmtiles-url")
async def get_pmtiles_url(job_id: str, db: Session = Depends(get_db)):
    layer = db.query(VectorLayer).filter(VectorLayer.id == job_id).first()
    if not layer:
        raise HTTPException(status_code=404, detail="Job not found")
    
    if layer.status != "SUCCEEDED":
        raise HTTPException(status_code=400, detail=f"Job is not completed yet. Status: {layer.status}")

    try:
        creds = get_credentials()
        url = generate_signed_url(layer.gcs_pmtiles, creds)
        return {"url": url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
