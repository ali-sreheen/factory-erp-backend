from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
import os
import sys
import re
import urllib.parse

def load_env():
    # If compiled with PyInstaller, look next to the executable
    if getattr(sys, 'frozen', False):
        base_dir = os.path.dirname(sys.executable)
    else:
        base_dir = os.path.abspath(os.path.dirname(__file__))
        
    env_path = os.path.join(base_dir, ".env")
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, val = line.split("=", 1)
                    os.environ[key.strip()] = val.strip()

load_env()

def get_base_dir():
    if getattr(sys, 'frozen', False):
        return os.path.dirname(sys.executable)
    return os.path.abspath(os.path.dirname(__file__))

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
            # Strip brackets if user kept placeholder brackets
            if password.startswith('[') and password.endswith(']'):
                password = password[1:-1]
            encoded_password = urllib.parse.quote_plus(password)
            DATABASE_URL = f"{scheme}{username}:{encoded_password}@{rest}"
else:
    BASE_DIR = get_base_dir()
    db_path = os.path.join(BASE_DIR, "inventory_v4.db")
    DATABASE_URL = f"sqlite:///{db_path}"

if is_sqlite:
    engine = create_engine(
        DATABASE_URL, connect_args={"check_same_thread": False}
    )
else:
    engine = create_engine(DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()
