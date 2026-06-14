from fastapi import FastAPI, Depends, HTTPException, File, UploadFile, Form, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import func
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

    # Check projects table
    if "projects" in inspector.get_table_names():
        columns = [c["name"] for c in inspector.get_columns("projects")]
        for col in ["notes", "manufacturing_type", "installation_type", 
                    "step_design", "step_cutting", "step_forming", 
                    "step_assembly", "step_painting", "step_accessories", "step_installation"]:
            if col not in columns:
                try:
                    with db_engine.begin() as conn:
                        conn.execute(text(f"ALTER TABLE projects ADD COLUMN {col} VARCHAR DEFAULT 'لم يتم البدء'"))
                except Exception as e:
                    pass
        if "expected_completion_date" not in columns:
            try:
                with db_engine.begin() as conn:
                    conn.execute(text("ALTER TABLE projects ADD COLUMN expected_completion_date TIMESTAMP WITH TIME ZONE"))
            except Exception as e:
                try:
                    with db_engine.begin() as conn:
                        conn.execute(text("ALTER TABLE projects ADD COLUMN expected_completion_date DATETIME"))
                except Exception as ex:
                    pass

    # Check purchase_requests table
    if "purchase_requests" in inspector.get_table_names():
        columns = [c["name"] for c in inspector.get_columns("purchase_requests")]
        if "attached_image_url" not in columns:
            try:
                with db_engine.begin() as conn:
                    conn.execute(text("ALTER TABLE purchase_requests ADD COLUMN attached_image_url VARCHAR"))
            except Exception as e:
                pass


    # Check project_details table
    if "project_details" in inspector.get_table_names():
        columns = [c["name"] for c in inspector.get_columns("project_details")]
        for col in ["architrave", "architrave_2", "under_tile", "notes", "direction", "hinges", "qashatah", "raddad", "hinges_count"]:
            if col not in columns:
                try:
                    with db_engine.begin() as conn:
                        if col == "qashatah" or col == "raddad":
                            conn.execute(text(f"ALTER TABLE project_details ADD COLUMN {col} VARCHAR DEFAULT 'NO'"))
                        elif col == "hinges_count":
                            conn.execute(text(f"ALTER TABLE project_details ADD COLUMN {col} INTEGER DEFAULT 4"))
                        else:
                            conn.execute(text(f"ALTER TABLE project_details ADD COLUMN {col} VARCHAR"))
                except Exception as e:
                    pass
        if "quantity" not in columns:
            try:
                with db_engine.begin() as conn:
                    conn.execute(text("ALTER TABLE project_details ADD COLUMN quantity INTEGER DEFAULT 1"))
            except Exception as e:
                pass

    # Check items table for position column
    if "items" in inspector.get_table_names():
        columns = [c["name"] for c in inspector.get_columns("items")]
        if "position" not in columns:
            try:
                with db_engine.begin() as conn:
                    conn.execute(text("ALTER TABLE items ADD COLUMN position INTEGER DEFAULT 0"))
            except Exception as e:
                pass

    # Fix items subcategories if they are invalid for their category
    if "items" in inspector.get_table_names() and "departments" in inspector.get_table_names() and "subdepartments" in inspector.get_table_names():
        try:
            with db_engine.begin() as conn:
                # Get all departments and their subdepartments
                res_depts = conn.execute(text("SELECT id, name FROM departments")).fetchall()
                for d_id, d_name in res_depts:
                    # Get valid subdepartments
                    res_subs = conn.execute(text("SELECT name FROM subdepartments WHERE department_id = :d_id"), {"d_id": d_id}).fetchall()
                    valid_subs = {r[0] for r in res_subs}
                    
                    # Get items under this category
                    items = conn.execute(text("SELECT id, name, subcategory FROM items WHERE category = :cat"), {"cat": d_name}).fetchall()
                    for item_id, item_name, subcat in items:
                        if subcat and subcat.strip() != "" and subcat not in valid_subs:
                            print(f"[SCHEMA FIX] Fixing item '{item_name}' (ID: {item_id}): subcategory '{subcat}' is invalid for category '{d_name}'. Resetting to NULL.")
                            conn.execute(text("UPDATE items SET subcategory = NULL WHERE id = :item_id"), {"item_id": item_id})
        except Exception as e:
            print(f"[SCHEMA FIX] Error fixing invalid item subcategories: {e}")

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

