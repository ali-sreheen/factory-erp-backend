from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Form
from sqlalchemy.orm import Session
from sqlalchemy import func

import models
import schemas
import crud
from core.database import get_db
from core.permissions import get_current_user, check_purchasing_permission
from services.file_service import save_uploaded_file

router = APIRouter(tags=["purchasing"])

# --- SUPPLIERS ---

@router.get("/api/suppliers/", response_model=List[schemas.SupplierResponse])
def get_suppliers(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return db.query(models.Supplier).all()

@router.post("/api/suppliers/", response_model=schemas.SupplierResponse)
def create_supplier(supplier: schemas.SupplierCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    check_purchasing_permission(current_user, "purchasing_suppliers", db)
    db_supplier = models.Supplier(**supplier.model_dump())
    db.add(db_supplier)
    db.commit()
    db.refresh(db_supplier)
    return db_supplier

@router.put("/api/suppliers/{supplier_id}", response_model=schemas.SupplierResponse)
def update_supplier(supplier_id: int, supplier_update: schemas.SupplierUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
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

@router.delete("/api/suppliers/{supplier_id}")
def delete_supplier(supplier_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    check_purchasing_permission(current_user, "purchasing_suppliers", db)
    db_supplier = db.query(models.Supplier).filter(models.Supplier.id == supplier_id).first()
    if not db_supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    db.delete(db_supplier)
    db.commit()
    return {"message": "Deleted successfully"}

# --- CONTRACTORS ---

@router.get("/api/contractors/", response_model=List[schemas.ContractorResponse])
def get_contractors(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return db.query(models.Contractor).all()

@router.post("/api/contractors/", response_model=schemas.ContractorResponse)
def create_contractor(contractor: schemas.ContractorCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    db_contractor = models.Contractor(**contractor.model_dump())
    db.add(db_contractor)
    db.commit()
    db.refresh(db_contractor)
    return db_contractor

@router.put("/api/contractors/{contractor_id}", response_model=schemas.ContractorResponse)
def update_contractor(contractor_id: int, contractor_update: schemas.ContractorUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    db_contractor = db.query(models.Contractor).filter(models.Contractor.id == contractor_id).first()
    if not db_contractor:
        raise HTTPException(status_code=404, detail="Contractor not found")
    
    update_data = contractor_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_contractor, key, value)
        
    db.commit()
    db.refresh(db_contractor)
    return db_contractor

@router.delete("/api/contractors/{contractor_id}")
def delete_contractor(contractor_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    db_contractor = db.query(models.Contractor).filter(models.Contractor.id == contractor_id).first()
    if not db_contractor:
        raise HTTPException(status_code=404, detail="Contractor not found")
    db.delete(db_contractor)
    db.commit()
    return {"message": "Contractor deleted successfully"}

# --- PURCHASE REQUESTS ---

@router.get("/api/purchase-requests/", response_model=List[schemas.PurchaseRequestResponse])
def get_purchase_requests(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return db.query(models.PurchaseRequest).order_by(models.PurchaseRequest.created_at.desc()).all()

@router.post("/api/purchase-requests/", response_model=schemas.PurchaseRequestResponse)
def create_purchase_request(
    title: str = Form(...),
    description: Optional[str] = Form(None),
    quantity: Optional[int] = Form(None),
    expected_price: Optional[str] = Form(None),
    req_id: Optional[int] = Form(None),
    attached_image: UploadFile = File(None),
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_user)
):
    check_purchasing_permission(current_user, "purchasing_create", db)
    attached_image_url = save_uploaded_file(attached_image, prefix="attached")

    db_req = models.PurchaseRequest(
        title=title,
        description=description,
        quantity=quantity,
        expected_price=expected_price,
        attached_image_url=attached_image_url,
        requested_by_id=current_user.id
    )
    if req_id is not None:
        existing = db.query(models.PurchaseRequest).filter(models.PurchaseRequest.id == req_id).first()
        if existing:
            raise HTTPException(status_code=400, detail="رقم الطلب هذا موجود مسبقاً")
        db_req.id = req_id
    else:
        max_id = db.query(func.max(models.PurchaseRequest.id)).scalar()
        db_req.id = (max_id + 1) if max_id is not None else 1
            
    db.add(db_req)
    db.commit()
    db.refresh(db_req)
    try:
        user_name = current_user.full_name or current_user.username
        crud.broadcast_notification(
            db=db,
            title="إنشاء طلب شراء",
            message=f"قام {user_name} بإنشاء طلب شراء جديد: {db_req.title} (رقم: #{db_req.id})",
            notif_type="purchase_request_created",
            reference_id=db_req.id
        )
    except Exception as e:
        print(f"[NOTIF ERROR] purchase_request_created: {e}")
    return db_req

@router.get("/api/purchase-requests/{req_id}", response_model=schemas.PurchaseRequestResponse)
def get_purchase_request(req_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    db_req = db.query(models.PurchaseRequest).filter(models.PurchaseRequest.id == req_id).first()
    if not db_req:
        raise HTTPException(status_code=404, detail="Purchase request not found")
    return db_req

@router.put("/api/purchase-requests/{req_id}", response_model=schemas.PurchaseRequestResponse)
def update_purchase_request(req_id: int, req_update: schemas.PurchaseRequestUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    db_req = db.query(models.PurchaseRequest).filter(models.PurchaseRequest.id == req_id).first()
    if not db_req:
        raise HTTPException(status_code=404, detail="Purchase request not found")
    
    old_status = db_req.status
    update_data = req_update.model_dump(exclude_unset=True)
    
    if "status" in update_data:
        check_purchasing_permission(current_user, "purchasing_status", db)

    for key, value in update_data.items():
        setattr(db_req, key, value)
        
    db.commit()
    db.refresh(db_req)

    if "status" in update_data:
        new_status = update_data["status"]
        if str(old_status).strip().lower() != str(new_status).strip().lower():
            if str(new_status).strip().lower() in ["purchased", "completed", "تم الشراء", "مكتمل"]:
                try:
                    user_name = current_user.full_name or current_user.username
                    crud.broadcast_notification(
                        db=db,
                        title="إتمام طلب شراء",
                        message=f"تم إتمام وتأكيد شراء طلب الشراء #{db_req.id} ({db_req.title}) بواسطة {user_name}",
                        notif_type="purchase_request_completed",
                        reference_id=db_req.id
                    )
                except Exception as e:
                    print(f"[NOTIF ERROR] purchase_request_completed: {e}")

    return db_req

@router.put("/api/purchase-requests/{req_id}/details", response_model=schemas.PurchaseRequestResponse)
def update_purchase_request_details(
    req_id: int,
    title: str = Form(...),
    description: Optional[str] = Form(None),
    quantity: Optional[int] = Form(None),
    expected_price: Optional[str] = Form(None),
    attached_image: UploadFile = File(None),
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_user)
):
    check_purchasing_permission(current_user, "purchasing_create", db)
    db_req = db.query(models.PurchaseRequest).filter(models.PurchaseRequest.id == req_id).first()
    if not db_req:
        raise HTTPException(status_code=404, detail="Purchase request not found")
        
    db_req.title = title
    db_req.description = description
    db_req.quantity = quantity
    db_req.expected_price = expected_price
    
    new_attached_url = save_uploaded_file(attached_image, prefix="attached")
    if new_attached_url:
        db_req.attached_image_url = new_attached_url
        
    db.commit()
    db.refresh(db_req)
    return db_req

@router.post("/api/purchase-requests/{req_id}/upload-images", response_model=schemas.PurchaseRequestResponse)
def upload_purchase_images(
    req_id: int,
    invoice_image: UploadFile = File(None),
    items_image: UploadFile = File(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    check_purchasing_permission(current_user, "purchasing_status", db)
    db_req = db.query(models.PurchaseRequest).filter(models.PurchaseRequest.id == req_id).first()
    if not db_req:
        raise HTTPException(status_code=404, detail="Purchase request not found")
        
    invoice_url = save_uploaded_file(invoice_image, prefix="invoice")
    if invoice_url:
        db_req.invoice_image_url = invoice_url

    items_url = save_uploaded_file(items_image, prefix="items")
    if items_url:
        db_req.items_image_url = items_url

    db_req.status = "Purchased"
    db.commit()
    db.refresh(db_req)
    return db_req

@router.delete("/api/purchase-requests/{req_id}")
def delete_purchase_request(req_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    db_req = db.query(models.PurchaseRequest).filter(models.PurchaseRequest.id == req_id).first()
    if not db_req:
        raise HTTPException(status_code=404, detail="Purchase request not found")
    if db_req.requested_by_id != current_user.id and current_user.username != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
        
    db.delete(db_req)
    db.commit()
    return {"message": "Purchase request deleted successfully"}
