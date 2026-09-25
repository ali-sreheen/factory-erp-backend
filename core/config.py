import os
import sys
import re
import urllib.parse

def get_base_dir() -> str:
    """Returns the base project directory, taking into account PyInstaller frozen state."""
    if getattr(sys, 'frozen', False):
        return os.path.dirname(sys.executable)
    # If run from core/ or root, locate the root project directory
    current_dir = os.path.abspath(os.path.dirname(__file__))
    if os.path.basename(current_dir) == "core":
        return os.path.dirname(current_dir)
    return current_dir

BASE_DIR = get_base_dir()

def load_env():
    """Loads key-value pairs from .env file into os.environ."""
    env_path = os.path.join(BASE_DIR, ".env")
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, val = line.split("=", 1)
                    os.environ[key.strip()] = val.strip()

load_env()

# Uploads directory
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# JWT Authentication configuration
SECRET_KEY = os.getenv("JWT_SECRET", "super_secret_factory_erp_key_1234567890")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440  # 24 hours

# Database URL configuration
DATABASE_URL = os.getenv("DATABASE_URL")
is_sqlite = True

if DATABASE_URL:
    if DATABASE_URL.startswith("postgresql://") or DATABASE_URL.startswith("postgres://"):
        is_sqlite = False
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
        # Parse and URL-encode the password to safely handle special characters (e.g. '@')
        match = re.match(r"(postgresql://)([^:]+):(.*)@([^@/]+:[0-9]+/[^?]+)", DATABASE_URL)
        if match:
            scheme, username, password, rest = match.groups()
            if password.startswith('[') and password.endswith(']'):
                password = password[1:-1]
            encoded_password = urllib.parse.quote_plus(password)
            DATABASE_URL = f"{scheme}{username}:{encoded_password}@{rest}"
else:
    db_path = os.path.join(BASE_DIR, "inventory_v4.db")
    DATABASE_URL = f"sqlite:///{db_path}"
