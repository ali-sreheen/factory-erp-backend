from sqlalchemy.orm import Session
import models
import schemas
import auth

def get_user_by_username(db: Session, username: str):
    return db.query(models.User).filter(models.User.username == username).first()

def get_all_users(db: Session):
    return db.query(models.User).order_by(models.User.id.asc()).all()

def create_user(db: Session, user: schemas.UserCreate):
    hashed_pwd = auth.get_password_hash(user.password)
    db_user = models.User(username=user.username, hashed_password=hashed_pwd)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def update_user(db: Session, user_id: int, username: str, password: str = None):
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if db_user:
        db_user.username = username
        if password:
            db_user.hashed_password = auth.get_password_hash(password)
        db.commit()
        db.refresh(db_user)
        return db_user
    return None

def seed_admin_user(db: Session):
    admin_user = get_user_by_username(db, "admin")
    if not admin_user:
        # Create admin user with default password admin123
        hashed_pwd = auth.get_password_hash("admin123")
        db_user = models.User(username="admin", hashed_password=hashed_pwd)
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
        return db_user
    return admin_user

def get_items(db: Session, category: str = None, subcategory: str = None):
    query = db.query(models.Item)
    if category:
        query = query.filter(models.Item.category == category)
    if subcategory:
        query = query.filter(models.Item.subcategory == subcategory)
    items = query.all()
    for item in items:
        for res in item.reservations:
            res.username = res.user.username if res.user else "النظام"
    return items

def create_item(db: Session, name: str, category: str, quantity: int, subcategory: str = None, description: str = None, image_url: str = None):
    db_item = models.Item(
        name=name,
        category=category,
        subcategory=subcategory,
        quantity=quantity,
        description=description,
        image_url=image_url
    )
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    
    # Create an initial transaction if opening quantity > 0
    if quantity != 0:
        create_transaction(
            db=db,
            item_id=db_item.id,
            change=quantity,
            project_name="الرصيد الافتتاحي",
            notes="الكمية الافتتاحية عند إنشاء البند",
            user_id=None
        )
        
    return db_item

def create_transaction(db: Session, item_id: int, change: int, project_name: str = None, project_id: int = None, notes: str = None, user_id: int = None):
    # 1. Add Transaction record
    db_tx = models.Transaction(
        item_id=item_id,
        change=change,
        project_name=project_name,
        project_id=project_id,
        notes=notes,
        user_id=user_id
    )
    db.add(db_tx)
    
    # 2. Update Item Quantity
    db_item = db.query(models.Item).filter(models.Item.id == item_id).first()
    if db_item:
        db_item.quantity += change
        db.add(db_item)
        db.commit()
        db.refresh(db_item)
        db.refresh(db_tx)
        return db_tx
    return None

def get_item_transactions(db: Session, item_id: int):
    txs = db.query(models.Transaction).filter(models.Transaction.item_id == item_id).order_by(models.Transaction.timestamp.desc()).all()
    for tx in txs:
        # Dynamically attach username for Pydantic schema serialization
        if tx.user:
            tx.username = tx.user.username
        else:
            tx.username = "النظام"
    return txs

def delete_last_transaction(db: Session, item_id: int):
    # Get the last transaction for the item
    last_tx = db.query(models.Transaction).filter(models.Transaction.item_id == item_id).order_by(models.Transaction.timestamp.desc()).first()
    if not last_tx:
        return None
        
    # Revert quantity on the Item
    db_item = db.query(models.Item).filter(models.Item.id == item_id).first()
    if db_item:
        db_item.quantity -= last_tx.change
        db.delete(last_tx)
        db.commit()
        db.refresh(db_item)
        return db_item
    return None

def update_item_image(db: Session, item_id: int, image_url: str):
    db_item = db.query(models.Item).filter(models.Item.id == item_id).first()
    if db_item:
        db_item.image_url = image_url
        db.commit()
        db.refresh(db_item)
        return db_item
    return None

def update_item_info(db: Session, item_id: int, name: str = None, description: str = None):
    db_item = db.query(models.Item).filter(models.Item.id == item_id).first()
    if db_item:
        if name is not None:
            db_item.name = name
        if description is not None:
            db_item.description = description
        db.commit()
        db.refresh(db_item)
        return db_item
    return None

def create_reservation(db: Session, item_id: int, quantity: int, project_name: str, user_id: int, project_id: int = None):
    db_item = db.query(models.Item).filter(models.Item.id == item_id).first()
    if not db_item:
        return None
        
    reserved_sum = sum(res.quantity for res in db_item.reservations)
    available_qty = db_item.quantity - reserved_sum
    
    if quantity > available_qty:
        raise ValueError("الكمية المطلوبة للحجز تتجاوز الرصيد المتاح حالياً")
        
    db_res = models.Reservation(
        item_id=item_id,
        user_id=user_id,
        quantity=quantity,
        project_name=project_name,
        project_id=project_id
    )
    db.add(db_res)
    db.commit()
    db.refresh(db_res)
    
    db_res.username = db_res.user.username if db_res.user else "النظام"
    return db_res

def get_item_reservations(db: Session, item_id: int):
    res_list = db.query(models.Reservation).filter(models.Reservation.item_id == item_id).order_by(models.Reservation.timestamp.desc()).all()
    for res in res_list:
        res.username = res.user.username if res.user else "النظام"
    return res_list

def delete_reservation(db: Session, reservation_id: int):
    db_res = db.query(models.Reservation).filter(models.Reservation.id == reservation_id).first()
    if db_res:
        db.delete(db_res)
        db.commit()
        return True
    return False

