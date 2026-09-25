import re
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Form
from sqlalchemy.orm import Session

import models
import schemas
import crud
from core.database import get_db
from core.permissions import get_current_user, user_has_hr_management
from services.file_service import save_uploaded_file

router = APIRouter(prefix="/api/hr", tags=["hr"])

@router.post("/requests/", response_model=schemas.HRRequestResponse)
def create_request(
    request_type: str = Form(...),
    reason: str = Form(...),
    start_date: Optional[str] = Form(None),
    end_date: Optional[str] = Form(None),
    start_time: Optional[str] = Form(None),
    end_time: Optional[str] = Form(None),
    attachment: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    attachment_url = save_uploaded_file(attachment, prefix="hr_attach")
    db_hr = crud.create_hr_request(
        db=db,
        user_id=current_user.id,
        request_type=request_type,
        reason=reason,
        start_date=start_date,
        end_date=end_date,
        start_time=start_time,
        end_time=end_time,
        attachment_url=attachment_url
    )
    try:
        user_name = current_user.full_name or current_user.username
        crud.broadcast_notification(
            db=db,
            title="طلب موارد بشرية جديد",
            message=f"قام {user_name} بتقديم طلب {request_type} (السبب: {reason})",
            notif_type="hr_request_created",
            reference_id=db_hr.id
        )
    except Exception as e:
        print(f"[NOTIF ERROR] hr_request_created: {e}")
    return db_hr

@router.get("/requests/me", response_model=List[schemas.HRRequestResponse])
def get_my_requests(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return crud.get_user_hr_requests(db, current_user.id)

@router.get("/requests/all", response_model=List[schemas.HRRequestResponse])
def get_all_requests(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    is_hr = current_user.username == 'admin' or user_has_hr_management(current_user, db)
    subordinates_count = db.query(models.User).filter(models.User.manager_id == current_user.id).count()
    is_manager = subordinates_count > 0
    
    if not is_hr and not is_manager:
        raise HTTPException(status_code=403, detail="غير مصرح لك بإدارة طلبات الموظفين")
        
    all_reqs = crud.get_all_hr_requests(db)
    if is_hr:
        return all_reqs
    else:
        return [r for r in all_reqs if r.user and r.user.manager_id == current_user.id]

@router.put("/requests/{request_id}/status", response_model=schemas.HRRequestResponse)
def change_request_status(
    request_id: int,
    payload: schemas.HRRequestStatusUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    db_req = db.query(models.HRRequest).filter(models.HRRequest.id == request_id).first()
    if not db_req:
        raise HTTPException(status_code=404, detail="الطلب غير موجود")
        
    requester = db_req.user
    requester_manager_id = requester.manager_id if requester else None
    
    is_direct_manager = (requester_manager_id is not None) and (current_user.id == requester_manager_id)
    is_hr = current_user.username == 'admin' or user_has_hr_management(current_user, db)
    
    if db_req.request_type == "سلفة":
        if not is_hr:
            raise HTTPException(status_code=403, detail="الموافقة على السلفة من صلاحيات مدير شؤون الموظفين فقط")
    else:
        if not is_direct_manager and not is_hr:
            raise HTTPException(status_code=403, detail="غير مصرح لك بتعديل حالة هذا الطلب")
        
    target_status = payload.status
    is_hierarchical = db_req.request_type in ["مغادرة", "اجازة"]
    
    if target_status == 'مرفوض':
        db_req.status = 'مرفوض'
    elif target_status == 'موافق':
        if is_hierarchical and requester_manager_id is not None:
            if is_direct_manager:
                db_req.status = 'تمت الموافقة من قبل المدير المباشر وبانتظار الموافقة من شؤون الموظفين'
            elif is_hr:
                if db_req.status == 'تمت الموافقة من قبل المدير المباشر وبانتظار الموافقة من شؤون الموظفين':
                    db_req.status = 'موافق'
                else:
                    raise HTTPException(status_code=400, detail="يجب الحصول على موافقة المدير المباشر أولاً")
        else:
            if is_hr:
                db_req.status = 'موافق'
            else:
                if is_direct_manager:
                    db_req.status = 'تمت الموافقة من قبل المدير المباشر وبانتظار الموافقة من شؤون الموظفين'
                else:
                    raise HTTPException(status_code=400, detail="لا توجد صلاحية للموافقة")
    else:
        db_req.status = target_status
        
    if db_req.status == 'موافق' and db_req.request_type == 'سلفة':
        now_str = datetime.now().strftime("%Y-%m")
        loan_amount = 0.0
        match = re.search(r"(\d+(?:\.\d+)?)", db_req.reason or "")
        if match:
            loan_amount = float(match.group(1))

        emp_sal = db.query(models.EmployeeSalary).filter(
            models.EmployeeSalary.user_id == db_req.user_id,
            models.EmployeeSalary.month == now_str
        ).first()

        basic_val = 0.0
        if requester and requester.salary:
            try:
                basic_val = float(re.sub(r"[^\d.]", "", requester.salary))
            except Exception:
                basic_val = 0.0

        social_sec = round(basic_val * 0.075, 2)

        if emp_sal:
            emp_sal.loans = (emp_sal.loans or 0.0) + loan_amount
            emp_sal.social_security_deduction = emp_sal.social_security_deduction or social_sec
            emp_sal.total = (emp_sal.basic_salary or basic_val) + (emp_sal.overtime or 0.0) - (emp_sal.social_security_deduction or social_sec) - emp_sal.loans - (emp_sal.other_deductions or 0.0)
        else:
            tot = basic_val + 0.0 - social_sec - loan_amount - 0.0
            new_sal = models.EmployeeSalary(
                user_id=db_req.user_id,
                month=now_str,
                basic_salary=basic_val,
                social_security_deduction=social_sec,
                other_deductions=0.0,
                loans=loan_amount,
                overtime=0.0,
                total=tot
            )
            db.add(new_sal)

    db.commit()
    db.refresh(db_req)

    try:
        decider_name = current_user.full_name or current_user.username
        req_owner_name = requester.full_name or requester.username if requester else "الموظف"
        crud.broadcast_notification(
            db=db,
            title="تحديث طلب موارد بشرية",
            message=f"تم تغيير حالة طلب {db_req.request_type} للموظف '{req_owner_name}' إلى: '{db_req.status}' بواسطة {decider_name}",
            notif_type="hr_request_status_changed",
            reference_id=db_req.id
        )
    except Exception as e:
        print(f"[NOTIF ERROR] hr_request_status_changed: {e}")

    return db_req

@router.post("/attendance/log", response_model=schemas.AttendanceRecordResponse)
def log_my_attendance(
    record_date: str = Form(...),
    check_in: Optional[str] = Form(None),
    check_out: Optional[str] = Form(None),
    status: str = Form("حاضر"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    return crud.log_attendance(
        db=db,
        user_id=current_user.id,
        record_date=record_date,
        check_in=check_in,
        check_out=check_out,
        status=status
    )

@router.get("/attendance/me", response_model=List[schemas.AttendanceRecordResponse])
def get_my_attendance(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return crud.get_user_attendance(db, current_user.id)

@router.delete("/requests/{request_id}")
def delete_hr_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    db_req = db.query(models.HRRequest).filter(models.HRRequest.id == request_id).first()
    if not db_req:
        raise HTTPException(status_code=404, detail="الطلب غير موجود")
        
    is_hr = current_user.username == 'admin' or user_has_hr_management(current_user, db)
    is_owner = db_req.user_id == current_user.id
    
    if is_owner:
        if db_req.status != 'قيد الانتظار' and not is_hr:
            raise HTTPException(status_code=400, detail="يمكنك حذف الطلب فقط عندما يكون في حالة قيد الانتظار")
    elif not is_hr:
        raise HTTPException(status_code=403, detail="غير مصرح لك بحذف هذا الطلب")

    db.delete(db_req)
    db.commit()
    return {"message": "تم حذف الطلب بنجاح"}
