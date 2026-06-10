from fastapi import FastAPI, Depends, HTTPException, File, UploadFile, Form, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import timedelta
import os
import shutil
import uuid
import sys

import models
import schemas
import crud
import auth
from database import SessionLocal, engine

# Recreate tables
models.Base.metadata.create_all(bind=engine)

def check_and_update_db_schema(db_engine):
    from sqlalchemy import inspect, text
    inspector = inspect(db_engine)
    
    # Check transactions table
    if "transactions" in inspector.get_table_names():
        columns = [c["name"] for c in inspector.get_columns("transactions")]
        if "user_id" not in columns:
            try:
                with db_engine.begin() as conn:
                    conn.execute(text("ALTER TABLE transactions ADD COLUMN user_id INTEGER REFERENCES users(id)"))
            except Exception as e:
                pass
        if "project_id" not in columns:
            try:
                with db_engine.begin() as conn:
                    conn.execute(text("ALTER TABLE transactions ADD COLUMN project_id INTEGER REFERENCES projects(id)"))
            except Exception as e:
                pass

    # Check reservations table
    if "reservations" in inspector.get_table_names():
        columns = [c["name"] for c in inspector.get_columns("reservations")]
        if "user_id" not in columns:
            try:
                with db_engine.begin() as conn:
                    conn.execute(text("ALTER TABLE reservations ADD COLUMN user_id INTEGER REFERENCES users(id)"))
            except Exception as e:
                pass
        if "project_id" not in columns:
            try:
                with db_engine.begin() as conn:
                    conn.execute(text("ALTER TABLE reservations ADD COLUMN project_id INTEGER REFERENCES projects(id)"))
            except Exception as e:
                pass

check_and_update_db_schema(engine)

def seed_default_departments(db: Session):
    if not db.query(models.Department).first():
        depts = [
            ("ألواح صاج", []),
            ("إكسسوارات", ["الزرافيل", "الفصالات", "ايادي", "متفرقات"]),
            ("كشفات طوب", [])
        ]
        for dept_name, sub_names in depts:
            db_dept = models.Department(name=dept_name)
            db.add(db_dept)
            db.commit()
            db.refresh(db_dept)
            for sub_name in sub_names:
                db_sub = models.SubDepartment(name=sub_name, department_id=db_dept.id)
                db.add(db_sub)
            db.commit()

# Seed default departments when starting up
db_session = SessionLocal()
try:
    seed_default_departments(db_session)
finally:
    db_session.close()

# Seed Admin User on application startup
db_seed = SessionLocal()
try:
    crud.seed_admin_user(db_seed)
finally:
    db_seed.close()

def get_base_dir():
    if getattr(sys, 'frozen', False):
        return os.path.dirname(sys.executable)
    return os.path.abspath(os.path.dirname(__file__))

BASE_DIR = get_base_dir()

