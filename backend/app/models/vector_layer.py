from sqlalchemy import Column, String, DateTime
import datetime
from app.core.db import Base

class VectorLayer(Base):
    __tablename__ = "vector_layers"
    id = Column(String, primary_key=True, index=True)
    layer_name = Column(String, index=True)
    gcs_shp = Column(String)                     # gs://bucket/shp/...zip
    gcs_pmtiles = Column(String, nullable=True)  # gs://bucket/pmtiles/...pmtiles
    gcs_parquet = Column(String, nullable=True)
    status = Column(String, default="PENDING")   # PENDING | RUNNING | SUCCEEDED | FAILED
    message = Column(String, default="")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