# Seed default departments, project options, and sheet sizes when starting up
db_session = SessionLocal()
try:
    seed_default_departments(db_session)
    crud.seed_default_project_options(db_session)
    crud.seed_default_sheet_sizes(db_session)
finally:
    db_session.close()

# Seed Admin User on application startup
db_seed = SessionLocal()
try:
    try:
        from sqlalchemy import text
        try:
            db_seed.execute(text("SELECT sku FROM items LIMIT 1"))
        except Exception as e:
            db_seed.rollback()
            print("Running migration: adding sku column to items...")
            db_seed.execute(text("ALTER TABLE items ADD COLUMN sku VARCHAR(7)"))
            db_seed.commit()
            
            try:
                db_seed.execute(text("CREATE UNIQUE INDEX ix_items_sku ON items (sku)"))
                db_seed.commit()
            except Exception:
                db_seed.rollback()
            
            import models
            items = db_seed.query(models.Item).filter(models.Item.sku == None).all()
            if items:
                print(f"Migrating {len(items)} items to have SKU...")
                depts = {d.name: d.id for d in db_seed.query(models.Department).all()}
                subdepts = {s.name: s.id for s in db_seed.query(models.SubDepartment).all()}
                seq_counters = {}
                for item in items:
                    dept_id = depts.get(item.category, 0)
                    subdept_id = subdepts.get(item.subcategory, 0) if item.subcategory else 0
                    key = (dept_id, subdept_id)
                    seq_counters[key] = seq_counters.get(key, 0) + 1
                    seq = seq_counters[key]
                    item.sku = f"{dept_id % 100:02d}{subdept_id % 100:02d}{seq % 1000:03d}"
                db_seed.commit()
                print("Migration complete!")
    except Exception as e:
        db_seed.rollback()
        print(f"Global migration error: {e}")
        
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