# Upload directory setup
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
app = FastAPI(title="Factory ERP API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

@app.get("/api/health")
def health_check():
    return {"status": "ok"}

# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/api/debug/all-permissions")
def debug_all_permissions(db: Session = Depends(get_db)):
    """Temporary debug endpoint - shows all permissions and users in DB"""
    users = db.query(models.User).all()
    perms = db.query(models.UserPermission).all()
    return {
        "users": [{"id": u.id, "username": u.username} for u in users],
        "permissions": [{"id": p.id, "user_id": p.user_id, "department_name": p.department_name, "can_edit": p.can_edit} for p in perms]
    }

# --- AUTH ENDPOINTS ---

@app.post("/api/auth/register", response_model=schemas.UserResponse, status_code=status.HTTP_201_CREATED)
def register_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = crud.get_user_by_username(db, username=user.username)
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    return crud.create_user(db=db, user=user)

@app.post("/api/auth/token", response_model=schemas.Token)
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = crud.get_user_by_username(db, username=form_data.username)
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

# --- ADMIN PANEL USER MANAGEMENT ENDPOINTS ---

@app.get("/api/users", response_model=List[schemas.UserWithPermissionsResponse])
def list_users(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.username != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to access user accounts")
    users = crud.get_all_users(db)
    # We will return users with permissions using the UserWithPermissionsResponse schema
    return users

@app.get("/api/users/basic", response_model=List[schemas.UserResponse])
def list_users_basic(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    users = crud.get_all_users(db)
    return users

@app.put("/api/users/{user_id}", response_model=schemas.UserResponse)
def update_user_credentials(
    user_id: int,
    update_data: schemas.UserUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
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

# --- PROTECTED ITEMS ENDPOINTS ---

def check_permission(db: Session, current_user: models.User, category: str):
    if current_user.username == "admin":
        return True
    perm = db.query(models.UserPermission).filter(
        models.UserPermission.user_id == current_user.id,
        models.UserPermission.department_name == category
    ).first()
    if not perm or not perm.can_edit:
        raise HTTPException(status_code=403, detail="لا تملك صلاحية التعديل أو الإضافة في هذا القسم")
    return True

@app.post("/api/items/", response_model=schemas.Item)
def create_item(
    name: str = Form(...),
    description: Optional[str] = Form(None),
    category: str = Form(...),
    subcategory: Optional[str] = Form(None),
    quantity: int = Form(0),
    image: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    check_permission(db, current_user, category)
    
    image_url = None
    if image and image.filename:
        # Save file to uploads folder
        file_ext = os.path.splitext(image.filename)[1]
        filename = f"{uuid.uuid4()}{file_ext}"
        file_path = os.path.join(UPLOAD_DIR, filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(image.file, buffer)
        image_url = f"/uploads/{filename}"
    
    return crud.create_item(
        db=db,
        name=name,
        category=category,
        subcategory=subcategory if subcategory else None,
        quantity=quantity,
        description=description if description else None,
        image_url=image_url
    )

@app.get("/api/items/", response_model=List[schemas.Item])
def read_items(
    category: str = None, 
    subcategory: str = None, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    items = crud.get_items(db, category=category, subcategory=subcategory)
    return items

@app.delete("/api/items/{item_id}")
def delete_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    item = db.query(models.Item).filter(models.Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
        
    if current_user.username != "admin":
        raise HTTPException(status_code=403, detail="هذه الصلاحية متاحة للمسؤول (admin) فقط")
    
    success = crud.delete_item(db, item_id=item_id)
    if not success:
        raise HTTPException(status_code=400, detail="Could not delete item")
    return {"message": "Item deleted successfully"}

@app.post("/api/items/{item_id}/transactions/", response_model=schemas.TransactionResponse)
def create_transaction(
    item_id: int,
    tx: schemas.TransactionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    item = db.query(models.Item).filter(models.Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    check_permission(db, current_user, item.category)
    
    if item.quantity + tx.change < 0:
        raise HTTPException(status_code=400, detail="الكمية المطلوبة للحذف أكبر من الكمية المتوفرة في المستودع")
    
    # Pass current_user.id as user_id to document who performed the transaction
    db_tx = crud.create_transaction(
        db=db, 
        item_id=item_id, 
        change=tx.change, 
        project_name=tx.project_name, 
        project_id=tx.project_id,
        notes=tx.notes,
        user_id=current_user.id
    )
    if db_tx is None:
        raise HTTPException(status_code=404, detail="Item not found")
    return db_tx

@app.get("/api/items/{item_id}/transactions/", response_model=List[schemas.TransactionResponse])
def read_transactions(
    item_id: int, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    return crud.get_item_transactions(db, item_id=item_id)

@app.delete("/api/items/{item_id}/transactions/last", response_model=schemas.Item)
def delete_last_transaction(
    item_id: int, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    item = db.query(models.Item).filter(models.Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    check_permission(db, current_user, item.category)
    
    updated_item = crud.delete_last_transaction(db, item_id=item_id)
    if updated_item is None:
        raise HTTPException(status_code=404, detail="No transactions found to revert or item not found")
    return updated_item

@app.put("/api/items/{item_id}/image", response_model=schemas.Item)
def update_item_image(
    item_id: int,
    image: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.username != "admin":
        raise HTTPException(status_code=403, detail="هذه الصلاحية متاحة للمسؤول (admin) فقط")

    item = db.query(models.Item).filter(models.Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    image_url = None
    if image and image.filename:
        file_ext = os.path.splitext(image.filename)[1]
        filename = f"{uuid.uuid4()}{file_ext}"
        file_path = os.path.join(UPLOAD_DIR, filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(image.file, buffer)
        image_url = f"/uploads/{filename}"
    else:
        raise HTTPException(status_code=400, detail="Invalid image file")
        
    updated_item = crud.update_item_image(db, item_id=item_id, image_url=image_url)
    if updated_item is None:
        raise HTTPException(status_code=404, detail="Item not found")
    return updated_item

@app.put("/api/items/{item_id}/description", response_model=schemas.Item)
def update_item_description(
    item_id: int,
    update_data: schemas.ItemDescriptionUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.username != "admin":
        raise HTTPException(status_code=403, detail="هذه الصلاحية متاحة للمسؤول (admin) فقط")
        
    item = db.query(models.Item).filter(models.Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    updated_item = crud.update_item_info(
        db, 
        item_id=item_id, 
        description=update_data.description
    )
    if updated_item is None:
        raise HTTPException(status_code=404, detail="Item not found")
    return updated_item

@app.put("/api/items/{item_id}/info", response_model=schemas.Item)
def update_item_info(
    item_id: int,
    update_data: schemas.ItemUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.username != "admin":
        raise HTTPException(status_code=403, detail="هذه الصلاحية متاحة للمسؤول (admin) فقط")
        
    item = db.query(models.Item).filter(models.Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    updated_item = crud.update_item_info(
        db, 
        item_id=item_id, 
        name=update_data.name, 
        description=update_data.description
    )
    if updated_item is None:
        raise HTTPException(status_code=404, detail="Item not found")
    return updated_item

@app.post("/api/items/{item_id}/reservations/", response_model=schemas.ReservationResponse)
def create_item_reservation(
    item_id: int,
    res: schemas.ReservationCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    item = db.query(models.Item).filter(models.Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    check_permission(db, current_user, item.category)
    
    try:
        db_res = crud.create_reservation(
            db=db,
            item_id=item_id,
            quantity=res.quantity,
            project_name=res.project_name,
            user_id=current_user.id,
            project_id=res.project_id
        )
        if db_res is None:
            raise HTTPException(status_code=404, detail="Item not found")
        return db_res
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/items/{item_id}/reservations/", response_model=List[schemas.ReservationResponse])
def read_item_reservations(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    return crud.get_item_reservations(db, item_id=item_id)

@app.delete("/api/reservations/{reservation_id}")
def delete_item_reservation(
    reservation_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    db_res = db.query(models.Reservation).filter(models.Reservation.id == reservation_id).first()
    if not db_res:
        raise HTTPException(status_code=404, detail="Reservation not found")
    item = db.query(models.Item).filter(models.Item.id == db_res.item_id).first()
    if item:
        check_permission(db, current_user, item.category)
        
    success = crud.delete_reservation(db, reservation_id=reservation_id)
    if not success:
        raise HTTPException(status_code=404, detail="Reservation not found")
    return {"message": "Reservation deleted successfully"}

# --- DEPARTMENTS & PERMISSIONS ENDPOINTS ---

@app.get("/api/departments/", response_model=List[schemas.DepartmentResponse])
def read_departments(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    return crud.get_departments(db)

@app.post("/api/departments/", response_model=schemas.DepartmentResponse)
def create_department(dept: schemas.DepartmentCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if current_user.username != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    return crud.create_department(db, name=dept.name)

@app.delete("/api/departments/{department_id}")
def delete_department(department_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if current_user.username != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    try:
        success = crud.delete_department(db, department_id=department_id)
        if not success:
            raise HTTPException(status_code=404, detail="Department not found")
        return {"message": "Deleted successfully"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/departments/{department_id}/sub/", response_model=schemas.SubDepartmentResponse)
def create_subdepartment(department_id: int, sub: schemas.SubDepartmentCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if current_user.username != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    return crud.create_subdepartment(db, department_id=department_id, name=sub.name)

@app.delete("/api/subdepartments/{subdepartment_id}")
def delete_subdepartment(subdepartment_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if current_user.username != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    try:
        success = crud.delete_subdepartment(db, subdepartment_id=subdepartment_id)
        if not success:
            raise HTTPException(status_code=404, detail="SubDepartment not found")
        return {"message": "Deleted successfully"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/users/me/permissions", response_model=List[schemas.UserPermissionResponse])
def get_my_permissions(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if current_user.username == "admin":
        # Admin has permission to everything. We can just return a wildcard or the frontend knows admin is admin
        return []
    return crud.get_user_permissions(db, current_user.id)

@app.get("/api/users/{user_id}/permissions", response_model=List[schemas.UserPermissionResponse])
def get_user_permissions(user_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if current_user.username != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    return crud.get_user_permissions(db, user_id)

@app.post("/api/users/{user_id}/permissions/", response_model=schemas.UserPermissionResponse)
def set_permission(user_id: int, perm: schemas.UserPermissionCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if current_user.username != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    return crud.set_user_permission(db, user_id=user_id, department_name=perm.department_name, can_edit=perm.can_edit)

@app.delete("/api/users/{user_id}/permissions/{department_name}")
def remove_permission(user_id: int, department_name: str, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if current_user.username != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    success = crud.remove_user_permission(db, user_id=user_id, department_name=department_name)
    if not success:
        raise HTTPException(status_code=404, detail="Permission not found")
    return {"message": "Deleted successfully"}

# --- PROJECTS ENDPOINTS ---

@app.post("/api/projects/", response_model=schemas.ProjectResponse)
def create_project(project: schemas.ProjectCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    return crud.create_project(db, project)

@app.get("/api/projects/", response_model=List[schemas.ProjectResponse])
def get_projects(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    return crud.get_projects(db)

@app.get("/api/projects/{project_id}", response_model=schemas.ProjectResponse)
def get_project(project_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    project = crud.get_project_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

@app.put("/api/projects/{project_id}", response_model=schemas.ProjectResponse)
def update_project(project_id: int, project_update: schemas.ProjectUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    project = crud.update_project(db, project_id, project_update)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

@app.delete("/api/projects/{project_id}")
def delete_project(project_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if current_user.username != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    success = crud.delete_project(db, project_id)
    if not success:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"message": "Deleted successfully"}

@app.post("/api/projects/{project_id}/details/", response_model=schemas.ProjectDetailResponse)
def create_project_detail(project_id: int, detail: schemas.ProjectDetailCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    return crud.create_project_detail(db, project_id, detail)

@app.delete("/api/projects/details/{detail_id}")
def delete_project_detail(detail_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    success = crud.delete_project_detail(db, detail_id)
    if not success:
        raise HTTPException(status_code=404, detail="Detail not found")
    return {"message": "Deleted successfully"}

@app.post("/api/projects/{project_id}/attachments/", response_model=schemas.ProjectAttachmentResponse)
def create_project_attachment(project_id: int, file: UploadFile = File(...), db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if file and file.filename:
        file_ext = os.path.splitext(file.filename)[1]
        filename = f"{uuid.uuid4()}{file_ext}"
        file_path = os.path.join(UPLOAD_DIR, filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        file_url = f"/uploads/{filename}"
        return crud.create_project_attachment(db, project_id, file.filename, file_url)
    raise HTTPException(status_code=400, detail="Invalid file")

@app.delete("/api/projects/attachments/{attachment_id}")
def delete_project_attachment(attachment_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    success = crud.delete_project_attachment(db, attachment_id)
    if not success:
        raise HTTPException(status_code=404, detail="Attachment not found")
    return {"message": "Deleted successfully"}

@app.post("/api/projects/{project_id}/tasks/", response_model=schemas.ProjectTaskResponse)
def create_project_task(project_id: int, task: schemas.ProjectTaskCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    project = crud.get_project_by_id(db, project_id)
    if not project or (project.executive_manager_id != current_user.id and current_user.username != "admin"):
        raise HTTPException(status_code=403, detail="Not authorized to add tasks for this project")
    return crud.create_project_task(db, task, project_id, current_user.id)

@app.put("/api/projects/tasks/{task_id}", response_model=schemas.ProjectTaskResponse)
def update_project_task(task_id: int, task_update: schemas.ProjectTaskUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    task = db.query(models.ProjectTask).filter(models.ProjectTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # allow executive manager, admin, or the assignee to update
    project = crud.get_project_by_id(db, task.project_id)
    is_exec_manager = project and project.executive_manager_id == current_user.id
    is_assignee = task.assigned_to == current_user.id
    
    if not (is_exec_manager or is_assignee or current_user.username == "admin"):
        raise HTTPException(status_code=403, detail="Not authorized to update this task")
        
    return crud.update_project_task(db, task_id, task_update)

@app.delete("/api/projects/tasks/{task_id}")
def delete_project_task(task_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    task = db.query(models.ProjectTask).filter(models.ProjectTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
        
    project = crud.get_project_by_id(db, task.project_id)
    if project and project.executive_manager_id != current_user.id and current_user.username != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to delete tasks")
        
    success = crud.delete_project_task(db, task_id)
    return {"message": "Deleted successfully"}

# Serve frontend files
def get_frontend_dir():
    if getattr(sys, 'frozen', False):
        # PyInstaller extracts bundled data files to a temporary folder sys._MEIPASS
        return os.path.join(sys._MEIPASS, "frontend")
    return os.path.abspath(os.path.join(os.path.dirname(__file__), "frontend"))

frontend_dir = get_frontend_dir()
app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")
