import os
import sys
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

import models
from core.config import UPLOAD_DIR
from core.database import engine, get_db
from core.migrations import run_db_migrations
from core.seeders import run_all_seeders

import routers.auth
import routers.users
import routers.items
import routers.projects
import routers.purchasing
import routers.hr
import routers.service_jobs
import routers.notifications

# --- INITIALIZE DATABASE & SEEDERS ---
run_db_migrations(engine)
run_all_seeders()

# --- INITIALIZE FASTAPI APP ---
app = FastAPI(title="Factory ERP API")

# --- MIDDLEWARE ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- MOUNT STATIC UPLOADS ---
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# --- CORE ENDPOINTS ---
@app.get("/api/health")
def health_check():
    return {"status": "ok"}

@app.get("/api/debug/all-permissions")
def debug_all_permissions(db: Session = Depends(get_db)):
    """Temporary debug endpoint - shows all permissions and users in DB"""
    users = db.query(models.User).all()
    perms = db.query(models.UserPermission).all()
    return {
        "users": [{"id": u.id, "username": u.username} for u in users],
        "permissions": [{"id": p.id, "user_id": p.user_id, "department_name": p.department_name, "can_edit": p.can_edit} for p in perms]
    }

# --- INCLUDE ROUTERS ---
app.include_router(routers.auth.router)
app.include_router(routers.users.router)
app.include_router(routers.items.router)
app.include_router(routers.projects.router)
app.include_router(routers.purchasing.router)
app.include_router(routers.hr.router)
app.include_router(routers.service_jobs.router)
app.include_router(routers.notifications.router)

# --- SERVE FRONTEND STATIC ASSETS ---
def get_frontend_dir() -> str:
    if getattr(sys, 'frozen', False):
        return os.path.join(sys._MEIPASS, "frontend")
    return os.path.abspath(os.path.join(os.path.dirname(__file__), "frontend"))

frontend_dir = get_frontend_dir()
if os.path.exists(frontend_dir):
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")
