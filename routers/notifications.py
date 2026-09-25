from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
import schemas
import crud
from core.database import get_db
from core.permissions import get_current_user

router = APIRouter(prefix="/api/notifications", tags=["notifications"])

@router.get("/", response_model=List[schemas.NotificationResponse])
def get_notifications(
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    return crud.get_user_notifications(db, current_user.id, limit=limit)

@router.get("/unread-count", response_model=schemas.UnreadCountResponse)
def get_unread_notification_count(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    count = crud.get_unread_notification_count(db, current_user.id)
    return {"unread_count": count}

@router.put("/{user_notif_id}/read")
def mark_notification_read(
    user_notif_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    res = crud.mark_notification_as_read(db, current_user.id, user_notif_id)
    if not res:
        raise HTTPException(status_code=404, detail="الإشعار غير موجود")
    return {"message": "تم تحديد الإشعار كمقروء"}

@router.post("/mark-all-read")
def mark_all_notifications_read(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    crud.mark_all_notifications_as_read(db, current_user.id)
    return {"message": "تم تحديد جميع الإشعارات كمقروءة"}

@router.delete("/{user_notif_id}")
def delete_notification(
    user_notif_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    success = crud.delete_user_notification(db, current_user.id, user_notif_id)
    if not success:
        raise HTTPException(status_code=404, detail="الإشعار غير موجود")
    return {"message": "تم حذف الإشعار"}

@router.get("/settings", response_model=schemas.NotificationSettingsResponse)
def get_notification_settings(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    settings = crud.get_user_notification_settings(db, current_user.id)
    return {"settings": settings}

@router.put("/settings", response_model=schemas.NotificationSettingsResponse)
def update_notification_settings(
    payload: schemas.NotificationSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    settings = crud.update_user_notification_settings(db, current_user.id, payload.settings)
    return {"settings": settings}
