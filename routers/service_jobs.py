from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, File, UploadFile
from sqlalchemy.orm import Session
from sqlalchemy import func

import models
import schemas
import crud
from core.database import get_db
from core.permissions import get_current_user
from services.file_service import save_uploaded_file

router = APIRouter(tags=["service_jobs"])

# --- SERVICE JOBS ---

@router.get("/api/service-jobs", response_model=List[schemas.ServiceJobResponse], include_in_schema=False)
@router.get("/api/service-jobs/", response_model=List[schemas.ServiceJobResponse])
def get_service_jobs(
    status: Optional[str] = None,
    client_name: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    return crud.get_service_jobs(db, status=status, client_name=client_name)

@router.get("/api/service-jobs/next-number")
def get_next_service_job_number(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    next_num = crud.get_next_service_job_number(db)
    return {"next_job_number": next_num}

@router.get("/api/service-jobs/{job_id}", response_model=schemas.ServiceJobResponse)
def get_service_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    job = crud.get_service_job_by_id(db, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="العمل غير موجود")
    return job

@router.post("/api/service-jobs", response_model=schemas.ServiceJobResponse, include_in_schema=False)
@router.post("/api/service-jobs/", response_model=schemas.ServiceJobResponse)
def create_service_job(
    job: schemas.ServiceJobCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if not job.job_number or not job.job_number.strip():
        job.job_number = crud.get_next_service_job_number(db)
    else:
        job.job_number = job.job_number.strip()

    existing = crud.get_service_job_by_number(db, job.job_number)
    if existing:
        raise HTTPException(status_code=400, detail="رقم الإنتاج مسجل مسبقاً، الرجاء اختيار رقم آخر")
    db_job = crud.create_service_job(db, job, user_id=current_user.id)
    try:
        user_name = current_user.full_name or current_user.username
        crud.broadcast_notification(
            db=db,
            title="أمر تشغيل خدمة جديد",
            message=f"قام {user_name} بإنشاء أمر تشغيل خدمة: {db_job.name} (رقم: {db_job.job_number}) للعميل: {db_job.client_name}",
            notif_type="service_job_created",
            reference_id=db_job.id
        )
    except Exception as e:
        print(f"[NOTIF ERROR] service_job_created: {e}")
    return db_job

@router.put("/api/service-jobs/{job_id}", response_model=schemas.ServiceJobResponse)
def update_service_job(
    job_id: int,
    job_update: schemas.ServiceJobUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    old_job = crud.get_service_job_by_id(db, job_id)
    old_status = old_job.status if old_job else None

    if job_update.job_number:
        job_update.job_number = job_update.job_number.strip()
        existing = crud.get_service_job_by_number(db, job_update.job_number)
        if existing and existing.id != job_id:
            raise HTTPException(status_code=400, detail="رقم الإنتاج مسجل مسبقاً لعمل آخر")
    updated = crud.update_service_job(db, job_id, job_update)
    if not updated:
        raise HTTPException(status_code=404, detail="العمل غير موجود")

    if old_status and job_update.status and str(old_status).strip() != str(job_update.status).strip():
        try:
            user_name = current_user.full_name or current_user.username
            crud.broadcast_notification(
                db=db,
                title="تحديث أمر تشغيل الخدمة",
                message=f"تم تغيير حالة أمر التشغيل '{updated.name}' (رقم: {updated.job_number}) من '{old_status}' إلى '{job_update.status}' بواسطة {user_name}",
                notif_type="service_job_status_changed",
                reference_id=updated.id
            )
        except Exception as e:
            print(f"[NOTIF ERROR] service_job_status_changed: {e}")

    return updated

@router.delete("/api/service-jobs/{job_id}")
def delete_service_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    success = crud.delete_service_job(db, job_id)
    if not success:
        raise HTTPException(status_code=404, detail="العمل غير موجود")
    return {"message": "تم حذف العمل بنجاح"}

@router.post("/api/service-jobs/{job_id}/attachments/", response_model=schemas.ServiceJobAttachmentResponse)
def create_service_job_attachment(
    job_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    job = crud.get_service_job_by_id(db, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="العمل غير موجود")
    file_url = save_uploaded_file(file, prefix="service")
    if not file_url:
        raise HTTPException(status_code=400, detail="الملف غير صالح")
    return crud.create_service_job_attachment(db, job_id, file.filename, file_url)

@router.delete("/api/service-jobs/attachments/{attachment_id}")
def delete_service_job_attachment(
    attachment_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    success = crud.delete_service_job_attachment(db, attachment_id)
    if not success:
        raise HTTPException(status_code=404, detail="المرفق غير موجود")
    return {"message": "تم حذف المرفق بنجاح"}

# --- SERVICE CLIENTS ---

@router.get("/api/service-clients", response_model=List[schemas.ServiceClientResponse], include_in_schema=False)
@router.get("/api/service-clients/", response_model=List[schemas.ServiceClientResponse])
def get_service_clients(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    return crud.get_service_clients(db)

@router.post("/api/service-clients", response_model=schemas.ServiceClientResponse, include_in_schema=False)
@router.post("/api/service-clients/", response_model=schemas.ServiceClientResponse)
def create_service_client(
    client: schemas.ServiceClientCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    existing = db.query(models.ServiceClient).filter(models.ServiceClient.name == client.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="اسم العميل مسجل مسبقاً")
    db_client = crud.create_service_client(db, client)
    return {
        "id": db_client.id,
        "name": db_client.name,
        "phone": db_client.phone,
        "company": db_client.company,
        "contacts": db_client.contacts,
        "notes": db_client.notes,
        "created_at": db_client.created_at,
        "jobs_count": 0
    }

@router.put("/api/service-clients/{client_id}", response_model=schemas.ServiceClientResponse)
def update_service_client(
    client_id: int,
    client_update: schemas.ServiceClientUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    db_client = crud.update_service_client(db, client_id, client_update)
    if not db_client:
        raise HTTPException(status_code=404, detail="العميل غير موجود")
    j_count = db.query(func.count(models.ServiceJob.id)).filter(models.ServiceJob.client_name == db_client.name).scalar() or 0
    return {
        "id": db_client.id,
        "name": db_client.name,
        "phone": db_client.phone,
        "company": db_client.company,
        "contacts": db_client.contacts,
        "notes": db_client.notes,
        "created_at": db_client.created_at,
        "jobs_count": j_count
    }

@router.delete("/api/service-clients/{client_id}")
def delete_service_client(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    success = crud.delete_service_client(db, client_id)
    if not success:
        raise HTTPException(status_code=404, detail="العميل غير موجود")
    return {"message": "تم حذف العميل بنجاح"}
