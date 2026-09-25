from typing import Optional
from sqlalchemy.orm import Session
import models
import crud

def dispatch_inventory_transaction_notification(
    db: Session,
    item: models.Item,
    change: int,
    project_name: Optional[str],
    current_user: models.User
):
    """
    Broadcasts notifications to responsible users whenever inventory is added or withdrawn,
    and alerts when stock is exhausted.
    """
    try:
        cat = (item.category or "").strip()
        sub = (item.subcategory or "").strip()
        name = (item.name or "").strip()
        user_name = current_user.full_name or current_user.username
        abs_qty = abs(change)
        proj_str = f" للمشروع: {project_name}" if project_name else ""

        notif_type = None
        warehouse_name = None

        if "صاج" in cat or "صاج" in name:
            warehouse_name = "مخزن الصاج"
            notif_type = "inventory_add_sheet" if change > 0 else "inventory_sub_sheet"
        elif "زرافيل" in sub or "زرافيل" in cat or "قفل" in name or "زرفيل" in name:
            warehouse_name = "مخزن الزرافيل"
            notif_type = "inventory_add_locks" if change > 0 else "inventory_sub_locks"
        elif "فصالات" in sub or "فصالات" in cat or "فصالة" in name or "مفصلات" in name:
            warehouse_name = "مخزن الفصالات"
            notif_type = "inventory_add_hinges" if change > 0 else "inventory_sub_hinges"
        elif "دهان" in cat.lower() or "دهان" in sub.lower() or "دهان" in name.lower() or "بودرة" in name.lower():
            warehouse_name = "مخزن الدهان"
            notif_type = "inventory_add_paint" if change > 0 else "inventory_sub_paint"

        if notif_type and warehouse_name:
            action_text = "إضافة" if change > 0 else "سحب"
            title = f"{action_text} - {warehouse_name}"
            msg = f"قام {user_name} بـ {action_text} ({abs_qty}) من '{name}' في {warehouse_name}{proj_str} (الرصيد الحالي: {item.quantity})"
            crud.broadcast_notification(db=db, title=title, message=msg, notif_type=notif_type, reference_id=item.id)

        # Check low stock
        if item.quantity <= 0:
            crud.broadcast_notification(
                db=db,
                title="تنبيه نفاد المخزون",
                message=f"تنبيه: نفد رصيد الصنف '{name}' في مستودع {cat} (الرصيد الحالي: {item.quantity})",
                notif_type="low_stock_alert",
                reference_id=item.id
            )
    except Exception as e:
        print(f"[NOTIFICATION ERROR] inventory transaction: {e}")
