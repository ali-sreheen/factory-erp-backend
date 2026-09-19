from fastapi import FastAPI, Depends, HTTPException, File, UploadFile, Form, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import func
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime, timedelta
import os
import shutil
import uuid
import sys
import re

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
    
    # Check users table
    if "users" in inspector.get_table_names():
        columns = [c["name"] for c in inspector.get_columns("users")]
        if "is_approved" not in columns:
            try:
                with db_engine.begin() as conn:
                    conn.execute(text("ALTER TABLE users ADD COLUMN is_approved INTEGER DEFAULT 1"))
            except Exception as e:
                pass
        for col in ["full_name", "job_title", "employment_id", "department", "avatar_url"]:
            if col not in columns:
                try:
                    with db_engine.begin() as conn:
                        conn.execute(text(f"ALTER TABLE users ADD COLUMN {col} VARCHAR"))
                except Exception as e:
                    pass

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
        if "map_url" not in columns:
            try:
                with db_engine.begin() as conn:
                    conn.execute(text("ALTER TABLE projects ADD COLUMN map_url VARCHAR"))
            except Exception as e:
                pass
        if "activated_at" not in columns:
            try:
                with db_engine.begin() as conn:
                    conn.execute(text("ALTER TABLE projects ADD COLUMN activated_at TIMESTAMP WITH TIME ZONE"))
            except Exception as e:
                try:
                    with db_engine.begin() as conn:
                        conn.execute(text("ALTER TABLE projects ADD COLUMN activated_at DATETIME"))
                except Exception as ex:
                    pass
        if "delivery_approval" not in columns:
            try:
                with db_engine.begin() as conn:
                    conn.execute(text("ALTER TABLE projects ADD COLUMN delivery_approval VARCHAR DEFAULT 'stopped'"))
            except Exception as e:
                pass
        if "completed_at" not in columns:
            try:
                with db_engine.begin() as conn:
                    conn.execute(text("ALTER TABLE projects ADD COLUMN completed_at TIMESTAMP WITH TIME ZONE"))
            except Exception as e:
                try:
                    with db_engine.begin() as conn:
                        conn.execute(text("ALTER TABLE projects ADD COLUMN completed_at DATETIME"))
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


    # Check project_options table for is_fire_rated
    if "project_options" in inspector.get_table_names():
        columns = [c["name"] for c in inspector.get_columns("project_options")]
        if "is_fire_rated" not in columns:
            try:
                with db_engine.begin() as conn:
                    conn.execute(text("ALTER TABLE project_options ADD COLUMN is_fire_rated BOOLEAN NOT NULL DEFAULT FALSE"))
            except Exception as e:
                pass

    # Check project_details table
    if "project_details" in inspector.get_table_names():
        columns = [c["name"] for c in inspector.get_columns("project_details")]
        for col in ["architrave", "architrave_2", "under_tile", "notes", "direction", "hinges", "qashatah", "raddad", "hinges_count", "leaf_thickness", "sticker_number", "specifications", "leaf_size", "leaf_size_2", "window_width", "window_height", "window_position", "final_delivery_date"]:
            if col not in columns:
                try:
                    with db_engine.begin() as conn:
                        if col == "qashatah" or col == "raddad":
                            conn.execute(text(f"ALTER TABLE project_details ADD COLUMN {col} VARCHAR DEFAULT 'NO'"))
                        elif col == "hinges_count":
                            conn.execute(text(f"ALTER TABLE project_details ADD COLUMN {col} INTEGER DEFAULT 4"))
                        elif col == "leaf_thickness":
                            conn.execute(text(f"ALTER TABLE project_details ADD COLUMN {col} VARCHAR DEFAULT '4.5'"))
                        else:
                            conn.execute(text(f"ALTER TABLE project_details ADD COLUMN {col} VARCHAR"))
                except Exception as e:
                    pass
        if "is_fire_door_locked" not in columns:
            try:
                with db_engine.begin() as conn:
                    conn.execute(text("ALTER TABLE project_details ADD COLUMN is_fire_door_locked BOOLEAN NOT NULL DEFAULT FALSE"))
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

    # Check contractors table for contacts column
    if "contractors" in inspector.get_table_names():
        columns = [c["name"] for c in inspector.get_columns("contractors")]
        if "contacts" not in columns:
            try:
                with db_engine.begin() as conn:
                    conn.execute(text("ALTER TABLE contractors ADD COLUMN contacts VARCHAR"))
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

# Run schema migrations first
db_seed = SessionLocal()
try:
    from sqlalchemy import text
    try:
        db_seed.execute(text("SELECT is_fire_rated FROM project_options LIMIT 1"))
    except Exception:
        db_seed.rollback()
        print("Running migration: adding is_fire_rated column to project_options...")
        try:
            db_seed.execute(text("ALTER TABLE project_options ADD COLUMN is_fire_rated BOOLEAN NOT NULL DEFAULT FALSE"))
            db_seed.commit()
        except Exception as ex:
            db_seed.rollback()
            print(f"Error adding is_fire_rated column: {ex}")

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

    crud.seed_admin_user(db_seed)
finally:
    db_seed.close()

