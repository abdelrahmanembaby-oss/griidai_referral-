import os
import zipfile
import shutil
from pathlib import Path
from typing import List

STORAGE_BASE_DIR = Path("storage")

def ensure_storage_dirs():
    """Ensure the base storage directory exists."""
    if not STORAGE_BASE_DIR.exists():
        STORAGE_BASE_DIR.mkdir(parents=True)

def get_user_bucket(user_id: str) -> Path:
    """Get or create the bucket directory for a specific user."""
    user_dir = STORAGE_BASE_DIR / user_id
    if not user_dir.exists():
        user_dir.mkdir(parents=True)
    return user_dir

def list_files(user_id: str) -> List[str]:
    """List all files/folders in a user's bucket."""
    user_dir = get_user_bucket(user_id)
    return [str(f.relative_to(user_dir)) for f in user_dir.rglob("*")]

def unzip_to_bucket(zip_path: str, user_id: str, folder_name: str):
    """
    Unzip a downloaded USGS file into a specific folder in the user's bucket.
    """
    user_dir = get_user_bucket(user_id)
    target_dir = user_dir / folder_name
    
    if not target_dir.exists():
        target_dir.mkdir(parents=True)
        
    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
        zip_ref.extractall(target_dir)
        
    return target_dir

def delete_file(user_id: str, path: str):
    """Delete a file or folder from the user's bucket."""
    user_dir = get_user_bucket(user_id)
    target = user_dir / path
    if target.exists():
        if target.is_dir():
            shutil.rmtree(target)
        else:
            target.unlink()
