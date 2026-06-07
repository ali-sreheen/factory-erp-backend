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
                print("Added column user_id to transactions table successfully.")
            except Exception as e:
                print(f"Error adding user_id to transactions table: {e}")

    # Check reservations table
    if "reservations" in inspector.get_table_names():
        columns = [c["name"] for c in inspector.get_columns("reservations")]
        if "user_id" not in columns:
            try:
                with db_engine.begin() as conn:
                    conn.execute(text("ALTER TABLE reservations ADD COLUMN user_id INTEGER REFERENCES users(id)"))
                print("Added column user_id to reservations table successfully.")
            except Exception as e:
                print(f"Error adding user_id to reservations table: {e}")

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

@app.get("/api/users/", response_model=List[schemas.UserWithPermissionsResponse])
def list_users(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.username != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to access user accounts")
    users = crud.get_all_users(db)
    # We will return users with permissions using the UserWithPermissionsResponse schema
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
    
    # Pass current_user.id as user_id to document who performed the transaction
    db_tx = crud.create_transaction(
        db=db, 
        item_id=item_id, 
        change=tx.change, 
        project_name=tx.project_name, 
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
    item = db.query(models.Item).filter(models.Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    check_permission(db, current_user, item.category)
    
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
    item = db.query(models.Item).filter(models.Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    check_permission(db, current_user, item.category)
    
    updated_item = crud.update_item_description(db, item_id=item_id, description=update_data.description)
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
            user_id=current_user.id
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

@app.get("/api/users/me/permissions", response_model=List[schemas.UserPermissionResponse])
def get_my_permissions(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if current_user.username == "admin":
        # Admin has permission to everything. We can just return a wildcard or the frontend knows admin is admin
        return []
    return crud.get_user_permissions(db, current_user.id)

# Serve frontend files
def get_frontend_dir():
    if getattr(sys, 'frozen', False):
        # PyInstaller extracts bundled data files to a temporary folder sys._MEIPASS
        return os.path.join(sys._MEIPASS, "frontend")
    return os.path.abspath(os.path.join(os.path.dirname(__file__), "frontend"))

frontend_dir = get_frontend_dir()
app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")
