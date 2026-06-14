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
    query = query.order_by(models.Item.position.asc(), models.Item.id.asc())
    items = query.all()
    for item in items:
        for res in item.reservations:
            res.username = res.user.username if res.user else "النظام"
    return items

def create_item(db: Session, name: str, category: str, quantity: int, subcategory: str = None, description: str = None, image_url: str = None):
    # Generate SKU
    dept = db.query(models.Department).filter(models.Department.name == category).first()
    dept_id = dept.id if dept else 0
    
    subdept_id = 0
    if subcategory:
        subdept = db.query(models.SubDepartment).filter(models.SubDepartment.name == subcategory).first()
        if subdept:
            subdept_id = subdept.id
            
    query = db.query(models.Item.sku).filter(models.Item.category == category)
    if subcategory:
        query = query.filter(models.Item.subcategory == subcategory)
    else:
        query = query.filter((models.Item.subcategory == None) | (models.Item.subcategory == ""))
        
    max_sku_row = query.order_by(models.Item.sku.desc()).first()
    if max_sku_row and max_sku_row[0]:
        try:
            seq = int(max_sku_row[0][-3:]) + 1
        except ValueError:
            seq = 1
    else:
        seq = 1
        
    sku = f"{dept_id % 100:02d}{subdept_id % 100:02d}{seq % 1000:03d}"

    db_item = models.Item(
        sku=sku,
        name=name,
        category=category,
        subcategory=subcategory,
        quantity=0,
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
        try:
            # Delete related reservations to release items/reservations
            db.query(models.Reservation).filter(models.Reservation.project_id == project_id).delete()
            # Set project_id to None in transactions to keep historical records of inventory movement
            db.query(models.Transaction).filter(models.Transaction.project_id == project_id).update({models.Transaction.project_id: None})
            
            db.delete(db_project)
            db.commit()
            return True
        except Exception as e:
            db.rollback()
            import traceback
            print("ERROR IN delete_project:")
            traceback.print_exc()
            raise e
    return False


# --- Project Details ---
def create_project_detail(db: Session, project_id: int, detail: schemas.ProjectDetailCreate):
    db_detail = models.ProjectDetail(**detail.model_dump(), project_id=project_id)
    
    # Auto-increment sticker_number for new fire resistant doors if sticker_number is empty/null
    if db_detail.fire_resistance in ["Yes", "نعم", "YES"]:
        if not db_detail.sticker_number:
            # Query all sticker numbers
            all_stickers = db.query(models.ProjectDetail.sticker_number).filter(
                models.ProjectDetail.sticker_number != None,
                models.ProjectDetail.sticker_number != ""
            ).all()
            
            max_num = 0
            import re
            for (s_num,) in all_stickers:
                try:
                    digits = re.findall(r'\d+', s_num)
                    if digits:
                        val = int(digits[-1])
                        if val > max_num:
                            max_num = val
                except Exception:
                    pass
            db_detail.sticker_number = str(max_num + 1)

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

def delete_project_details(db: Session, project_id: int):
    db.query(models.ProjectDetail).filter(models.ProjectDetail.project_id == project_id).delete()
    db.commit()
    return True

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

def move_item(db: Session, item_id: int, new_category: str, new_subcategory: str, user_id: int):
    item = db.query(models.Item).filter(models.Item.id == item_id).first()
    if not item:
        return None
    
    old_category = item.category
    old_subcategory = item.subcategory
    
    item.category = new_category
    item.subcategory = new_subcategory
    
    # Create transaction log
    action_text = f'نقل البند من {old_category}'
    if old_subcategory:
        action_text += f' / {old_subcategory}'
    action_text += f' إلى {new_category}'
    if new_subcategory:
        action_text += f' / {new_subcategory}'
        
    tx = models.Transaction(
        item_id=item_id,
        user_id=user_id,
        change=0,
        project_name=action_text
    )
    db.add(tx)
    db.commit()
    db.refresh(item)
    return item

def get_project_options(db: Session, option_type: str = None):
    query = db.query(models.ProjectOption)
    if option_type:
        query = query.filter(models.ProjectOption.option_type == option_type)
    return query.order_by(models.ProjectOption.name.asc()).all()

def create_project_option(db: Session, option: schemas.ProjectOptionCreate):
    db_opt = models.ProjectOption(**option.model_dump())
    db.add(db_opt)
    db.commit()
    db.refresh(db_opt)
    return db_opt

def update_project_option(db: Session, option_id: int, name: str, sku: str = None):
    db_opt = db.query(models.ProjectOption).filter(models.ProjectOption.id == option_id).first()
    if db_opt:
        db_opt.name = name
        db_opt.sku = sku if sku else None
        db.commit()
        db.refresh(db_opt)
        return db_opt
    return None

def delete_project_option(db: Session, option_id: int):
    db_opt = db.query(models.ProjectOption).filter(models.ProjectOption.id == option_id).first()
    if db_opt:
        db.delete(db_opt)
        db.commit()
        return True
    return False

def seed_default_project_options(db: Session):
    if not db.query(models.ProjectOption).first():
        # Seed locks
        locks = ["devon mortice lock", "euroart mortice lock", "euroart roller", "consort mortice lock", "special"]
        for lock in locks:
            db.add(models.ProjectOption(option_type="lock", name=lock))
        # Seed hinges
        hinges = ["Devon", "vantage", "euroart", "consort", "conseld", "spical"]
        for hinge in hinges:
            db.add(models.ProjectOption(option_type="hinge", name=hinge))
        db.commit()

def get_sheet_sizes(db: Session, thickness: float = None):
    query = db.query(models.SheetSize)
    if thickness is not None:
        query = query.filter(models.SheetSize.thickness == thickness)
    return query.order_by(models.SheetSize.thickness.asc(), models.SheetSize.width.asc()).all()

def create_sheet_size(db: Session, sheet_size: schemas.SheetSizeCreate):
    db_size = models.SheetSize(**sheet_size.model_dump())
    db.add(db_size)
    db.commit()
    db.refresh(db_size)
    return db_size

def update_sheet_size(db: Session, sheet_size_id: int, thickness: float, width: float, height: float, sku: str = None):
    db_size = db.query(models.SheetSize).filter(models.SheetSize.id == sheet_size_id).first()
    if db_size:
        db_size.thickness = thickness
        db_size.width = width
        db_size.height = height
        db_size.sku = sku if sku else None
        db.commit()
        db.refresh(db_size)
        return db_size
    return None

def delete_sheet_size(db: Session, sheet_size_id: int):
    db_size = db.query(models.SheetSize).filter(models.SheetSize.id == sheet_size_id).first()
    if db_size:
        db.delete(db_size)
        db.commit()
        return True
    return False

def seed_default_sheet_sizes(db: Session):
    if not db.query(models.SheetSize).first():
        defaults = [
            (1.5, 100.0, 230.0),
            (1.5, 125.0, 230.0),
            (1.5, 125.0, 250.0),
            (1.2, 100.0, 230.0),
            (1.2, 125.0, 230.0),
            (1.2, 125.0, 250.0),
        ]
        for thickness, width, height in defaults:
            db.add(models.SheetSize(thickness=thickness, width=width, height=height))
        db.commit()
