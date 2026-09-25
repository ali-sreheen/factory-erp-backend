from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Form
from sqlalchemy.orm import Session
import models
import schemas
import crud
from core.database import get_db
from core.permissions import get_current_user, check_permission
from services.file_service import save_uploaded_file
from services.notification_service import dispatch_inventory_transaction_notification

router = APIRouter(tags=["inventory"])

# --- ITEMS ---

@router.post("/api/items/", response_model=schemas.Item)
def create_item(
    name: str = Form(...),
    description: Optional[str] = Form(None),
    category: str = Form(...),
    subcategory: Optional[str] = Form(None),
    quantity: int = Form(0),
    image: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    check_permission(db, current_user, category)
    image_url = save_uploaded_file(image, prefix="item")
    
    return crud.create_item(
        db=db,
        name=name,
        category=category,
        subcategory=subcategory if subcategory else None,
        quantity=quantity,
        description=description if description else None,
        image_url=image_url
    )

@router.get("/api/items/", response_model=List[schemas.Item])
def read_items(
    category: str = None, 
    subcategory: str = None, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    return crud.get_items(db, category=category, subcategory=subcategory)

@router.put("/api/items/reorder")
def reorder_items(
    item_ids: List[int],
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
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

@router.put("/api/items/{item_id}/move", response_model=schemas.Item)
def move_item(
    item_id: int,
    move_data: schemas.ItemMove,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
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

@router.delete("/api/items/{item_id}")
def delete_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
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

# --- TRANSACTIONS ---

@router.post("/api/items/{item_id}/transactions/", response_model=schemas.TransactionResponse)
def create_transaction(
    item_id: int,
    tx: schemas.TransactionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    item = db.query(models.Item).filter(models.Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    check_permission(db, current_user, item.category)
    
    if item.quantity + tx.change < 0:
        raise HTTPException(status_code=400, detail="الكمية المطلوبة للحذف أكبر من الكمية المتوفرة في المستودع")
    
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

    dispatch_inventory_transaction_notification(db, item, tx.change, tx.project_name, current_user)
    return db_tx

@router.get("/api/items/{item_id}/transactions/", response_model=List[schemas.TransactionResponse])
def read_transactions(
    item_id: int, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    return crud.get_item_transactions(db, item_id=item_id)

@router.delete("/api/items/{item_id}/transactions/last", response_model=schemas.Item)
def delete_last_transaction(
    item_id: int, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    item = db.query(models.Item).filter(models.Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    check_permission(db, current_user, item.category)
    
    updated_item = crud.delete_last_transaction(db, item_id=item_id)
    if updated_item is None:
        raise HTTPException(status_code=404, detail="No transactions found to revert or item not found")
    return updated_item

@router.put("/api/items/{item_id}/image", response_model=schemas.Item)
def update_item_image(
    item_id: int,
    image: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.username != "admin":
        raise HTTPException(status_code=403, detail="هذه الصلاحية متاحة للمسؤول (admin) فقط")

    item = db.query(models.Item).filter(models.Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    image_url = save_uploaded_file(image, prefix="item")
    if not image_url:
        raise HTTPException(status_code=400, detail="Invalid image file")
        
    updated_item = crud.update_item_image(db, item_id=item_id, image_url=image_url)
    if updated_item is None:
        raise HTTPException(status_code=404, detail="Item not found")
    return updated_item

@router.put("/api/items/{item_id}/description", response_model=schemas.Item)
def update_item_description(
    item_id: int,
    update_data: schemas.ItemDescriptionUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
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

@router.put("/api/items/{item_id}/info", response_model=schemas.Item)
def update_item_info(
    item_id: int,
    update_data: schemas.ItemUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
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

# --- RESERVATIONS ---

@router.post("/api/items/{item_id}/reservations/", response_model=schemas.ReservationResponse)
def create_item_reservation(
    item_id: int,
    res: schemas.ReservationCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
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

@router.get("/api/items/{item_id}/reservations/", response_model=List[schemas.ReservationResponse])
def read_item_reservations(
    item_id: int, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    return crud.get_item_reservations(db, item_id=item_id)

@router.post("/api/reservations/{reservation_id}/consume")
def consume_item_reservation(
    reservation_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    db_res = db.query(models.Reservation).filter(models.Reservation.id == reservation_id).first()
    if not db_res:
        raise HTTPException(status_code=404, detail="Reservation not found")
        
    item = db.query(models.Item).filter(models.Item.id == db_res.item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
        
    check_permission(db, current_user, item.category)
    
    if item.quantity < db_res.quantity:
        raise HTTPException(status_code=400, detail="الكمية المتوافرة في المخزن غير كافية لإتمام عملية السحب")
        
    crud.create_transaction(
        db=db,
        item_id=item.id,
        change=-db_res.quantity,
        project_name=db_res.project_name,
        project_id=db_res.project_id,
        notes=f"سحب من كمية محجوزة بواسطة: {current_user.username}",
        user_id=current_user.id
    )

    dispatch_inventory_transaction_notification(db, item, -db_res.quantity, db_res.project_name, current_user)
    crud.delete_reservation(db, reservation_id=reservation_id)
    return {"message": "تم سحب الكمية وحذف الحجز بنجاح"}

@router.delete("/api/reservations/{reservation_id}")
def delete_item_reservation(
    reservation_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
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

# --- DEPARTMENTS ---

@router.get("/api/departments/", response_model=List[schemas.DepartmentResponse])
def read_departments(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return crud.get_departments(db)

@router.post("/api/departments/", response_model=schemas.DepartmentResponse)
def create_department(dept: schemas.DepartmentCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.username != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    return crud.create_department(db, name=dept.name)

@router.delete("/api/departments/{department_id}")
def delete_department(department_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.username != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    try:
        success = crud.delete_department(db, department_id=department_id)
        if not success:
            raise HTTPException(status_code=404, detail="Department not found")
        return {"message": "Deleted successfully"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/api/departments/{department_id}/sub/", response_model=schemas.SubDepartmentResponse)
def create_subdepartment(department_id: int, sub: schemas.SubDepartmentCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.username != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    return crud.create_subdepartment(db, department_id=department_id, name=sub.name)

@router.delete("/api/subdepartments/{subdepartment_id}")
def delete_subdepartment(subdepartment_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.username != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    try:
        success = crud.delete_subdepartment(db, subdepartment_id=subdepartment_id)
        if not success:
            raise HTTPException(status_code=404, detail="SubDepartment not found")
        return {"message": "Deleted successfully"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