@app.put("/api/items/reorder")
def reorder_items(
    item_ids: List[int],
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if not item_ids:
        return {"message": "No items provided"}
    
    items = db.query(models.Item).filter(models.Item.id.in_(item_ids)).all()
    categories = {item.category for item in items}
    for category in categories:
        check_permission(db, current_user, category)
        
    for index, item_id in enumerate(item_ids):
        db.query(models.Item).filter(models.Item.id == item_id).update({"position": index})
    db.commit()
    return {"message": "Reordered successfully"}


@app.put("/api/items/{item_id}/move", response_model=schemas.Item)
def move_item(
    item_id: int,
    move_data: schemas.ItemMove,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.username != "admin":
        raise HTTPException(status_code=403, detail="غير مصرح لك بنقل البنود")
        
    updated_item = crud.move_item(
        db,
        item_id=item_id,
        new_category=move_data.new_category,
        new_subcategory=move_data.new_subcategory,
        user_id=current_user.id
    )
    if not updated_item:
        raise HTTPException(status_code=404, detail="Item not found")
    return updated_item

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

@app.get("/api/users/me", response_model=schemas.UserResponse)
def get_current_user_profile(current_user: models.User = Depends(auth.get_current_user)):
    return current_user

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
    existing = crud.get_project_by_id(db, project_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Project not found")
        
    if current_user.username != "admin" and current_user.id != existing.executive_manager_id:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    project = crud.update_project(db, project_id, project_update)
    return project

@app.delete("/api/projects/{project_id}")
def delete_project(project_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    project = crud.get_project_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    if current_user.username != "admin" and current_user.id != project.executive_manager_id:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    try:
        success = crud.delete_project(db, project_id)
        if not success:
            raise HTTPException(status_code=404, detail="Project not found")
        return {"message": "Deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Database error: {str(e)}")

from sheet_calculator import calculate_sheets

@app.get("/api/projects/{project_id}/sheet-requirements")
def get_sheet_requirements(project_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    project = crud.get_project_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    details_dicts = []
    for detail in project.details:
        details_dicts.append({
            "height": detail.height,
            "width": detail.width,
            "depth": detail.depth,
            "architrave": detail.architrave,
            "architrave_2": detail.architrave_2,
            "under_tile": detail.under_tile,
            "quantity": detail.quantity
        })
        
    return calculate_sheets(db, details_dicts, project.manufacturing_type or "")

def perform_reserve_check(db: Session, project: models.Project, category: str):
    items_list = []
    
    if category == "sheets":
        # 1. Calculate sheet requirements using calculate_sheets
        details_dicts = []
        for detail in project.details:
            details_dicts.append({
                "height": detail.height,
                "width": detail.width,
                "depth": detail.depth,
                "architrave": detail.architrave,
                "architrave_2": detail.architrave_2,
                "under_tile": detail.under_tile,
                "quantity": detail.quantity
            })
        calc_res = calculate_sheets(db, details_dicts, project.manufacturing_type or "")
        
        # 2. Map calculated sheets to items in the database by SKU
        for thickness_key, thickness_val in [("thickness_1_5", 1.5), ("thickness_1_2", 1.2)]:
            for req in calc_res.get(thickness_key, []):
                size_str = req["size"]
                count = req["count"]
                
                # Parse size
                try:
                    parts = size_str.split("*")
                    w_val = float(parts[0])
                    h_val = float(parts[1])
                except (ValueError, IndexError):
                    w_val = 0.0
                    h_val = 0.0
                
                # Match to SheetSize
                sheet_size = db.query(models.SheetSize).filter(
                    models.SheetSize.thickness == thickness_val,
                    func.abs(models.SheetSize.width - w_val) < 0.1,
                    func.abs(models.SheetSize.height - h_val) < 0.1
                ).first()
                
                sku = sheet_size.sku if sheet_size else None
                item = None
                if sku:
                    item = db.query(models.Item).filter(models.Item.sku == sku).first()
                
                # Determine status
                name = f"لوح صاج {thickness_val} ملم ({size_str})"
                if not sku:
                    status = "NO_SKU"
                elif not item:
                    status = "NO_ITEM"
                else:
                    # Calculate available quantity: total physical stock minus all reservations
                    reserved_sum = sum(res.quantity for res in item.reservations)
                    available = max(0, item.quantity - reserved_sum)
                    if available >= count:
                        status = "OK"
                    else:
                        status = "INSUFFICIENT_STOCK"
                
                available_qty = 0
                if item:
                    reserved_sum = sum(res.quantity for res in item.reservations)
                    available_qty = max(0, item.quantity - reserved_sum)
                
                missing = max(0, count - available_qty)
                
                items_list.append({
                    "name": name,
                    "sku": sku,
                    "required": count,
                    "available": available_qty,
                    "status": status,
                    "missing": missing,
                    "item_id": item.id if item else None,
                    "category": "sheets",
                    "thickness": thickness_val,
                    "size": size_str
                })
                
    elif category in ["accessories", "locks", "hinges"]:
        # 1. Aggregate locks and hinges required across all details
        lock_reqs = {}
        hinge_reqs = {}
        for detail in project.details:
            qty = detail.quantity if detail.quantity is not None else 1
            if detail.lock_type:
                lock_reqs[detail.lock_type] = lock_reqs.get(detail.lock_type, 0) + qty
            if detail.hinges:
                h_cnt = detail.hinges_count if (detail.hinges_count is not None) else 4
                hinge_reqs[detail.hinges] = hinge_reqs.get(detail.hinges, 0) + (qty * h_cnt)
                
        # 2. Map and check locks
        if category in ["accessories", "locks"]:
            for lock_name, count in lock_reqs.items():
                option = db.query(models.ProjectOption).filter(
                    models.ProjectOption.option_type == "lock",
                    models.ProjectOption.name == lock_name
                ).first()
                
                sku = option.sku if option else None
                item = None
                if sku:
                    item = db.query(models.Item).filter(models.Item.sku == sku).first()
                    
                # Determine status
                name = f"قفل: {lock_name}"
                if not sku:
                    status = "NO_SKU"
                elif not item:
                    status = "NO_ITEM"
                else:
                    reserved_sum = sum(res.quantity for res in item.reservations)
                    available = max(0, item.quantity - reserved_sum)
                    if available >= count:
                        status = "OK"
                    else:
                        status = "INSUFFICIENT_STOCK"
                        
                available_qty = 0
                if item:
                    reserved_sum = sum(res.quantity for res in item.reservations)
                    available_qty = max(0, item.quantity - reserved_sum)
                    
                missing = max(0, count - available_qty)
                
                items_list.append({
                    "name": name,
                    "sku": sku,
                    "required": count,
                    "available": available_qty,
                    "status": status,
                    "missing": missing,
                    "item_id": item.id if item else None,
                    "category": "locks",
                    "option_type": "lock"
                })
                
        # 3. Map and check hinges
        if category in ["accessories", "hinges"]:
            for hinge_name, count in hinge_reqs.items():
                option = db.query(models.ProjectOption).filter(
                    models.ProjectOption.option_type == "hinge",
                    models.ProjectOption.name == hinge_name
                ).first()
                
                sku = option.sku if option else None
                item = None
                if sku:
                    item = db.query(models.Item).filter(models.Item.sku == sku).first()
                    
                # Determine status
                name = f"فصالة: {hinge_name}"
                if not sku:
                    status = "NO_SKU"
                elif not item:
                    status = "NO_ITEM"
                else:
                    reserved_sum = sum(res.quantity for res in item.reservations)
                    available = max(0, item.quantity - reserved_sum)
                    if available >= count:
                        status = "OK"
                    else:
                        status = "INSUFFICIENT_STOCK"
                        
                available_qty = 0
                if item:
                    reserved_sum = sum(res.quantity for res in item.reservations)
                    available_qty = max(0, item.quantity - reserved_sum)
                    
                missing = max(0, count - available_qty)
                
                items_list.append({
                    "name": name,
                    "sku": sku,
                    "required": count,
                    "available": available_qty,
                    "status": status,
                    "missing": missing,
                    "item_id": item.id if item else None,
                    "category": "hinges",
                    "option_type": "hinge"
                })
            
    has_issues = any(i["status"] in ["NO_SKU", "NO_ITEM", "INSUFFICIENT_STOCK"] for i in items_list)
    return {
        "items": items_list,
        "has_issues": has_issues
    }

@app.get("/api/projects/{project_id}/reserve-check")
def reserve_check(
    project_id: int,
    category: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    project = crud.get_project_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Check permission (Only admin or executive manager can perform this)
    if current_user.username != "admin" and current_user.id != project.executive_manager_id:
        raise HTTPException(status_code=403, detail="Not authorized to perform reservations for this project")
        
    if category not in ["sheets", "accessories", "locks", "hinges"]:
        raise HTTPException(status_code=400, detail="Invalid category. Must be 'sheets', 'accessories', 'locks' or 'hinges'")
        
    # Check if already reserved
    already_reserved = False
    if category == "sheets":
        existing_res = db.query(models.Reservation).join(models.Item).filter(
            models.Reservation.project_id == project_id,
            models.Item.category == "ألواح صاج"
        ).first()
        if existing_res:
            already_reserved = True
    elif category == "locks":
        lock_skus = [opt.sku for opt in db.query(models.ProjectOption).filter(models.ProjectOption.option_type == "lock") if opt.sku]
        if lock_skus:
            existing_res = db.query(models.Reservation).join(models.Item).filter(
                models.Reservation.project_id == project_id,
                models.Item.sku.in_(lock_skus)
            ).first()
            if existing_res:
                already_reserved = True
    elif category == "hinges":
        hinge_skus = [opt.sku for opt in db.query(models.ProjectOption).filter(models.ProjectOption.option_type == "hinge") if opt.sku]
        if hinge_skus:
            existing_res = db.query(models.Reservation).join(models.Item).filter(
                models.Reservation.project_id == project_id,
                models.Item.sku.in_(hinge_skus)
            ).first()
            if existing_res:
                already_reserved = True
    elif category == "accessories":
        existing_res = db.query(models.Reservation).join(models.Item).filter(
            models.Reservation.project_id == project_id,
            models.Item.category == "إكسسوارات"
        ).first()
        if existing_res:
            already_reserved = True
            
    res_data = perform_reserve_check(db, project, category)
    res_data["already_reserved"] = already_reserved
    return res_data

@app.post("/api/projects/{project_id}/reserve-commit")
def reserve_commit(
    project_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    project = crud.get_project_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    # Check permission
    if current_user.username != "admin" and current_user.id != project.executive_manager_id:
        raise HTTPException(status_code=403, detail="Not authorized to commit reservations for this project")
        
    category = payload.get("category")
    if category not in ["sheets", "accessories", "locks", "hinges"]:
        raise HTTPException(status_code=400, detail="Invalid category")
        
    # Check if already reserved
    already_reserved = False
    error_msg = ""
    if category == "sheets":
        existing_res = db.query(models.Reservation).join(models.Item).filter(
            models.Reservation.project_id == project_id,
            models.Item.category == "ألواح صاج"
        ).first()
        if existing_res:
            already_reserved = True
            error_msg = "لقد تم حجز ألواح صاج لهذا المشروع بالفعل"
    elif category == "locks":
        lock_skus = [opt.sku for opt in db.query(models.ProjectOption).filter(models.ProjectOption.option_type == "lock") if opt.sku]
        if lock_skus:
            existing_res = db.query(models.Reservation).join(models.Item).filter(
                models.Reservation.project_id == project_id,
                models.Item.sku.in_(lock_skus)
            ).first()
            if existing_res:
                already_reserved = True
                error_msg = "لقد تم حجز الزرافيل لهذا المشروع بالفعل"
    elif category == "hinges":
        hinge_skus = [opt.sku for opt in db.query(models.ProjectOption).filter(models.ProjectOption.option_type == "hinge") if opt.sku]
        if hinge_skus:
            existing_res = db.query(models.Reservation).join(models.Item).filter(
                models.Reservation.project_id == project_id,
                models.Item.sku.in_(hinge_skus)
            ).first()
            if existing_res:
                already_reserved = True
                error_msg = "لقد تم حجز الفصالات لهذا المشروع بالفعل"
    elif category == "accessories":
        existing_res = db.query(models.Reservation).join(models.Item).filter(
            models.Reservation.project_id == project_id,
            models.Item.category == "إكسسوارات"
        ).first()
        if existing_res:
            already_reserved = True
            error_msg = "لقد تم حجز الإكسسوارات لهذا المشروع بالفعل"

    if already_reserved:
        raise HTTPException(status_code=400, detail=error_msg)
            
    check_res = perform_reserve_check(db, project, category)
    
    reserved_items = []
    skipped_items = []
    
    for req in check_res["items"]:
        status = req["status"]
        sku = req["sku"]
        required = req["required"]
        available = req["available"]
        item_id = req["item_id"]
        name = req["name"]
        
        if status == "OK" and item_id:
            # Reserve full required qty
            crud.create_reservation(
                db=db,
                item_id=item_id,
                quantity=required,
                project_name=f"{project.name} - {project.project_number}",
                user_id=current_user.id,
                project_id=project.id
            )
            reserved_items.append({"name": name, "sku": sku, "quantity": required})
        elif status == "INSUFFICIENT_STOCK" and item_id and available > 0:
            # Reserve whatever is available
            crud.create_reservation(
                db=db,
                item_id=item_id,
                quantity=available,
                project_name=f"{project.name} - {project.project_number}",
                user_id=current_user.id,
                project_id=project.id
            )
            reserved_items.append({"name": name, "sku": sku, "quantity": available})
            skipped_items.append({"name": name, "sku": sku, "quantity": required - available, "reason": "INSUFFICIENT_STOCK"})
        else:
            # Cannot reserve anything
            reason = status
            skipped_items.append({"name": name, "sku": sku, "quantity": required, "reason": reason})
            
    return {
        "reserved": reserved_items,
        "skipped": skipped_items
    }


@app.post("/api/projects/{project_id}/details/", response_model=schemas.ProjectDetailResponse)
def create_project_detail(project_id: int, detail: schemas.ProjectDetailCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    return crud.create_project_detail(db, project_id, detail)

@app.delete("/api/projects/details/{detail_id}")
def delete_project_detail(detail_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    success = crud.delete_project_detail(db, detail_id)
    if not success:
        raise HTTPException(status_code=404, detail="Detail not found")
    return {"message": "Deleted successfully"}

@app.delete("/api/projects/{project_id}/details")
def delete_project_details(project_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    project = crud.get_project_by_id(db, project_id)
    if not project or (project.executive_manager_id != current_user.id and current_user.username != "admin"):
        raise HTTPException(status_code=403, detail="Not authorized")
    crud.delete_project_details(db, project_id)
    return {"message": "All details deleted successfully"}

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

# --- PROJECT OPTIONS ENDPOINTS ---

@app.get("/api/project-options/", response_model=List[schemas.ProjectOptionResponse])
def read_project_options(
    option_type: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    return crud.get_project_options(db, option_type)

@app.post("/api/project-options/", response_model=schemas.ProjectOptionResponse)
def create_project_option(
    option: schemas.ProjectOptionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.username != "admin":
        raise HTTPException(status_code=403, detail="غير مصرح لك بإضافة خيارات")
    return crud.create_project_option(db, option)

@app.put("/api/project-options/{option_id}", response_model=schemas.ProjectOptionResponse)
def update_project_option(
    option_id: int,
    option_update: schemas.ProjectOptionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.username != "admin":
        raise HTTPException(status_code=403, detail="غير مصرح لك بتعديل خيارات")
    db_opt = crud.update_project_option(db, option_id, option_update.name, option_update.sku)
    if not db_opt:
        raise HTTPException(status_code=404, detail="Option not found")
    return db_opt

@app.delete("/api/project-options/{option_id}")
def delete_project_option(
    option_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.username != "admin":
        raise HTTPException(status_code=403, detail="غير مصرح لك بحذف خيارات")
    success = crud.delete_project_option(db, option_id)
    if not success:
        raise HTTPException(status_code=404, detail="Option not found")
    return {"message": "Deleted successfully"}

# --- SHEET SIZES ENDPOINTS ---

@app.get("/api/sheet-sizes/", response_model=List[schemas.SheetSizeResponse])
def read_sheet_sizes(
    thickness: Optional[float] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    return crud.get_sheet_sizes(db, thickness)

@app.post("/api/sheet-sizes/", response_model=schemas.SheetSizeResponse)
def create_sheet_size(
    sheet_size: schemas.SheetSizeCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.username != "admin":
        raise HTTPException(status_code=403, detail="غير مصرح لك بإضافة قياسات ألواح")
    return crud.create_sheet_size(db, sheet_size)

@app.put("/api/sheet-sizes/{sheet_size_id}", response_model=schemas.SheetSizeResponse)
def update_sheet_size(
    sheet_size_id: int,
    sheet_size_update: schemas.SheetSizeCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.username != "admin":
        raise HTTPException(status_code=403, detail="غير مصرح لك بتعديل قياسات ألواح")
    db_size = crud.update_sheet_size(
        db,
        sheet_size_id,
        sheet_size_update.thickness,
        sheet_size_update.width,
        sheet_size_update.height,
        sheet_size_update.sku
    )
    if not db_size:
        raise HTTPException(status_code=404, detail="Sheet size not found")
    return db_size

@app.delete("/api/sheet-sizes/{sheet_size_id}")
def delete_sheet_size(
    sheet_size_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.username != "admin":
        raise HTTPException(status_code=403, detail="غير مصرح لك بحذف قياسات ألواح")
    success = crud.delete_sheet_size(db, sheet_size_id)
    if not success:
        raise HTTPException(status_code=404, detail="Sheet size not found")
    return {"message": "Deleted successfully"}

# ==========================================
#           PURCHASING MODULE
# ==========================================

@app.get("/api/suppliers/", response_model=List[schemas.SupplierResponse])
def get_suppliers(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    return db.query(models.Supplier).all()

@app.post("/api/suppliers/", response_model=schemas.SupplierResponse)
def create_supplier(supplier: schemas.SupplierCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_supplier = models.Supplier(**supplier.model_dump())
    db.add(db_supplier)
    db.commit()
    db.refresh(db_supplier)
    return db_supplier

@app.put("/api/suppliers/{supplier_id}", response_model=schemas.SupplierResponse)
def update_supplier(supplier_id: int, supplier_update: schemas.SupplierUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_supplier = db.query(models.Supplier).filter(models.Supplier.id == supplier_id).first()
    if not db_supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    
    update_data = supplier_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_supplier, key, value)
        
    db.commit()
    db.refresh(db_supplier)
    return db_supplier

@app.delete("/api/suppliers/{supplier_id}")
def delete_supplier(supplier_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_supplier = db.query(models.Supplier).filter(models.Supplier.id == supplier_id).first()
    if not db_supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    db.delete(db_supplier)
    db.commit()
    return {"message": "Deleted successfully"}

@app.get("/api/purchase-requests/", response_model=List[schemas.PurchaseRequestResponse])
def get_purchase_requests(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    return db.query(models.PurchaseRequest).order_by(models.PurchaseRequest.created_at.desc()).all()

@app.post("/api/purchase-requests/", response_model=schemas.PurchaseRequestResponse)
def create_purchase_request(
    title: str = Form(...),
    description: Optional[str] = Form(None),
    quantity: Optional[int] = Form(None),
    expected_price: Optional[str] = Form(None),
    req_id: Optional[int] = Form(None),
    attached_image: UploadFile = File(None),
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(auth.get_current_user)
):
    attached_image_url = None
    if attached_image and attached_image.filename:
        ext = os.path.splitext(attached_image.filename)[1]
        fname = f"attached_{uuid.uuid4()}{ext}"
        fpath = os.path.join(UPLOAD_DIR, fname)
        with open(fpath, "wb") as buffer:
            shutil.copyfileobj(attached_image.file, buffer)
        attached_image_url = f"/uploads/{fname}"

    db_req = models.PurchaseRequest(
        title=title,
        description=description,
        quantity=quantity,
        expected_price=expected_price,
        attached_image_url=attached_image_url,
        requested_by_id=current_user.id
    )
    if req_id is not None:
        # Check if exists
        existing = db.query(models.PurchaseRequest).filter(models.PurchaseRequest.id == req_id).first()
        if existing:
            raise HTTPException(status_code=400, detail="رقم الطلب هذا موجود مسبقاً")
        db_req.id = req_id
    else:
        # Automatically use max(id) + 1 to avoid gaps when latest is deleted
        max_id = db.query(func.max(models.PurchaseRequest.id)).scalar()
        if max_id is not None:
            db_req.id = max_id + 1
        else:
            db_req.id = 1
            
    db.add(db_req)
    db.commit()
    db.refresh(db_req)
    return db_req

@app.get("/api/purchase-requests/{req_id}", response_model=schemas.PurchaseRequestResponse)
def get_purchase_request(req_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_req = db.query(models.PurchaseRequest).filter(models.PurchaseRequest.id == req_id).first()
    if not db_req:
        raise HTTPException(status_code=404, detail="Purchase request not found")
    return db_req

@app.put("/api/purchase-requests/{req_id}", response_model=schemas.PurchaseRequestResponse)
def update_purchase_request(req_id: int, req_update: schemas.PurchaseRequestUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_req = db.query(models.PurchaseRequest).filter(models.PurchaseRequest.id == req_id).first()
    if not db_req:
        raise HTTPException(status_code=404, detail="Purchase request not found")
    
    update_data = req_update.model_dump(exclude_unset=True)
    
    # Check admin approval for "Active" status
    if "status" in update_data and update_data["status"] == "Active" and current_user.username != "admin":
        raise HTTPException(status_code=403, detail="Only admin can approve purchase requests")

    for key, value in update_data.items():
        setattr(db_req, key, value)
        
    db.commit()
    db.refresh(db_req)
    return db_req

@app.put("/api/purchase-requests/{req_id}/details", response_model=schemas.PurchaseRequestResponse)
def update_purchase_request_details(
    req_id: int,
    title: str = Form(...),
    description: Optional[str] = Form(None),
    quantity: Optional[int] = Form(None),
    expected_price: Optional[str] = Form(None),
    attached_image: UploadFile = File(None),
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(auth.get_current_user)
):
    db_req = db.query(models.PurchaseRequest).filter(models.PurchaseRequest.id == req_id).first()
    if not db_req:
        raise HTTPException(status_code=404, detail="Purchase request not found")
        
    db_req.title = title
    db_req.description = description
    db_req.quantity = quantity
    db_req.expected_price = expected_price
    
    if attached_image and attached_image.filename:
        ext = os.path.splitext(attached_image.filename)[1]
        fname = f"attached_{uuid.uuid4()}{ext}"
        fpath = os.path.join(UPLOAD_DIR, fname)
        with open(fpath, "wb") as buffer:
            shutil.copyfileobj(attached_image.file, buffer)
        db_req.attached_image_url = f"/uploads/{fname}"
        
    db.commit()
    db.refresh(db_req)
    return db_req


@app.post("/api/purchase-requests/{req_id}/upload-images", response_model=schemas.PurchaseRequestResponse)
def upload_purchase_images(req_id: int, invoice_image: UploadFile = File(None), items_image: UploadFile = File(None), db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_req = db.query(models.PurchaseRequest).filter(models.PurchaseRequest.id == req_id).first()
    if not db_req:
        raise HTTPException(status_code=404, detail="Purchase request not found")
        
    if invoice_image and invoice_image.filename:
        ext = os.path.splitext(invoice_image.filename)[1]
        fname = f"invoice_{uuid.uuid4()}{ext}"
        fpath = os.path.join(UPLOAD_DIR, fname)
        with open(fpath, "wb") as buffer:
            shutil.copyfileobj(invoice_image.file, buffer)
        db_req.invoice_image_url = f"/uploads/{fname}"

    if items_image and items_image.filename:
        ext = os.path.splitext(items_image.filename)[1]
        fname = f"items_{uuid.uuid4()}{ext}"
        fpath = os.path.join(UPLOAD_DIR, fname)
        with open(fpath, "wb") as buffer:
            shutil.copyfileobj(items_image.file, buffer)
        db_req.items_image_url = f"/uploads/{fname}"

    db_req.status = "Purchased"
    db.commit()
    db.refresh(db_req)
    return db_req

@app.delete("/api/purchase-requests/{req_id}")
def delete_purchase_request(req_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_req = db.query(models.PurchaseRequest).filter(models.PurchaseRequest.id == req_id).first()
    if not db_req:
        raise HTTPException(status_code=404, detail="Purchase request not found")
    if db_req.requested_by_id != current_user.id and current_user.username != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
        
    db.delete(db_req)
    db.commit()
    return {"message": "Deleted successfully"}


# Serve frontend files
def get_frontend_dir():
    if getattr(sys, 'frozen', False):
        # PyInstaller extracts bundled data files to a temporary folder sys._MEIPASS
        return os.path.join(sys._MEIPASS, "frontend")
    return os.path.abspath(os.path.join(os.path.dirname(__file__), "frontend"))

frontend_dir = get_frontend_dir()
app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")
