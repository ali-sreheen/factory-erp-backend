import os
import shutil
import uuid
from typing import Optional
from fastapi import UploadFile
from core.config import UPLOAD_DIR

def save_uploaded_file(file: UploadFile, prefix: str = "file") -> Optional[str]:
    """
    Saves an uploaded file safely to the UPLOAD_DIR with a unique name
    and returns its accessible static URL (/uploads/filename).
    """
    if not file or not file.filename:
        return None
    
    ext = os.path.splitext(file.filename)[1]
    unique_filename = f"{prefix}_{uuid.uuid4().hex[:12]}{ext}"
    dest_path = os.path.join(UPLOAD_DIR, unique_filename)
    
    with open(dest_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    return f"/uploads/{unique_filename}"