# --- Departments ---
def get_departments(db: Session):
    return db.query(models.Department).all()

def create_department(db: Session, name: str):
    db_dept = models.Department(name=name)
    db.add(db_dept)
    db.commit()
    db.refresh(db_dept)
    return db_dept

def delete_department(db: Session, department_id: int):
    # Check if there are any items in this department
    db_dept = db.query(models.Department).filter(models.Department.id == department_id).first()
    if not db_dept:
        return False
    
    items_count = db.query(models.Item).filter(models.Item.category == db_dept.name).count()
    if items_count > 0:
        raise ValueError("لا يمكن حذف القسم لوجود بنود تابعة له")
        
    db.delete(db_dept)
    db.commit()
    return True

# --- SubDepartments ---
def create_subdepartment(db: Session, department_id: int, name: str):
    db_sub = models.SubDepartment(department_id=department_id, name=name)
    db.add(db_sub)
    db.commit()
    db.refresh(db_sub)
    return db_sub

def delete_subdepartment(db: Session, subdepartment_id: int):
    db_sub = db.query(models.SubDepartment).filter(models.SubDepartment.id == subdepartment_id).first()
    if not db_sub:
        return False
        
    # Check if items exist
    items_count = db.query(models.Item).filter(models.Item.subcategory == db_sub.name).count()
    if items_count > 0:
        raise ValueError("لا يمكن حذف القسم الفرعي لوجود بنود تابعة له")

    db.delete(db_sub)
    db.commit()
    return True

# --- User Permissions ---
def get_user_permissions(db: Session, user_id: int):
    return db.query(models.UserPermission).filter(models.UserPermission.user_id == user_id).all()

def set_user_permission(db: Session, user_id: int, department_name: str, can_edit: int):
    db_perm = db.query(models.UserPermission).filter(
        models.UserPermission.user_id == user_id,
        models.UserPermission.department_name == department_name
    ).first()
    
    if db_perm:
        db_perm.can_edit = can_edit
    else:
        db_perm = models.UserPermission(
            user_id=user_id,
            department_name=department_name,
            can_edit=can_edit
        )
        db.add(db_perm)
        
    db.commit()
    db.refresh(db_perm)
    return db_perm

def remove_user_permission(db: Session, user_id: int, department_name: str):
    db_perm = db.query(models.UserPermission).filter(
        models.UserPermission.user_id == user_id,
        models.UserPermission.department_name == department_name
    ).first()
    if db_perm:
        db.delete(db_perm)
        db.commit()
        return True
    return False

def delete_item(db: Session, item_id: int):
    db_item = db.query(models.Item).filter(models.Item.id == item_id).first()
    if db_item:
        db.delete(db_item)
        db.commit()
        return True
    return False

# --- Projects ---
def create_project(db: Session, project: schemas.ProjectCreate):
    db_project = models.Project(**project.model_dump())
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    return db_project

def get_projects(db: Session):
    return db.query(models.Project).order_by(models.Project.id.desc()).all()

def get_project_by_id(db: Session, project_id: int):
    return db.query(models.Project).filter(models.Project.id == project_id).first()

def update_project(db: Session, project_id: int, project_update: schemas.ProjectUpdate):
    db_project = get_project_by_id(db, project_id)
    if db_project:
        update_data = project_update.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_project, key, value)
        db.commit()
        db.refresh(db_project)
        return db_project
    return None

def delete_project(db: Session, project_id: int):
    db_project = get_project_by_id(db, project_id)
    if db_project:
        db.delete(db_project)
        db.commit()
        return True
    return False

# --- Project Details ---
def create_project_detail(db: Session, project_id: int, detail: schemas.ProjectDetailCreate):
    db_detail = models.ProjectDetail(**detail.model_dump(), project_id=project_id)
    db.add(db_detail)
    db.commit()
    db.refresh(db_detail)
    return db_detail

def delete_project_detail(db: Session, detail_id: int):
    db_detail = db.query(models.ProjectDetail).filter(models.ProjectDetail.id == detail_id).first()
    if db_detail:
        db.delete(db_detail)
        db.commit()
        return True
    return False

# --- Project Attachments ---
def create_project_attachment(db: Session, project_id: int, file_name: str, file_url: str):
    db_attachment = models.ProjectAttachment(project_id=project_id, file_name=file_name, file_url=file_url)
    db.add(db_attachment)
    db.commit()
    db.refresh(db_attachment)
    return db_attachment

def delete_project_attachment(db: Session, attachment_id: int):
    db_attachment = db.query(models.ProjectAttachment).filter(models.ProjectAttachment.id == attachment_id).first()
    if db_attachment:
        db.delete(db_attachment)
        db.commit()
        return True
    return False

# --- Project Tasks ---
def create_project_task(db: Session, task: schemas.ProjectTaskCreate, project_id: int, created_by: int):
    db_task = models.ProjectTask(**task.model_dump(), project_id=project_id, created_by=created_by)
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task

def get_project_tasks(db: Session, project_id: int):
    return db.query(models.ProjectTask).filter(models.ProjectTask.project_id == project_id).all()

def update_project_task(db: Session, task_id: int, task_update: schemas.ProjectTaskUpdate):
    db_task = db.query(models.ProjectTask).filter(models.ProjectTask.id == task_id).first()
    if db_task:
        update_data = task_update.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_task, key, value)
        db.commit()
        db.refresh(db_task)
        return db_task
    return None

def delete_project_task(db: Session, task_id: int):
    db_task = db.query(models.ProjectTask).filter(models.ProjectTask.id == task_id).first()
    if db_task:
        db.delete(db_task)
        db.commit()
        return True
    return False
