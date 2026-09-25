import os
import uuid
import datetime
from typing import List, Optional
from collections import defaultdict
from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, BackgroundTasks
from fastapi.responses import FileResponse
import tempfile
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import or_

import models
import schemas
import crud
from core.database import get_db
from core.permissions import get_current_user, user_has_project_management
from core.config import UPLOAD_DIR
from services.file_service import save_uploaded_file
from services.sheet_service import (
    get_project_sheet_requirements,
    perform_reserve_check,
    perform_reserve_commit,
    check_if_project_category_reserved
)

router = APIRouter(tags=["projects"])

# Helper function for sticker sequence generation
def get_stickers_list(sticker_number: Optional[str], quantity: int) -> list[str]:
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

# --- PROJECTS BASE ---

@router.post("/api/projects/", response_model=schemas.ProjectResponse)
def create_project(project: schemas.ProjectCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    db_project = crud.create_project(db, project)
    try:
        creator_name = current_user.full_name or current_user.username
        crud.broadcast_notification(
            db=db,
            title="مشروع جديد",
            message=f"قام {creator_name} بإضافة مشروع جديد: {db_project.name} (رقم: {db_project.project_number})",
            notif_type="project_created",
            reference_id=db_project.id
        )
    except Exception as e:
        print(f"[NOTIFICATION ERROR] Failed to broadcast project creation: {e}")
    return db_project

@router.get("/api/projects/", response_model=List[schemas.ProjectResponse])
def get_projects(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return crud.get_projects(db)

@router.get("/api/projects/{project_id}", response_model=schemas.ProjectResponse)
def get_project(project_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    project = crud.get_project_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

@router.put("/api/projects/{project_id}", response_model=schemas.ProjectResponse)
def update_project(project_id: int, project_update: schemas.ProjectUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    existing = crud.get_project_by_id(db, project_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Project not found")
        
    if current_user.username != "admin" and current_user.id != existing.executive_manager_id and not user_has_project_management(current_user, db):
        raise HTTPException(status_code=403, detail="Not authorized")
        
    old_status = existing.status
    try:
        project = crud.update_project(db, project_id, project_update)
        if project and project_update.status is not None:
            new_status = project.status
            if str(old_status).strip().lower() != str(new_status).strip().lower():
                status_map = {
                    "pending": "قيد الانتظار (Pending)",
                    "active": "فعال (Active)",
                    "completed": "مكتمل (Completed)"
                }
                old_lbl = status_map.get(str(old_status).strip().lower(), str(old_status))
                new_lbl = status_map.get(str(new_status).strip().lower(), str(new_status))
                updater_name = current_user.full_name or current_user.username
                try:
                    crud.broadcast_notification(
                        db=db,
                        title="تحديث حالة المشروع",
                        message=f"تم تغيير حالة المشروع '{project.name}' (رقم: {project.project_number}) من '{old_lbl}' إلى '{new_lbl}' بواسطة {updater_name}",
                        notif_type="project_status_changed",
                        reference_id=project.id
                    )
                except Exception as e:
                    print(f"[NOTIFICATION ERROR] Failed to broadcast project status change: {e}")
        return project
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/api/projects/{project_id}")
def delete_project(project_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
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

# --- SHEET REQUIREMENTS & RESERVATIONS ---

@router.get("/api/projects/{project_id}/sheet-requirements")
def get_sheet_requirements(project_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    project = crud.get_project_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return get_project_sheet_requirements(db, project)

@router.get("/api/projects/{project_id}/reserve-check")
def reserve_check(
    project_id: int,
    category: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    project = crud.get_project_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    if current_user.username != "admin" and current_user.id != project.executive_manager_id and not user_has_project_management(current_user, db):
        raise HTTPException(status_code=403, detail="Not authorized to perform reservations for this project")
        
    if category not in ["sheets", "accessories", "locks", "hinges"]:
        raise HTTPException(status_code=400, detail="Invalid category. Must be 'sheets', 'accessories', 'locks' or 'hinges'")
        
    already_reserved, _ = check_if_project_category_reserved(db, project_id, category)
    res_data = perform_reserve_check(db, project, category)
    res_data["already_reserved"] = already_reserved
    return res_data

@router.post("/api/projects/{project_id}/reserve-commit")
def reserve_commit(
    project_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    project = crud.get_project_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    if current_user.username != "admin" and current_user.id != project.executive_manager_id and not user_has_project_management(current_user, db):
        raise HTTPException(status_code=403, detail="Not authorized to commit reservations for this project")
        
    category = payload.get("category")
    if category not in ["sheets", "accessories", "locks", "hinges"]:
        raise HTTPException(status_code=400, detail="Invalid category")
        
    already_reserved, error_msg = check_if_project_category_reserved(db, project_id, category)
    if already_reserved:
        raise HTTPException(status_code=400, detail=error_msg)
            
    return perform_reserve_commit(db, project, category, current_user)

# --- PROJECT DETAILS ---

@router.post("/api/projects/{project_id}/details/", response_model=schemas.ProjectDetailResponse)
def create_project_detail(project_id: int, detail: schemas.ProjectDetailCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return crud.create_project_detail(db, project_id, detail)

@router.delete("/api/projects/details/{detail_id}")
def delete_project_detail(detail_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    success = crud.delete_project_detail(db, detail_id)
    if not success:
        raise HTTPException(status_code=404, detail="Detail not found")
    return {"message": "Deleted successfully"}

@router.put("/api/projects/details/{detail_id}", response_model=schemas.ProjectDetailResponse)
def update_project_detail(detail_id: int, detail_update: schemas.ProjectDetailCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
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

class StickerUpdateRequest(BaseModel):
    index: int
    sticker_number: str

@router.put("/api/projects/details/{detail_id}/sticker")
def update_detail_sticker(detail_id: int, payload: StickerUpdateRequest, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
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

@router.delete("/api/projects/{project_id}/details")
def delete_project_details(project_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    project = crud.get_project_by_id(db, project_id)
    if not project or (project.executive_manager_id != current_user.id and current_user.username != "admin" and not user_has_project_management(current_user, db)):
        raise HTTPException(status_code=403, detail="Not authorized")
    crud.delete_project_details(db, project_id)
    return {"message": "All details deleted successfully"}

# --- DXF EXPORT ---

@router.get("/api/projects/{project_id}/dxf")
def export_project_dxf(
    project_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    project = crud.get_project_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    if not project.details:
        raise HTTPException(status_code=400, detail="لا توجد تفاصيل هندسية للأبواب في هذا المشروع")
        
    try:
        import importlib
        import cad_templates.generate_dxf
        importlib.reload(cad_templates.generate_dxf)
        from cad_templates.generate_dxf import generate_full_project_cad_dxf
    except ImportError as e:
        raise HTTPException(status_code=500, detail=f"CAD template engine not available: {str(e)}")

    template_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "cad_templates", "single_rabbet_rubber_single.dxf")
    if not os.path.exists(template_path):
        # Fallback to relative path if run from root
        template_path = "cad_templates/single_rabbet_rubber_single.dxf"

    # Query available sheet sizes from DB
    db_sizes_1_5 = db.query(models.SheetSize).filter(models.SheetSize.thickness == 1.5).all()
    db_sizes_1_2 = db.query(models.SheetSize).filter(models.SheetSize.thickness == 1.2).all()
    
    # Values in DB are in cm, convert to mm (* 10)
    sizes_1_5 = [(float(s.width) * 10, float(s.height) * 10) for s in db_sizes_1_5 if s.width and s.height] if db_sizes_1_5 else None
    sizes_1_2 = [(float(s.width) * 10, float(s.height) * 10) for s in db_sizes_1_2 if s.width and s.height] if db_sizes_1_2 else None

    import json
    import re

    doors_list = []
    for d in project.details:
        qty = d.quantity if d.quantity and d.quantity > 0 else 1
        p_t = str(d.profile_type or "").lower()
        if ("double" in p_t or "مزدوج" in p_t) and ("without" in p_t or "بدون" in p_t):
            def_a1, def_a2 = 4.0, 4.0
        elif "without" in p_t or "بدون" in p_t or p_t == "single rabbit":
            def_a1, def_a2 = 5.5, 4.0
        elif "double" in p_t or "مزدوج" in p_t:
            def_a1, def_a2 = 5.0, 5.0
        else:
            def_a1, def_a2 = 4.0, 6.2

        custom_p = {}
        if d.notes:
            m = re.search(r'\[PROFILE:(.*?)\]', d.notes)
            if m:
                try:
                    custom_p = json.loads(m.group(1))
                except Exception:
                    custom_p = {}

        for q in range(qty):
            name_suffix = f"-{q+1}" if qty > 1 else ""
            doors_list.append({
                "name": f"{d.door_number or 'D'}{name_suffix}",
                "width": float(d.width or 0) * 10,
                "height": float(d.height or 0) * 10,
                "depth": float(d.depth or 0) * 10,
                "direction": d.direction or "RH",
                "architrave": float(d.architrave or def_a1) * 10,
                "architrave_2": float(d.architrave_2 or def_a2) * 10,
                "profile_type": d.profile_type or "single rabbit with rubber",
                "door_type": d.door_type or "Single leaf metal",
                "qashatah": d.qashatah or "NO",
                "drop_seal": (str(d.qashatah or "").upper() in ("YES", "TRUE", "1", "نعم")),
                "fire_resistance": d.fire_resistance or "",
                "custom_profile": custom_p,
                "s1": float(custom_p.get("s1") or custom_p.get("S1") or 15.0),
                "s2": float(custom_p.get("s2") or custom_p.get("S2") or 15.0),
                "r2": float(custom_p.get("r2") or custom_p.get("R2") or 10.5)
            })

    try:
        with tempfile.NamedTemporaryFile(suffix=".dxf", delete=False) as tmp_file:
            temp_output_path = tmp_file.name

        generate_full_project_cad_dxf(
            template_path=template_path,
            output_path=temp_output_path,
            doors=doors_list,
            sheet_sizes_1_5=sizes_1_5,
            sheet_sizes_1_2=sizes_1_2,
            project_number=project.project_number or f"PRJ-{project.id}"
        )

        def cleanup_temp_file(path: str):
            try:
                if os.path.exists(path):
                    os.remove(path)
            except Exception:
                pass

        background_tasks.add_task(cleanup_temp_file, temp_output_path)

        safe_p_number = "".join(c for c in (project.project_number or str(project.id)) if c.isalnum() or c in ('-', '_')).rstrip()
        filename = f"Project_{safe_p_number}_CAD.dxf"

        return FileResponse(
            temp_output_path,
            filename=filename,
            media_type="application/dxf"
        )
    except Exception as e:
        if 'temp_output_path' in locals() and os.path.exists(temp_output_path):
            try:
                os.remove(temp_output_path)
            except Exception:
                pass
        raise HTTPException(status_code=500, detail=f"حدث خطأ أثناء توليد ملف الـ DXF: {str(e)}")

# --- FIRE DOORS ---

@router.get("/api/fire-doors/")
def get_fire_doors(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.username != "admin" and not user_has_project_management(current_user, db):
        raise HTTPException(status_code=403, detail="غير مصرح بالوصول لأبواب الحريق")
        
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
        
        if is_project_active or has_sticker:
            qty = d.quantity if d.quantity and d.quantity > 0 else 1
            stickers = get_stickers_list(d.sticker_number, qty)
            
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

@router.post("/api/fire-doors/bulk-save")
def bulk_save_fire_doors(payload: FireDoorsBulkSaveRequest, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.username != "admin" and not user_has_project_management(current_user, db):
        raise HTTPException(status_code=403, detail="غير مصرح بتعديل أبواب الحريق")
    
    grouped = defaultdict(dict)
    for u in payload.updates:
        grouped[u.id][u.index] = u

    for detail_id, index_map in grouped.items():
        db_detail = db.query(models.ProjectDetail).filter(models.ProjectDetail.id == detail_id).first()
        if not db_detail:
            continue
        
        is_locked = bool(db_detail.is_fire_door_locked)
        if is_locked and current_user.username != "admin":
            continue

        qty = db_detail.quantity if db_detail.quantity and db_detail.quantity > 0 else 1
        stickers = get_stickers_list(db_detail.sticker_number, qty)
        
        for idx, u in index_map.items():
            if 0 <= idx < qty:
                stickers[idx] = u.sticker_number
        
        db_detail.sticker_number = ",".join(stickers)

    db.commit()
    return {"message": "تم حفظ تعديلات أبواب الحريق بنجاح"}

class FireDoorsFinalLockRequest(BaseModel):
    ids: Optional[List[int]] = None

@router.post("/api/fire-doors/final-lock")
def final_lock_fire_doors(payload: Optional[FireDoorsFinalLockRequest] = None, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.username != "admin" and not user_has_project_management(current_user, db):
        raise HTTPException(status_code=403, detail="غير مصرح بإجراء الحفظ النهائي")
        
    query = db.query(models.ProjectDetail).filter(
        or_(
            models.ProjectDetail.fire_resistance.like("Yes%"),
            models.ProjectDetail.fire_resistance.like("نعم%"),
            models.ProjectDetail.fire_resistance.like("YES%")
        )
    )
    
    if payload and payload.ids:
        query = query.filter(models.ProjectDetail.id.in_(payload.ids))
        
    details = query.all()
    if not details:
        raise HTTPException(status_code=404, detail="لم يتم العثور على أي أبواب تطابق الاختيار")

    for d in details:
        proj_status = d.project.status.lower() if (d.project and d.project.status) else ""
        if proj_status != "completed":
            proj_name = d.project.name if d.project else "-"
            raise HTTPException(
                status_code=400, 
                detail=f"لا يمكن إجراء الحفظ النهائي للباب ({d.door_number}) لأن المشروع ({proj_name}) ليس في حالة منتهي."
            )

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

@router.post("/api/fire-doors/batch-delete")
def batch_delete_fire_doors(payload: FireDoorBatchDeleteRequest, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.username != "admin" and not user_has_project_management(current_user, db):
        raise HTTPException(status_code=403, detail="غير مصرح بحذف أبواب الحريق")
        
    grouped = defaultdict(set)
    for item in payload.items:
        grouped[item.id].add(item.index)

    for detail_id, indices_to_remove in grouped.items():
        db_detail = db.query(models.ProjectDetail).filter(models.ProjectDetail.id == detail_id).first()
        if not db_detail:
            continue

        if bool(db_detail.is_fire_door_locked) and current_user.username != "admin":
            continue
            
        qty = db_detail.quantity if db_detail.quantity and db_detail.quantity > 0 else 1
        stickers = get_stickers_list(db_detail.sticker_number, qty)
        
        if len(indices_to_remove) >= qty:
            db.delete(db_detail)
        else:
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

@router.post("/api/fire-doors/add-door")
def add_single_fire_door(payload: FireDoorAddRequest, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.username != "admin" and not user_has_project_management(current_user, db):
        raise HTTPException(status_code=403, detail="غير مصرح بإضافة أبواب حريق")
        
    project = db.query(models.Project).filter(models.Project.id == payload.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="المشروع غير موجود")
        
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

# --- ATTACHMENTS & TASKS ---

@router.post("/api/projects/{project_id}/attachments/", response_model=schemas.ProjectAttachmentResponse)
def create_project_attachment(project_id: int, file: UploadFile = File(...), db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    file_url = save_uploaded_file(file, prefix="proj_att")
    if not file_url:
        raise HTTPException(status_code=400, detail="Invalid file")
    return crud.create_project_attachment(db, project_id, file.filename, file_url)

@router.delete("/api/projects/attachments/{attachment_id}")
def delete_project_attachment(attachment_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    success = crud.delete_project_attachment(db, attachment_id)
    if not success:
        raise HTTPException(status_code=404, detail="Attachment not found")
    return {"message": "Deleted successfully"}

@router.post("/api/projects/{project_id}/tasks/", response_model=schemas.ProjectTaskResponse)
def create_project_task(project_id: int, task: schemas.ProjectTaskCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    project = crud.get_project_by_id(db, project_id)
    if not project or (project.executive_manager_id != current_user.id and current_user.username != "admin" and not user_has_project_management(current_user, db)):
        raise HTTPException(status_code=403, detail="Not authorized to add tasks for this project")
    return crud.create_project_task(db, task, project_id, current_user.id)

@router.put("/api/projects/tasks/{task_id}", response_model=schemas.ProjectTaskResponse)
def update_project_task(task_id: int, task_update: schemas.ProjectTaskUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    task = db.query(models.ProjectTask).filter(models.ProjectTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    project = crud.get_project_by_id(db, task.project_id)
    is_exec_manager = project and (project.executive_manager_id == current_user.id or user_has_project_management(current_user, db))
    is_assignee = task.assigned_to == current_user.id
    
    if not (is_exec_manager or is_assignee or current_user.username == "admin"):
        raise HTTPException(status_code=403, detail="Not authorized to update this task")
        
    return crud.update_project_task(db, task_id, task_update)

@router.delete("/api/projects/tasks/{task_id}")
def delete_project_task(task_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    task = db.query(models.ProjectTask).filter(models.ProjectTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
        
    project = crud.get_project_by_id(db, task.project_id)
    if project and project.executive_manager_id != current_user.id and current_user.username != "admin" and not user_has_project_management(current_user, db):
        raise HTTPException(status_code=403, detail="Not authorized to delete tasks")
        
    crud.delete_project_task(db, task_id)
    return {"message": "Deleted successfully"}

# --- CHANGE ORDERS ---

@router.get("/api/projects/{project_id}/change-orders", response_model=List[schemas.ProjectChangeOrderResponse])
def get_project_change_orders_endpoint(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    project = crud.get_project_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return crud.get_project_change_orders(db, project_id)

@router.post("/api/projects/{project_id}/change-orders", response_model=schemas.ProjectChangeOrderResponse)
def create_project_change_order_endpoint(
    project_id: int,
    order: schemas.ProjectChangeOrderCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    project = crud.get_project_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return crud.create_project_change_order(db, project_id, order)

@router.put("/api/projects/change-orders/{order_id}", response_model=schemas.ProjectChangeOrderResponse)
def update_project_change_order_endpoint(
    order_id: int,
    order_update: schemas.ProjectChangeOrderUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    updated = crud.update_project_change_order(db, order_id, order_update)
    if not updated:
        raise HTTPException(status_code=404, detail="Change order not found")
    return updated

@router.delete("/api/projects/change-orders/{order_id}")
def delete_project_change_order_endpoint(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    success = crud.delete_project_change_order(db, order_id)
    if not success:
        raise HTTPException(status_code=404, detail="Change order not found")
    return {"message": "Change order deleted successfully"}

# --- PUNCH LIST ---

@router.get("/api/projects/{project_id}/punch-list", response_model=List[schemas.ProjectPunchListItemResponse])
def get_project_punch_list_endpoint(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    project = crud.get_project_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return crud.get_project_punch_list(db, project_id)

@router.post("/api/projects/{project_id}/punch-list", response_model=schemas.ProjectPunchListItemResponse)
def create_project_punch_item_endpoint(
    project_id: int,
    item: schemas.ProjectPunchListItemCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    project = crud.get_project_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return crud.create_project_punch_item(db, project_id, item)

@router.put("/api/projects/punch-list/{item_id}", response_model=schemas.ProjectPunchListItemResponse)
def update_project_punch_item_endpoint(
    item_id: int,
    item_update: schemas.ProjectPunchListItemUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    updated = crud.update_project_punch_item(db, item_id, item_update)
    if not updated:
        raise HTTPException(status_code=404, detail="Punch list item not found")
    return updated

@router.delete("/api/projects/punch-list/{item_id}")
def delete_project_punch_item_endpoint(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    success = crud.delete_project_punch_item(db, item_id)
    if not success:
        raise HTTPException(status_code=404, detail="Punch list item not found")
    return {"message": "Punch list item deleted successfully"}

# --- HANDOVER UPLOAD ---

@router.post("/api/projects/{project_id}/upload-handover")
def upload_project_signed_handover(
    project_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    project = crud.get_project_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    clean_filename = f"handover_{project_id}_{uuid.uuid4().hex[:8]}_{file.filename}"
    file_path = os.path.join(UPLOAD_DIR, clean_filename)
    with open(file_path, "wb") as buffer:
        buffer.write(file.file.read())
    
    file_url = f"/uploads/{clean_filename}"
    project.signed_handover_url = file_url
    crud.create_project_attachment(db, project_id, f"محضر استلام موقع - {file.filename}", file_url)
    
    db.commit()
    db.refresh(project)
    return {
        "message": "Signed handover document uploaded successfully",
        "signed_handover_url": file_url
    }

# --- PROJECT OPTIONS ---

@router.get("/api/project-options/", response_model=List[schemas.ProjectOptionResponse])
def read_project_options(
    option_type: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    return crud.get_project_options(db, option_type)

@router.post("/api/project-options/", response_model=schemas.ProjectOptionResponse)
def create_project_option(
    option: schemas.ProjectOptionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.username != "admin":
        raise HTTPException(status_code=403, detail="غير مصرح لك بإضافة خيارات")
    return crud.create_project_option(db, option)

@router.put("/api/project-options/{option_id}", response_model=schemas.ProjectOptionResponse)
def update_project_option(
    option_id: int,
    option_update: schemas.ProjectOptionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.username != "admin":
        raise HTTPException(status_code=403, detail="غير مصرح لك بتعديل خيارات")
    db_opt = crud.update_project_option(db, option_id, option_update.name, option_update.sku, option_update.is_fire_rated)
    if not db_opt:
        raise HTTPException(status_code=404, detail="Option not found")
    return db_opt

@router.delete("/api/project-options/{option_id}")
def delete_project_option(
    option_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.username != "admin":
        raise HTTPException(status_code=403, detail="غير مصرح لك بحذف خيارات")
    success = crud.delete_project_option(db, option_id)
    if not success:
        raise HTTPException(status_code=404, detail="Option not found")
    return {"message": "Deleted successfully"}

# --- SHEET SIZES ---

@router.get("/api/sheet-sizes/", response_model=List[schemas.SheetSizeResponse])
def read_sheet_sizes(
    thickness: Optional[float] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    return crud.get_sheet_sizes(db, thickness)

@router.post("/api/sheet-sizes/", response_model=schemas.SheetSizeResponse)
def create_sheet_size(
    sheet_size: schemas.SheetSizeCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.username != "admin":
        raise HTTPException(status_code=403, detail="غير مصرح لك بإضافة قياسات ألواح")
    return crud.create_sheet_size(db, sheet_size)

@router.put("/api/sheet-sizes/{sheet_size_id}", response_model=schemas.SheetSizeResponse)
def update_sheet_size(
    sheet_size_id: int,
    sheet_size_update: schemas.SheetSizeCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
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

@router.delete("/api/sheet-sizes/{sheet_size_id}")
def delete_sheet_size(
    sheet_size_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.username != "admin":
        raise HTTPException(status_code=403, detail="غير مصرح لك بحذف قياسات ألواح")
    success = crud.delete_sheet_size(db, sheet_size_id)
    if not success:
        raise HTTPException(status_code=404, detail="Sheet size not found")
    return {"message": "Deleted successfully"}

# --- FIRE DOOR RULES ---

@router.get("/api/fire-door-rules/", response_model=List[schemas.FireDoorRuleResponse])
def read_fire_door_rules(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    return crud.get_fire_door_rules(db)

@router.post("/api/fire-door-rules/", response_model=schemas.FireDoorRuleResponse)
def create_fire_door_rule(
    rule: schemas.FireDoorRuleCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.username != "admin":
        raise HTTPException(status_code=403, detail="غير مصرح لك بإضافة مواصفات أبواب حريق")
    return crud.create_fire_door_rule(db, rule)

@router.put("/api/fire-door-rules/{rule_id}", response_model=schemas.FireDoorRuleResponse)
def update_fire_door_rule(
    rule_id: int,
    rule_update: schemas.FireDoorRuleCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.username != "admin":
        raise HTTPException(status_code=403, detail="غير مصرح لك بتعديل مواصفات أبواب حريق")
    db_rule = crud.update_fire_door_rule(db, rule_id, rule_update)
    if not db_rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    return db_rule

@router.delete("/api/fire-door-rules/{rule_id}")
def delete_fire_door_rule(
    rule_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.username != "admin":
        raise HTTPException(status_code=403, detail="غير مصرح لك بحذف مواصفات أبواب حريق")
    success = crud.delete_fire_door_rule(db, rule_id)
    if not success:
        raise HTTPException(status_code=404, detail="Rule not found")
    return {"message": "Deleted successfully"}
