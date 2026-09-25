from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session
import models
from core.database import get_db
from core.security import oauth2_scheme, decode_access_token

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> models.User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    payload = decode_access_token(token)
    if not payload:
        raise credentials_exception
        
    username: str = payload.get("sub")
    if username is None:
        raise credentials_exception
        
    user = db.query(models.User).filter(models.User.username == username).first()
    if user is None:
        raise credentials_exception
        
    if user.is_approved != 1:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="بانتظار موافقة مدير النظام",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user

def check_permission(db: Session, current_user: models.User, category: str) -> bool:
    if current_user.username == "admin":
        return True
    perm = db.query(models.UserPermission).filter(
        models.UserPermission.user_id == current_user.id,
        models.UserPermission.department_name == category
    ).first()
    if not perm or not perm.can_edit:
        raise HTTPException(status_code=403, detail="لا تملك صلاحية التعديل أو الإضافة في هذا القسم")
    return True

def user_has_project_management(user: models.User, db: Session) -> bool:
    if user.username == "admin":
        return True
    perm = db.query(models.UserPermission).filter(
        models.UserPermission.user_id == user.id,
        models.UserPermission.department_name == "project_management"
    ).first()
    return perm is not None and perm.can_edit == 1

def check_purchasing_permission(user: models.User, action: str, db: Session) -> bool:
    if user.username == "admin":
        return True
    perm = db.query(models.UserPermission).filter(
        models.UserPermission.user_id == user.id,
        models.UserPermission.department_name == action
    ).first()
    if not perm or not perm.can_edit:
        raise HTTPException(status_code=403, detail="لا تملك هذه الصلاحية في نظام المشتريات")
    return True

def user_has_hr_management(user: models.User, db: Session) -> bool:
    if user.username == "admin":
        return True
    perm = db.query(models.UserPermission).filter(
        models.UserPermission.user_id == user.id,
        models.UserPermission.department_name == "hr_management"
    ).first()
    return perm is not None and (perm.can_edit == 1)