# Seed default departments, project options, and sheet sizes when starting up
db_session = SessionLocal()
try:
    seed_default_departments(db_session)
    crud.seed_default_project_options(db_session)
    crud.seed_default_sheet_sizes(db_session)
    crud.seed_default_fire_door_rules(db_session)
finally:
    db_session.close()

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
    if user.is_approved != 1:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="بانتظار موافقة مدير النظام",
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
    is_hr = current_user.username == "admin" or user_has_hr_management(current_user, db)
    
    # We return copies or modify in-place (since SQLAlchemy objects, we can detach or modify carefully, or construct response model manually).
    # Since SQLAlchemy models are returned, modifying u.salary on a transient/copy basis is fine, but to avoid committing None back to DB,
    # let's map them or set transient values. Pydantic will serialize whatever is in u.salary. Let's just create a list of dicts/schemas or
    # set attributes without committing.
    result = []
    for u in users:
        # Create a dictionary from the model or construct UserResponse
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

@app.put("/api/users/{user_id}/toggle-approval")
def toggle_user_approval(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
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

@app.delete("/api/users/{user_id}")
def delete_user_account(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.username != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to delete user accounts")
        
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")
        
    if db_user.username == "admin":
        raise HTTPException(status_code=400, detail="Cannot delete admin account")
        
    # Remove references before deleting
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

def user_has_project_management(user: models.User, db: Session) -> bool:
    if user.username == "admin":
        return True
    perm = db.query(models.UserPermission).filter(
        models.UserPermission.user_id == user.id,
        models.UserPermission.department_name == "project_management"
    ).first()
    return perm is not None and perm.can_edit == 1

def check_purchasing_permission(user: models.User, action: str, db: Session):
    if user.username == "admin":
        return True
    perm = db.query(models.UserPermission).filter(
        models.UserPermission.user_id == user.id,
        models.UserPermission.department_name == action
    ).first()
    if not perm or not perm.can_edit:
        raise HTTPException(status_code=403, detail="لا تملك هذه الصلاحية في نظام المشتريات")
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

@app.post("/api/reservations/{reservation_id}/consume")
def consume_item_reservation(
    reservation_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    db_res = db.query(models.Reservation).filter(models.Reservation.id == reservation_id).first()
    if not db_res:
        raise HTTPException(status_code=404, detail="Reservation not found")
        
    item = db.query(models.Item).filter(models.Item.id == db_res.item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
        
    # Check permissions
    check_permission(db, current_user, item.category)
    
    # Check if stock is sufficient. In inventory, the reservation is ALREADY subtracted from "available"
    # but actual item.quantity has NOT yet been decremented (it is decremented only on transaction).
    # Since reservation was just reserving it, the actual count in stock item.quantity must be >= db_res.quantity
    if item.quantity < db_res.quantity:
        raise HTTPException(status_code=400, detail="الكمية المتوافرة في المخزن غير كافية لإتمام عملية السحب")
        
    # Create transaction to subtract quantity (change = -db_res.quantity)
    crud.create_transaction(
        db=db,
        item_id=item.id,
        change=-db_res.quantity,
        project_name=db_res.project_name,
        project_id=db_res.project_id,
        notes=f"سحب من كمية محجوزة بواسطة: {current_user.username}",
        user_id=current_user.id
    )
    
    # Delete reservation
    crud.delete_reservation(db, reservation_id=reservation_id)
    return {"message": "تم سحب الكمية وحذف الحجز بنجاح"}

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
        
    if current_user.username != "admin" and current_user.id != existing.executive_manager_id and not user_has_project_management(current_user, db):
        raise HTTPException(status_code=403, detail="Not authorized")
        
    project = crud.update_project(db, project_id, project_update)
    return project

@app.delete("/api/projects/{project_id}")
def delete_project(project_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    project = crud.get_project_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    if current_user.username != "admin" and current_user.id != project.executive_manager_id and not user_has_project_management(current_user, db):
        raise HTTPException(status_code=403, detail="Not authorized")
        
    if project.status.lower() in ["active", "completed"]:
        raise HTTPException(status_code=400, detail="لا يمكن حذف مشروع فعال أو منتهي")
        
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
            "door_number": detail.door_number,
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
    if current_user.username != "admin" and current_user.id != project.executive_manager_id and not user_has_project_management(current_user, db):
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
    if current_user.username != "admin" and current_user.id != project.executive_manager_id and not user_has_project_management(current_user, db):
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

def get_stickers_list(sticker_number: str | None, quantity: int) -> list[str]:
    qty = quantity if quantity and quantity > 0 else 1
    if not sticker_number:
        return [""] * qty
    parts = [p.strip() for p in sticker_number.split(',')]
    if len(parts) < qty:
        import re
        last_part = parts[-1]
        try:
            digits = re.findall(r'\d+', last_part)
            if digits:
                val = int(digits[-1])
                prefix = last_part[:last_part.rfind(digits[-1])]
                while len(parts) < qty:
                    val += 1
                    parts.append(f"{prefix}{val}")
            else:
                while len(parts) < qty:
                    parts.append("")
        except Exception:
            while len(parts) < qty:
                parts.append("")
    return parts[:qty]

@app.get("/api/fire-doors/")
def get_fire_doors(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if current_user.username != "admin" and not user_has_project_management(current_user, db):
        raise HTTPException(status_code=403, detail="غير مصرح بالوصول لأبواب الحريق")
        
    from sqlalchemy import or_
    details = db.query(models.ProjectDetail).filter(
        or_(
            models.ProjectDetail.fire_resistance.like("Yes%"),
            models.ProjectDetail.fire_resistance.like("نعم%"),
            models.ProjectDetail.fire_resistance.like("YES%")
        )
    ).order_by(models.ProjectDetail.id.asc()).all()
    
    result = []
    for d in details:
        is_project_active = d.project.status.lower() in ["active", "completed"] if (d.project and d.project.status) else False
        has_sticker = bool(d.sticker_number)
        
        # Only show doors when project is active/completed, or if stickers exist
        if is_project_active or has_sticker:
            qty = d.quantity if d.quantity and d.quantity > 0 else 1
            stickers = get_stickers_list(d.sticker_number, qty)
            
            # Format installation date: if project is completed, use completed_at or expected date
            proj_status = d.project.status.lower() if (d.project and d.project.status) else "pending"
            installation_date = ""
            if proj_status == "completed":
                if d.project.completed_at:
                    installation_date = d.project.completed_at.strftime("%Y-%m-%d")
                elif d.project.expected_completion_date:
                    installation_date = d.project.expected_completion_date.strftime("%Y-%m-%d")
                elif d.project.delivery_date:
                    installation_date = d.project.delivery_date.strftime("%Y-%m-%d")
                else:
                    installation_date = "منتهي"
            
            # Format window info
            win_parts = []
            if d.window_details:
                win_parts.append(str(d.window_details))
            if d.window_width or d.window_height:
                w_w = d.window_width or "-"
                w_h = d.window_height or "-"
                win_parts.append(f"{w_w}×{w_h}")
            if d.window_position:
                win_parts.append(str(d.window_position))
            window_str = " - ".join(win_parts) if win_parts else "-"

            for idx in range(qty):
                sticker_val = stickers[idx] if idx < len(stickers) else ""
                door_label = d.door_number or "-"
                if qty > 1:
                    door_label = f"{door_label} ({idx+1}/{qty})"
                result.append({
                    "id": d.id,
                    "project_id": d.project_id,
                    "index": idx,
                    "total_quantity": qty,
                    "project_name": d.project.name if d.project else "-",
                    "project_number": d.project.project_number if d.project else "-",
                    "project_status": proj_status,
                    "door_number": door_label,
                    "raw_door_number": d.door_number or "",
                    "sticker_number": sticker_val,
                    "installation_date": installation_date,
                    "final_delivery_date": d.final_delivery_date or "",
                    "is_locked": bool(d.is_fire_door_locked),
                    # Specifications
                    "height": d.height or "-",
                    "width": d.width or "-",
                    "depth": d.depth or "-",
                    "door_type": d.door_type or "-",
                    "profile_type": d.profile_type or "-",
                    "lock_type": d.lock_type or "-",
                    "hinges": d.hinges or "-",
                    "window": window_str
                })
    return result

class FireDoorItemUpdate(BaseModel):
    id: int
    index: int
    sticker_number: str
    final_delivery_date: Optional[str] = None

class FireDoorsBulkSaveRequest(BaseModel):
    updates: List[FireDoorItemUpdate]

@app.post("/api/fire-doors/bulk-save")
def bulk_save_fire_doors(payload: FireDoorsBulkSaveRequest, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if current_user.username != "admin" and not user_has_project_management(current_user, db):
        raise HTTPException(status_code=403, detail="غير مصرح بتعديل أبواب الحريق")
    
    # Group updates by detail_id
    from collections import defaultdict
    grouped = defaultdict(dict)
    for u in payload.updates:
        grouped[u.id][u.index] = u

    for detail_id, index_map in grouped.items():
        db_detail = db.query(models.ProjectDetail).filter(models.ProjectDetail.id == detail_id).first()
        if not db_detail:
            continue
        
        # If locked and not admin, skip modifying this door entirely
        is_locked = bool(db_detail.is_fire_door_locked)
        if is_locked and current_user.username != "admin":
            continue

        qty = db_detail.quantity if db_detail.quantity and db_detail.quantity > 0 else 1
        stickers = get_stickers_list(db_detail.sticker_number, qty)
        
        for idx, u in index_map.items():
            if 0 <= idx < qty:
                stickers[idx] = u.sticker_number
            if u.final_delivery_date is not None:
                db_detail.final_delivery_date = u.final_delivery_date
        
        db_detail.sticker_number = ",".join(stickers)

    db.commit()
    return {"message": "تم حفظ تعديلات أبواب الحريق بنجاح"}

class FireDoorLockItem(BaseModel):
    id: int

class FireDoorsFinalLockRequest(BaseModel):
    ids: Optional[List[int]] = None

@app.post("/api/fire-doors/final-lock")
def final_lock_fire_doors(payload: Optional[FireDoorsFinalLockRequest] = None, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if current_user.username != "admin" and not user_has_project_management(current_user, db):
        raise HTTPException(status_code=403, detail="غير مصرح بإجراء الحفظ النهائي")
        
    from sqlalchemy import or_
    query = db.query(models.ProjectDetail).filter(
        or_(
            models.ProjectDetail.fire_resistance.like("Yes%"),
            models.ProjectDetail.fire_resistance.like("نعم%"),
            models.ProjectDetail.fire_resistance.like("YES%")
        )
    )
    
    if payload and payload.ids:
        query = query.filter(models.ProjectDetail.id.in_(payload.ids))
        
    import datetime
    today_str = datetime.datetime.now().strftime("%Y-%m-%d")
    for d in details:
        d.is_fire_door_locked = True
        if not d.final_delivery_date:
            d.final_delivery_date = today_str
        
    db.commit()
    return {"message": "تم الحفظ النهائي وتحديد تاريخ الاستلام النهائي بنجاح. لن يتمكن سوى مسؤول النظام (الأدمن) من تعديل أو حذف الأبواب المحددة."}

class FireDoorBatchDeleteItem(BaseModel):
    id: int
    index: int

class FireDoorBatchDeleteRequest(BaseModel):
    items: List[FireDoorBatchDeleteItem]

@app.post("/api/fire-doors/batch-delete")
def batch_delete_fire_doors(payload: FireDoorBatchDeleteRequest, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if current_user.username != "admin" and not user_has_project_management(current_user, db):
        raise HTTPException(status_code=403, detail="غير مصرح بحذف أبواب الحريق")
        
    # Group items to delete by detail_id
    from collections import defaultdict
    grouped = defaultdict(set)
    for item in payload.items:
        grouped[item.id].add(item.index)

    for detail_id, indices_to_remove in grouped.items():
        db_detail = db.query(models.ProjectDetail).filter(models.ProjectDetail.id == detail_id).first()
        if not db_detail:
            continue

        # If locked and not admin, do not allow deleting!
        if bool(db_detail.is_fire_door_locked) and current_user.username != "admin":
            continue
            
        qty = db_detail.quantity if db_detail.quantity and db_detail.quantity > 0 else 1
        stickers = get_stickers_list(db_detail.sticker_number, qty)
        
        # If all doors of this detail are removed, delete the whole detail
        if len(indices_to_remove) >= qty:
            db.delete(db_detail)
        else:
            # Rebuild remaining stickers and decrement quantity
            remaining_stickers = [stickers[i] for i in range(qty) if i not in indices_to_remove]
            db_detail.quantity = len(remaining_stickers)
            db_detail.sticker_number = ",".join(remaining_stickers)
            
    db.commit()
    return {"message": "تم حذف الأبواب المحددة بنجاح"}

class FireDoorAddRequest(BaseModel):
    project_id: int
    door_number: str
    sticker_number: Optional[str] = None
    width: Optional[str] = None
    height: Optional[str] = None
    depth: Optional[str] = None
    door_type: Optional[str] = None
    profile_type: Optional[str] = None
    lock_type: Optional[str] = None
    hinges: Optional[str] = None
    window_details: Optional[str] = None
    final_delivery_date: Optional[str] = None

@app.post("/api/fire-doors/add-door")
def add_single_fire_door(payload: FireDoorAddRequest, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if current_user.username != "admin" and not user_has_project_management(current_user, db):
        raise HTTPException(status_code=403, detail="غير مصرح بإضافة أبواب حريق")
        
    project = db.query(models.Project).filter(models.Project.id == payload.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="المشروع غير موجود")
        
    # Determine sticker number if not provided
    sticker_val = payload.sticker_number
    if not sticker_val:
        all_stickers = db.query(models.ProjectDetail.sticker_number).filter(
            models.ProjectDetail.sticker_number != None,
            models.ProjectDetail.sticker_number != ""
        ).all()
        max_num = 0
        import re
        for (s_num,) in all_stickers:
            if s_num:
                for part in s_num.split(','):
                    try:
                        digits = re.findall(r'\d+', part)
                        if digits:
                            val = int(digits[-1])
                            if val > max_num:
                                max_num = val
                    except Exception:
                        pass
        sticker_val = str(max_num + 1)

    new_detail = models.ProjectDetail(
        project_id=payload.project_id,
        door_number=payload.door_number,
        sticker_number=sticker_val,
        quantity=1,
        fire_resistance="نعم - Yes",
        width=payload.width,
        height=payload.height,
        depth=payload.depth,
        door_type=payload.door_type,
        profile_type=payload.profile_type,
        lock_type=payload.lock_type,
        hinges=payload.hinges,
        window_details=payload.window_details,
        final_delivery_date=payload.final_delivery_date,
        is_fire_door_locked=False
    )
    db.add(new_detail)
    db.commit()
    db.refresh(new_detail)
    return {"message": "تمت إضافة باب الحريق بنجاح", "id": new_detail.id}

class StickerUpdateRequest(BaseModel):
    index: int
    sticker_number: str

@app.put("/api/projects/details/{detail_id}/sticker")
def update_detail_sticker(detail_id: int, payload: StickerUpdateRequest, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_detail = db.query(models.ProjectDetail).filter(models.ProjectDetail.id == detail_id).first()
    if not db_detail:
        raise HTTPException(status_code=404, detail="Detail not found")
        
    project = db_detail.project
    if current_user.username != "admin" and (not project or current_user.id != project.executive_manager_id) and not user_has_project_management(current_user, db):
        raise HTTPException(status_code=403, detail="Not authorized")
        
    qty = db_detail.quantity if db_detail.quantity and db_detail.quantity > 0 else 1
    stickers = get_stickers_list(db_detail.sticker_number, qty)
    
    if payload.index < 0 or payload.index >= qty:
        raise HTTPException(status_code=400, detail="Index out of range")
        
    stickers[payload.index] = payload.sticker_number
    db_detail.sticker_number = ",".join(stickers)
    db.commit()
    db.refresh(db_detail)
    return {"message": "Sticker updated successfully", "sticker_number": db_detail.sticker_number}

@app.put("/api/projects/details/{detail_id}", response_model=schemas.ProjectDetailResponse)
def update_project_detail(detail_id: int, detail_update: schemas.ProjectDetailCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_detail = db.query(models.ProjectDetail).filter(models.ProjectDetail.id == detail_id).first()
    if not db_detail:
        raise HTTPException(status_code=404, detail="Detail not found")
    
    project = db_detail.project
    if current_user.username != "admin" and (not project or current_user.id != project.executive_manager_id) and not user_has_project_management(current_user, db):
        raise HTTPException(status_code=403, detail="Not authorized")
        
    update_data = detail_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_detail, key, value)
        
    db.commit()
    db.refresh(db_detail)
    return db_detail

@app.delete("/api/projects/{project_id}/details")
def delete_project_details(project_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    project = crud.get_project_by_id(db, project_id)
    if not project or (project.executive_manager_id != current_user.id and current_user.username != "admin" and not user_has_project_management(current_user, db)):
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
    if not project or (project.executive_manager_id != current_user.id and current_user.username != "admin" and not user_has_project_management(current_user, db)):
        raise HTTPException(status_code=403, detail="Not authorized to add tasks for this project")
    return crud.create_project_task(db, task, project_id, current_user.id)

@app.put("/api/projects/tasks/{task_id}", response_model=schemas.ProjectTaskResponse)
def update_project_task(task_id: int, task_update: schemas.ProjectTaskUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    task = db.query(models.ProjectTask).filter(models.ProjectTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # allow executive manager, admin, or the assignee to update
    project = crud.get_project_by_id(db, task.project_id)
    is_exec_manager = project and (project.executive_manager_id == current_user.id or user_has_project_management(current_user, db))
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
    if project and project.executive_manager_id != current_user.id and current_user.username != "admin" and not user_has_project_management(current_user, db):
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
    db_opt = crud.update_project_option(db, option_id, option_update.name, option_update.sku, option_update.is_fire_rated)
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

# --- FIRE-RATED DOOR RULES ENDPOINTS ---

@app.get("/api/fire-door-rules/", response_model=List[schemas.FireDoorRuleResponse])
def read_fire_door_rules(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    return crud.get_fire_door_rules(db)

@app.post("/api/fire-door-rules/", response_model=schemas.FireDoorRuleResponse)
def create_fire_door_rule(
    rule: schemas.FireDoorRuleCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.username != "admin":
        raise HTTPException(status_code=403, detail="غير مصرح لك بإضافة مواصفات أبواب حريق")
    return crud.create_fire_door_rule(db, rule)

@app.put("/api/fire-door-rules/{rule_id}", response_model=schemas.FireDoorRuleResponse)
def update_fire_door_rule(
    rule_id: int,
    rule_update: schemas.FireDoorRuleCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.username != "admin":
        raise HTTPException(status_code=403, detail="غير مصرح لك بتعديل مواصفات أبواب حريق")
    db_rule = crud.update_fire_door_rule(db, rule_id, rule_update)
    if not db_rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    return db_rule

@app.delete("/api/fire-door-rules/{rule_id}")
def delete_fire_door_rule(
    rule_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.username != "admin":
        raise HTTPException(status_code=403, detail="غير مصرح لك بحذف مواصفات أبواب حريق")
    success = crud.delete_fire_door_rule(db, rule_id)
    if not success:
        raise HTTPException(status_code=404, detail="Rule not found")
    return {"message": "Deleted successfully"}

# ==========================================
#           PURCHASING MODULE
# ==========================================

@app.get("/api/suppliers/", response_model=List[schemas.SupplierResponse])
def get_suppliers(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    return db.query(models.Supplier).all()

@app.post("/api/suppliers/", response_model=schemas.SupplierResponse)
def create_supplier(supplier: schemas.SupplierCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    check_purchasing_permission(current_user, "purchasing_suppliers", db)
    db_supplier = models.Supplier(**supplier.model_dump())
    db.add(db_supplier)
    db.commit()
    db.refresh(db_supplier)
    return db_supplier

@app.put("/api/suppliers/{supplier_id}", response_model=schemas.SupplierResponse)
def update_supplier(supplier_id: int, supplier_update: schemas.SupplierUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    check_purchasing_permission(current_user, "purchasing_suppliers", db)
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
    check_purchasing_permission(current_user, "purchasing_suppliers", db)
    db_supplier = db.query(models.Supplier).filter(models.Supplier.id == supplier_id).first()
    if not db_supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    db.delete(db_supplier)
    db.commit()
    return {"message": "Deleted successfully"}

# --- CONTRACTORS ENDPOINTS ---
@app.get("/api/contractors/", response_model=List[schemas.ContractorResponse])
def get_contractors(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    return db.query(models.Contractor).all()

@app.post("/api/contractors/", response_model=schemas.ContractorResponse)
def create_contractor(contractor: schemas.ContractorCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_contractor = models.Contractor(**contractor.model_dump())
    db.add(db_contractor)
    db.commit()
    db.refresh(db_contractor)
    return db_contractor

@app.put("/api/contractors/{contractor_id}", response_model=schemas.ContractorResponse)
def update_contractor(contractor_id: int, contractor_update: schemas.ContractorUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_contractor = db.query(models.Contractor).filter(models.Contractor.id == contractor_id).first()
    if not db_contractor:
        raise HTTPException(status_code=404, detail="Contractor not found")
    
    update_data = contractor_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_contractor, key, value)
        
    db.commit()
    db.refresh(db_contractor)
    return db_contractor

@app.delete("/api/contractors/{contractor_id}")
def delete_contractor(contractor_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_contractor = db.query(models.Contractor).filter(models.Contractor.id == contractor_id).first()
    if not db_contractor:
        raise HTTPException(status_code=404, detail="Contractor not found")
    db.delete(db_contractor)
    db.commit()
    return {"message": "Contractor deleted successfully"}

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
    check_purchasing_permission(current_user, "purchasing_create", db)
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
    
    # Check permission for status change
    if "status" in update_data:
        check_purchasing_permission(current_user, "purchasing_status", db)

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
    check_purchasing_permission(current_user, "purchasing_create", db)
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
    check_purchasing_permission(current_user, "purchasing_status", db)
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


def user_has_hr_management(user: models.User, db: Session) -> bool:
    if user.username == "admin":
        return True
    perm = db.query(models.UserPermission).filter(
        models.UserPermission.user_id == user.id,
        models.UserPermission.department_name == "hr_management"
    ).first()
    return perm is not None and (perm.can_edit == 1)

@app.put("/api/users/me/profile", response_model=schemas.UserResponse)
def update_my_profile(
    full_name: str = Form(...),
    job_title: str = Form(...),
    employment_id: str = Form(...),
    department: str = Form(...),
    avatar: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if not (current_user.username == 'admin' or user_has_hr_management(current_user, db)):
        raise HTTPException(status_code=403, detail="لا يمكن للموظفين تعديل ملفهم الشخصي مباشرة. يرجى التواصل مع إدارة شؤون الموظفين.")
        
    avatar_url = None
    if avatar and avatar.filename:
        ext = os.path.splitext(avatar.filename)[1]
        fname = f"avatar_{uuid.uuid4()}{ext}"
        fpath = os.path.join(UPLOAD_DIR, fname)
        with open(fpath, "wb") as buffer:
            shutil.copyfileobj(avatar.file, buffer)
        avatar_url = f"/uploads/{fname}"
    
    # If no new avatar uploaded, preserve the existing avatar_url
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

@app.put("/api/users/{user_id}/profile-admin", response_model=schemas.UserResponse)
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
    current_user: models.User = Depends(auth.get_current_user)
):
    if not (current_user.username == 'admin' or user_has_hr_management(current_user, db)):
        raise HTTPException(status_code=403, detail="غير مصرح بتعديل ملفات الموظفين")
        
    avatar_url = None
    if avatar and avatar.filename:
        ext = os.path.splitext(avatar.filename)[1]
        fname = f"avatar_{uuid.uuid4()}{ext}"
        fpath = os.path.join(UPLOAD_DIR, fname)
        with open(fpath, "wb") as buffer:
            shutil.copyfileobj(avatar.file, buffer)
        avatar_url = f"/uploads/{fname}"
    
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="المستخدم غير موجود")
        
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

@app.get("/api/users/{user_id}/vacations", response_model=List[schemas.EmployeeVacationDayResponse])
def get_user_vacations(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    # Allowed for the user themselves or HR/Admin
    is_hr = current_user.username == 'admin' or user_has_hr_management(current_user, db)
    if not is_hr and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="غير مصرح بعرض إجازات هذا الموظف")
    return crud.get_employee_vacation_days(db, user_id=user_id)

@app.post("/api/users/{user_id}/vacations", response_model=schemas.EmployeeVacationDayResponse)
def add_user_vacation(
    user_id: int,
    vacation: schemas.EmployeeVacationDayCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if not (current_user.username == 'admin' or user_has_hr_management(current_user, db)):
        raise HTTPException(status_code=403, detail="غير مصرح بإضافة إجازات للموظفين")
    return crud.add_employee_vacation_day(db, user_id=user_id, vacation_date=vacation.vacation_date, notes=vacation.notes)

@app.delete("/api/users/vacations/{vacation_day_id}")
def delete_user_vacation(
    vacation_day_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if not (current_user.username == 'admin' or user_has_hr_management(current_user, db)):
        raise HTTPException(status_code=403, detail="غير مصرح بحذف إجازات الموظفين")
    success = crud.delete_employee_vacation_day(db, vacation_day_id=vacation_day_id)
    if not success:
        raise HTTPException(status_code=404, detail="يوم الإجازة غير موجود")
    return {"status": "success", "message": "تم حذف يوم الإجازة بنجاح"}
@app.get("/api/users/{user_id}/salaries", response_model=List[schemas.EmployeeSalaryResponse])
def get_user_salaries(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    is_hr = current_user.username == 'admin' or user_has_hr_management(current_user, db)
    if not is_hr and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="غير مصرح بعرض رواتب هذا الموظف")
    return crud.get_employee_salaries(db, user_id=user_id)

@app.post("/api/users/{user_id}/salaries", response_model=schemas.EmployeeSalaryResponse)
def add_or_update_user_salary(
    user_id: int,
    salary: schemas.EmployeeSalaryCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if not (current_user.username == 'admin' or user_has_hr_management(current_user, db)):
        raise HTTPException(status_code=403, detail="غير مصرح بتعديل رواتب الموظفين")
    return crud.add_or_update_employee_salary(db, user_id=user_id, salary_data=salary)

@app.delete("/api/users/salaries/{salary_id}")
def delete_user_salary(
    salary_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if not (current_user.username == 'admin' or user_has_hr_management(current_user, db)):
        raise HTTPException(status_code=403, detail="غير مصرح بحذف رواتب الموظفين")
    success = crud.delete_employee_salary(db, salary_id=salary_id)
    if not success:
        raise HTTPException(status_code=404, detail="سجل الراتب غير موجود")
    return {"status": "success", "message": "تم حذف سجل الراتب بنجاح"}

@app.post("/api/hr/requests/", response_model=schemas.HRRequestResponse)
def create_request(
    request_type: str = Form(...),
    reason: str = Form(...),
    start_date: Optional[str] = Form(None),
    end_date: Optional[str] = Form(None),
    start_time: Optional[str] = Form(None),
    end_time: Optional[str] = Form(None),
    attachment: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    attachment_url = None
    if attachment and attachment.filename:
        ext = os.path.splitext(attachment.filename)[1]
        fname = f"hr_attach_{uuid.uuid4()}{ext}"
        fpath = os.path.join(UPLOAD_DIR, fname)
        with open(fpath, "wb") as buffer:
            shutil.copyfileobj(attachment.file, buffer)
        attachment_url = f"/uploads/{fname}"
    return crud.create_hr_request(
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

@app.get("/api/hr/requests/me", response_model=List[schemas.HRRequestResponse])
def get_my_requests(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    return crud.get_user_hr_requests(db, current_user.id)

@app.get("/api/hr/requests/all", response_model=List[schemas.HRRequestResponse])
def get_all_requests(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    is_hr = current_user.username == 'admin' or user_has_hr_management(current_user, db)
    
    # Check if they are a manager to anyone
    subordinates_count = db.query(models.User).filter(models.User.manager_id == current_user.id).count()
    is_manager = subordinates_count > 0
    
    if not is_hr and not is_manager:
        raise HTTPException(status_code=403, detail="غير مصرح لك بإدارة طلبات الموظفين")
        
    all_reqs = crud.get_all_hr_requests(db)
    if is_hr:
        return all_reqs
    else:
        # Only return requests of subordinates
        return [r for r in all_reqs if r.user and r.user.manager_id == current_user.id]

@app.put("/api/hr/requests/{request_id}/status", response_model=schemas.HRRequestResponse)
def change_request_status(
    request_id: int,
    payload: schemas.HRRequestStatusUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
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
        
    target_status = payload.status # 'موافق' or 'مرفوض'
    
    # Only "مغادرة" (departure) or "اجازة" (leave/vacation) require hierarchical approval.
    # Other request types can be approved directly by HR.
    is_hierarchical = db_req.request_type in ["مغادرة", "اجازة"]
    
    if target_status == 'مرفوض':
        # Any party can reject, which puts the status to 'مرفوض'
        db_req.status = 'مرفوض'
    elif target_status == 'موافق':
        if is_hierarchical and requester_manager_id is not None:
            # Requesters with a direct manager must get direct manager's approval first
            if is_direct_manager:
                db_req.status = 'تمت الموافقة من قبل المدير المباشر وبانتظار الموافقة من شؤون الموظفين'
            elif is_hr:
                # HR can only approve if direct manager has already approved
                if db_req.status == 'تمت الموافقة من قبل المدير المباشر وبانتظار الموافقة من شؤون الموظفين':
                    db_req.status = 'موافق'
                else:
                    raise HTTPException(status_code=400, detail="يجب الحصول على موافقة المدير المباشر أولاً")
        else:
            # Requesters with no manager, or non-hierarchical requests: HR can approve directly
            if is_hr:
                db_req.status = 'موافق'
            else:
                # If a direct manager approved a non-hierarchical or no-manager request, just set it to approved by manager
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
    return db_req


@app.post("/api/hr/attendance/log", response_model=schemas.AttendanceRecordResponse)
def log_my_attendance(
    record_date: str = Form(...),
    check_in: Optional[str] = Form(None),
    check_out: Optional[str] = Form(None),
    status: str = Form("حاضر"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    return crud.log_attendance(
        db=db,
        user_id=current_user.id,
        record_date=record_date,
        check_in=check_in,
        check_out=check_out,
        status=status
    )

@app.get("/api/hr/attendance/me", response_model=List[schemas.AttendanceRecordResponse])
def get_my_attendance(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    return crud.get_user_attendance(db, current_user.id)


@app.delete("/api/hr/requests/{request_id}")
def delete_hr_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
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

# --- SERVICE JOBS & CLIENTS ENDPOINTS ---

@app.get("/api/service-jobs", response_model=List[schemas.ServiceJobResponse], include_in_schema=False)
@app.get("/api/service-jobs/", response_model=List[schemas.ServiceJobResponse])
def get_service_jobs(
    status: Optional[str] = None,
    client_name: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    return crud.get_service_jobs(db, status=status, client_name=client_name)

@app.get("/api/service-jobs/next-number")
def get_next_service_job_number(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    next_num = crud.get_next_service_job_number(db)
    return {"next_job_number": next_num}

@app.get("/api/service-jobs/{job_id}", response_model=schemas.ServiceJobResponse)
def get_service_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    job = crud.get_service_job_by_id(db, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="العمل غير موجود")
    return job

@app.post("/api/service-jobs", response_model=schemas.ServiceJobResponse, include_in_schema=False)
@app.post("/api/service-jobs/", response_model=schemas.ServiceJobResponse)
def create_service_job(
    job: schemas.ServiceJobCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if not job.job_number or not job.job_number.strip():
        job.job_number = crud.get_next_service_job_number(db)
    else:
        job.job_number = job.job_number.strip()

    existing = crud.get_service_job_by_number(db, job.job_number)
    if existing:
        raise HTTPException(status_code=400, detail="رقم الإنتاج مسجل مسبقاً، الرجاء اختيار رقم آخر")
    return crud.create_service_job(db, job, user_id=current_user.id)

@app.put("/api/service-jobs/{job_id}", response_model=schemas.ServiceJobResponse)
def update_service_job(
    job_id: int,
    job_update: schemas.ServiceJobUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if job_update.job_number:
        job_update.job_number = job_update.job_number.strip()
        existing = crud.get_service_job_by_number(db, job_update.job_number)
        if existing and existing.id != job_id:
            raise HTTPException(status_code=400, detail="رقم الإنتاج مسجل مسبقاً لعمل آخر")
    updated = crud.update_service_job(db, job_id, job_update)
    if not updated:
        raise HTTPException(status_code=404, detail="العمل غير موجود")
    return updated

@app.delete("/api/service-jobs/{job_id}")
def delete_service_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    success = crud.delete_service_job(db, job_id)
    if not success:
        raise HTTPException(status_code=404, detail="العمل غير موجود")
    return {"message": "تم حذف العمل بنجاح"}

@app.post("/api/service-jobs/{job_id}/attachments/", response_model=schemas.ServiceJobAttachmentResponse)
def create_service_job_attachment(
    job_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    job = crud.get_service_job_by_id(db, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="العمل غير موجود")
    if file and file.filename:
        file_ext = os.path.splitext(file.filename)[1]
        filename = f"service_{uuid.uuid4()}{file_ext}"
        file_path = os.path.join(UPLOAD_DIR, filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        file_url = f"/uploads/{filename}"
        return crud.create_service_job_attachment(db, job_id, file.filename, file_url)
    raise HTTPException(status_code=400, detail="الملف غير صالح")

@app.delete("/api/service-jobs/attachments/{attachment_id}")
def delete_service_job_attachment(
    attachment_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    success = crud.delete_service_job_attachment(db, attachment_id)
    if not success:
        raise HTTPException(status_code=404, detail="المرفق غير موجود")
    return {"message": "تم حذف المرفق بنجاح"}

# --- SERVICE CLIENTS ENDPOINTS ---

@app.get("/api/service-clients", response_model=List[schemas.ServiceClientResponse], include_in_schema=False)
@app.get("/api/service-clients/", response_model=List[schemas.ServiceClientResponse])
def get_service_clients(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    return crud.get_service_clients(db)

@app.post("/api/service-clients", response_model=schemas.ServiceClientResponse, include_in_schema=False)
@app.post("/api/service-clients/", response_model=schemas.ServiceClientResponse)
def create_service_client(
    client: schemas.ServiceClientCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
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

@app.put("/api/service-clients/{client_id}", response_model=schemas.ServiceClientResponse)
def update_service_client(
    client_id: int,
    client_update: schemas.ServiceClientUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
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


@app.delete("/api/service-clients/{client_id}")
def delete_service_client(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    success = crud.delete_service_client(db, client_id)
    if not success:
        raise HTTPException(status_code=404, detail="العميل غير موجود")
    return {"message": "تم حذف العميل بنجاح"}

# Serve frontend files

def get_frontend_dir():
    if getattr(sys, 'frozen', False):
        # PyInstaller extracts bundled data files to a temporary folder sys._MEIPASS
        return os.path.join(sys._MEIPASS, "frontend")
    return os.path.abspath(os.path.join(os.path.dirname(__file__), "frontend"))

frontend_dir = get_frontend_dir()
app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")
