from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn

from app.core.config import settings
from app.core.db import engine, Base
from app.api import referral, auth, project, compute, imagery

print("DATABASE_URL=", settings.DATABASE_URL)
app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    openapi_prefix=settings.API_PREFIX,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# include routers
app.include_router(auth.router, prefix=settings.API_PREFIX)
app.include_router(referral.router, prefix=settings.API_PREFIX)
app.include_router(project.router, prefix=settings.API_PREFIX)
app.include_router(compute.router, prefix=settings.API_PREFIX)
app.include_router(imagery.router, prefix=settings.API_PREFIX)

@app.on_event("startup")
async def startup_event():
    # create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

@app.get("/")
def read_root():
    return {"message": "Welcome to GriidAi Referral API"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
