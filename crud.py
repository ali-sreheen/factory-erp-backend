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

def create_transaction(db: Session, item_id: int, change: int, project_name: str = None, notes: str = None, user_id: int = None):
    # 1. Add Transaction record
    db_tx = models.Transaction(
        item_id=item_id,
        change=change,
        project_name=project_name,
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

def update_item_description(db: Session, item_id: int, description: str):
    db_item = db.query(models.Item).filter(models.Item.id == item_id).first()
    if db_item:
        db_item.description = description
        db.commit()
        db.refresh(db_item)
        return db_item
    return None

def create_reservation(db: Session, item_id: int, quantity: int, project_name: str, user_id: int):
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
        project_name=project_name
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
