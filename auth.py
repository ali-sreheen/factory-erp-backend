"""
Backward-compatibility bridge for auth functions and dependencies.
All core security logic is housed in core/security.py and core/permissions.py.
"""
from core.config import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES
from core.database import get_db, SessionLocal
from core.security import (
    oauth2_scheme,
    verify_password,
    get_password_hash,
    create_access_token,
    decode_access_token
)
from core.permissions import (
    get_current_user,
    check_permission,
    user_has_project_management,
    check_purchasing_permission,
    user_has_hr_management
)

__all__ = [
    "SECRET_KEY",
    "ALGORITHM",
    "ACCESS_TOKEN_EXPIRE_MINUTES",
    "SessionLocal",
    "get_db",
    "oauth2_scheme",
    "verify_password",
    "get_password_hash",
    "create_access_token",
    "decode_access_token",
    "get_current_user",
    "check_permission",
    "user_has_project_management",
    "check_purchasing_permission",
    "user_has_hr_management",
]
