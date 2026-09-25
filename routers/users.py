from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Form
from sqlalchemy.orm import Session
import models
import schemas
import crud
from core.database import get_db
from core.permissions import get_current_user, user_has_hr_management
from services.file_service import save_uploaded_file

router = APIRouter(prefix="/api/users", tags=["users"])

@router.get("", response_model=List[schemas.UserWithPermissionsResponse])
def list_users(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.username != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to access user accounts")
    return crud.get_all_users(db)

@router.get("/basic", response_model=List[schemas.UserResponse])
def list_users_basic(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    users = crud.get_all_users(db)
    is_hr = current_user.username == "admin" or user_has_hr_management(current_user, db)
    
    result = []
    for u in users:
        u_dict = {
            "id": u.id,
            "username": u.username,
            "is_approved": u.is_approved,
            "full_name": u.full_name,
            "job_title": u.job_title,
            "employment_id": u.employment_id,
            "department": u.department,
            "avatar_url": u.avatar_url,
            "manager_id": u.manager_id,
            "manager": u.manager,
            "allowed_holidays": u.allowed_holidays,
            "salary": u.salary if (is_hr or u.id == current_user.id) else None
        }
        result.append(u_dict)
    return result

@router.get("/me", response_model=schemas.UserResponse)
def get_current_user_profile(current_user: models.User = Depends(get_current_user)):
    return current_user

@router.get("/me/permissions", response_model=List[schemas.UserPermissionResponse])
def get_my_permissions(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.username == "admin":
        return []
    return crud.get_user_permissions(db, current_user.id)

@router.put("/me/profile", response_model=schemas.UserResponse)
def update_my_profile(
    full_name: str = Form(...),
    job_title: str = Form(...),
    employment_id: str = Form(...),
    department: str = Form(...),
    avatar: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if not (current_user.username == 'admin' or user_has_hr_management(current_user, db)):
        raise HTTPException(status_code=403, detail="لا يمكن للموظفين تعديل ملفهم الشخصي مباشرة. يرجى التواصل مع إدارة شؤون الموظفين.")
        
    avatar_url = save_uploaded_file(avatar, prefix="avatar")
    if not avatar_url:
        avatar_url = current_user.avatar_url

    return crud.update_user_profile(
        db=db,
        user_id=current_user.id,
        full_name=full_name,
        job_title=job_title,
        employment_id=employment_id,
        department=department,
        avatar_url=avatar_url
    )

@router.get("/{user_id}/permissions", response_model=List[schemas.UserPermissionResponse])
def get_user_permissions(user_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.username != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    return crud.get_user_permissions(db, user_id)

@router.post("/{user_id}/permissions/", response_model=schemas.UserPermissionResponse)
def set_permission(user_id: int, perm: schemas.UserPermissionCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.username != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    return crud.set_user_permission(db, user_id=user_id, department_name=perm.department_name, can_edit=perm.can_edit)

@router.delete("/{user_id}/permissions/{department_name}")
def remove_permission(user_id: int, department_name: str, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.username != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    success = crud.remove_user_permission(db, user_id=user_id, department_name=department_name)
    if not success:
        raise HTTPException(status_code=404, detail="Permission not found")
    return {"message": "Deleted successfully"}

@router.put("/{user_id}", response_model=schemas.UserResponse)
def update_user_credentials(
    user_id: int,
    update_data: schemas.UserUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.username != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to edit user accounts")
        
    db_user = crud.update_user(
        db=db, 
        user_id=user_id, 
        username=update_data.username, 
        password=update_data.password
    )
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return db_user

@router.put("/{user_id}/toggle-approval")
def toggle_user_approval(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.username != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to manage user approvals")
        
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")
        
    if db_user.username == "admin":
        raise HTTPException(status_code=400, detail="Cannot toggle approval for admin account")
        
    db_user.is_approved = 1 if db_user.is_approved == 0 else 0
    db.commit()
    db.refresh(db_user)
    return {"status": "success", "is_approved": db_user.is_approved}

@router.delete("/{user_id}")
def delete_user_account(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.username != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to delete user accounts")
        
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")
        
    if db_user.username == "admin":
        raise HTTPException(status_code=400, detail="Cannot delete admin account")
        
    db.query(models.UserPermission).filter(models.UserPermission.user_id == user_id).delete()
    db.query(models.Project).filter(models.Project.executive_manager_id == user_id).update({"executive_manager_id": None})
    try:
        db.query(models.Transaction).filter(models.Transaction.user_id == user_id).update({"user_id": None})
    except Exception:
        pass
    try:
        db.query(models.Reservation).filter(models.Reservation.user_id == user_id).update({"user_id": None})
    except Exception:
        pass
        
    db.delete(db_user)
    db.commit()
    return {"message": "User deleted successfully"}

@router.put("/{user_id}/profile-admin", response_model=schemas.UserResponse)
def update_employee_profile_admin(
    user_id: int,
    full_name: str = Form(...),
    job_title: str = Form(...),
    employment_id: str = Form(...),
    department: str = Form(...),
    salary: Optional[str] = Form(None),
    manager_id: Optional[int] = Form(None),
    allowed_holidays: Optional[int] = Form(21),
    avatar: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if not (current_user.username == 'admin' or user_has_hr_management(current_user, db)):
        raise HTTPException(status_code=403, detail="غير مصرح بتعديل ملفات الموظفين")
        
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="المستخدم غير موجود")
        
    avatar_url = save_uploaded_file(avatar, prefix="avatar")
    if not avatar_url:
        avatar_url = db_user.avatar_url
        
    return crud.update_user_profile_admin(
        db=db,
        user_id=user_id,
        full_name=full_name,
        job_title=job_title,
        employment_id=employment_id,
        department=department,
        salary=salary,
        manager_id=manager_id,
        allowed_holidays=allowed_holidays,
        avatar_url=avatar_url
    )

@router.get("/{user_id}/vacations", response_model=List[schemas.EmployeeVacationDayResponse])
def get_user_vacations(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    is_hr = current_user.username == 'admin' or user_has_hr_management(current_user, db)
    if not is_hr and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="غير مصرح بعرض إجازات هذا الموظف")
    return crud.get_employee_vacation_days(db, user_id=user_id)

@router.post("/{user_id}/vacations", response_model=schemas.EmployeeVacationDayResponse)
def add_user_vacation(
    user_id: int,
    vacation: schemas.EmployeeVacationDayCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if not (current_user.username == 'admin' or user_has_hr_management(current_user, db)):
        raise HTTPException(status_code=403, detail="غير مصرح بإضافة إجازات للموظفين")
    return crud.add_employee_vacation_day(db, user_id=user_id, vacation_date=vacation.vacation_date, notes=vacation.notes)

@router.delete("/vacations/{vacation_day_id}")
def delete_user_vacation(
    vacation_day_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if not (current_user.username == 'admin' or user_has_hr_management(current_user, db)):
        raise HTTPException(status_code=403, detail="غير مصرح بحذف إجازات الموظفين")
    success = crud.delete_employee_vacation_day(db, vacation_day_id=vacation_day_id)
    if not success:
        raise HTTPException(status_code=404, detail="يوم الإجازة غير موجود")
    return {"status": "success", "message": "تم حذف يوم الإجازة بنجاح"}

@router.get("/{user_id}/salaries", response_model=List[schemas.EmployeeSalaryResponse])
def get_user_salaries(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    is_hr = current_user.username == 'admin' or user_has_hr_management(current_user, db)
    if not is_hr and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="غير مصرح بعرض رواتب هذا الموظف")
    return crud.get_employee_salaries(db, user_id=user_id)

@router.post("/{user_id}/salaries", response_model=schemas.EmployeeSalaryResponse)
def add_or_update_user_salary(
    user_id: int,
    salary: schemas.EmployeeSalaryCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if not (current_user.username == 'admin' or user_has_hr_management(current_user, db)):
        raise HTTPException(status_code=403, detail="غير مصرح بتعديل رواتب الموظفين")
    return crud.add_or_update_employee_salary(db, user_id=user_id, salary_data=salary)

@router.delete("/salaries/{salary_id}")
def delete_user_salary(
    salary_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if not (current_user.username == 'admin' or user_has_hr_management(current_user, db)):
        raise HTTPException(status_code=403, detail="غير مصرح بحذف رواتب الموظفين")
    success = crud.delete_employee_salary(db, salary_id=salary_id)
    if not success:
        raise HTTPException(status_code=404, detail="سجل الراتب غير موجود")
    return {"status": "success", "message": "تم حذف سجل الراتب بنجاح"}
