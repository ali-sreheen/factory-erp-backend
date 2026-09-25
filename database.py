"""
Backward-compatibility bridge for database configuration.
All core database functionality is housed in core/database.py and core/config.py.
"""
from core.config import load_env, get_base_dir, BASE_DIR, DATABASE_URL, is_sqlite
from core.database import engine, SessionLocal, Base, get_db

__all__ = [
    "load_env",
    "get_base_dir",
    "BASE_DIR",
    "DATABASE_URL",
    "is_sqlite",
    "engine",
    "SessionLocal",
    "Base",
    "get_db",
]
