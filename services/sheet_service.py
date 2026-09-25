from typing import Dict, Any, List, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func
import models
import crud
from sheet_calculator import calculate_sheets

def get_project_sheet_requirements(db: Session, project: models.Project) -> dict:
    """Calculates required sheet metal for a given project based on its door details."""
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

def check_if_project_category_reserved(db: Session, project_id: int, category: str) -> Tuple[bool, str]:
    """Checks if a project already has reservations committed for the specified category."""
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

    return already_reserved, error_msg

def perform_reserve_check(db: Session, project: models.Project, category: str) -> Dict[str, Any]:
    items_list = []
    
    if category == "sheets":
        calc_res = get_project_sheet_requirements(db, project)
        
        for thickness_key, thickness_val in [("thickness_1_5", 1.5), ("thickness_1_2", 1.2)]:
            for req in calc_res.get(thickness_key, []):
                size_str = req["size"]
                count = req["count"]
                
                try:
                    parts = size_str.split("*")
                    w_val = float(parts[0])
                    h_val = float(parts[1])
                except (ValueError, IndexError):
                    w_val = 0.0
                    h_val = 0.0
                
                sheet_size = db.query(models.SheetSize).filter(
                    models.SheetSize.thickness == thickness_val,
                    func.abs(models.SheetSize.width - w_val) < 0.1,
                    func.abs(models.SheetSize.height - h_val) < 0.1
                ).first()
                
                sku = sheet_size.sku if sheet_size else None
                item = None
                if sku:
                    item = db.query(models.Item).filter(models.Item.sku == sku).first()
                
                name = f"لوح صاج {thickness_val} ملم ({size_str})"
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
                    "category": "sheets",
                    "thickness": thickness_val,
                    "size": size_str
                })
                
    elif category in ["accessories", "locks", "hinges"]:
        lock_reqs = {}
        hinge_reqs = {}
        for detail in project.details:
            qty = detail.quantity if detail.quantity is not None else 1
            if detail.lock_type:
                lock_reqs[detail.lock_type] = lock_reqs.get(detail.lock_type, 0) + qty
            if detail.hinges:
                h_cnt = detail.hinges_count if (detail.hinges_count is not None) else 4
                hinge_reqs[detail.hinges] = hinge_reqs.get(detail.hinges, 0) + (qty * h_cnt)
                
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

def perform_reserve_commit(db: Session, project: models.Project, category: str, current_user: models.User) -> Dict[str, List]:
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
            reason = status
            skipped_items.append({"name": name, "sku": sku, "quantity": required, "reason": reason})
            
    return {
        "reserved": reserved_items,
        "skipped": skipped_items
    }
