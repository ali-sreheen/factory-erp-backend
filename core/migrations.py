from sqlalchemy import inspect, text
from sqlalchemy.orm import Session
import models
from core.database import SessionLocal

def run_db_migrations(db_engine):
    """
    Ensures all database tables and columns are up to date with the models.
    Safely executes schema migrations (ALTER TABLE) if missing.
    """
    # 1. First ensure tables exist
    models.Base.metadata.create_all(bind=db_engine)
    
    inspector = inspect(db_engine)
    table_names = inspector.get_table_names()

    # Check users table
    if "users" in table_names:
        columns = [c["name"] for c in inspector.get_columns("users")]
        if "is_approved" not in columns:
            try:
                with db_engine.begin() as conn:
                    conn.execute(text("ALTER TABLE users ADD COLUMN is_approved INTEGER DEFAULT 1"))
            except Exception:
                pass
        for col in ["full_name", "job_title", "employment_id", "department", "avatar_url"]:
            if col not in columns:
                try:
                    with db_engine.begin() as conn:
                        conn.execute(text(f"ALTER TABLE users ADD COLUMN {col} VARCHAR"))
                except Exception:
                    pass

    # Check transactions table
    if "transactions" in table_names:
        columns = [c["name"] for c in inspector.get_columns("transactions")]
        if "user_id" not in columns:
            try:
                with db_engine.begin() as conn:
                    conn.execute(text("ALTER TABLE transactions ADD COLUMN user_id INTEGER REFERENCES users(id)"))
            except Exception:
                pass
        if "project_id" not in columns:
            try:
                with db_engine.begin() as conn:
                    conn.execute(text("ALTER TABLE transactions ADD COLUMN project_id INTEGER REFERENCES projects(id)"))
            except Exception:
                pass

    # Check reservations table
    if "reservations" in table_names:
        columns = [c["name"] for c in inspector.get_columns("reservations")]
        if "user_id" not in columns:
            try:
                with db_engine.begin() as conn:
                    conn.execute(text("ALTER TABLE reservations ADD COLUMN user_id INTEGER REFERENCES users(id)"))
            except Exception:
                pass
        if "project_id" not in columns:
            try:
                with db_engine.begin() as conn:
                    conn.execute(text("ALTER TABLE reservations ADD COLUMN project_id INTEGER REFERENCES projects(id)"))
            except Exception:
                pass

    # Check projects table
    if "projects" in table_names:
        columns = [c["name"] for c in inspector.get_columns("projects")]
        for col in ["notes", "manufacturing_type", "installation_type", 
                    "step_design", "step_cutting", "step_forming", 
                    "step_assembly", "step_painting", "step_accessories", "step_installation"]:
            if col not in columns:
                try:
                    with db_engine.begin() as conn:
                        conn.execute(text(f"ALTER TABLE projects ADD COLUMN {col} VARCHAR DEFAULT 'لم يتم البدء'"))
                except Exception:
                    pass
        if "expected_completion_date" not in columns:
            try:
                with db_engine.begin() as conn:
                    conn.execute(text("ALTER TABLE projects ADD COLUMN expected_completion_date TIMESTAMP WITH TIME ZONE"))
            except Exception:
                try:
                    with db_engine.begin() as conn:
                        conn.execute(text("ALTER TABLE projects ADD COLUMN expected_completion_date DATETIME"))
                except Exception:
                    pass
        if "map_url" not in columns:
            try:
                with db_engine.begin() as conn:
                    conn.execute(text("ALTER TABLE projects ADD COLUMN map_url VARCHAR"))
            except Exception:
                pass
        if "activated_at" not in columns:
            try:
                with db_engine.begin() as conn:
                    conn.execute(text("ALTER TABLE projects ADD COLUMN activated_at TIMESTAMP WITH TIME ZONE"))
            except Exception:
                try:
                    with db_engine.begin() as conn:
                        conn.execute(text("ALTER TABLE projects ADD COLUMN activated_at DATETIME"))
                except Exception:
                    pass
        if "delivery_approval" not in columns:
            try:
                with db_engine.begin() as conn:
                    conn.execute(text("ALTER TABLE projects ADD COLUMN delivery_approval VARCHAR DEFAULT 'stopped'"))
            except Exception:
                pass
        if "completed_at" not in columns:
            try:
                with db_engine.begin() as conn:
                    conn.execute(text("ALTER TABLE projects ADD COLUMN completed_at TIMESTAMP WITH TIME ZONE"))
            except Exception:
                try:
                    with db_engine.begin() as conn:
                        conn.execute(text("ALTER TABLE projects ADD COLUMN completed_at DATETIME"))
                except Exception:
                    pass
        if "signed_handover_url" not in columns:
            try:
                with db_engine.begin() as conn:
                    conn.execute(text("ALTER TABLE projects ADD COLUMN signed_handover_url VARCHAR"))
            except Exception:
                pass

    # Check purchase_requests table
    if "purchase_requests" in table_names:
        columns = [c["name"] for c in inspector.get_columns("purchase_requests")]
        if "attached_image_url" not in columns:
            try:
                with db_engine.begin() as conn:
                    conn.execute(text("ALTER TABLE purchase_requests ADD COLUMN attached_image_url VARCHAR"))
            except Exception:
                pass

    # Check project_options table for is_fire_rated
    if "project_options" in table_names:
        columns = [c["name"] for c in inspector.get_columns("project_options")]
        if "is_fire_rated" not in columns:
            try:
                with db_engine.begin() as conn:
                    conn.execute(text("ALTER TABLE project_options ADD COLUMN is_fire_rated BOOLEAN NOT NULL DEFAULT FALSE"))
            except Exception:
                pass

    # Check project_details table
    if "project_details" in table_names:
        columns = [c["name"] for c in inspector.get_columns("project_details")]
        for col in ["architrave", "architrave_2", "under_tile", "notes", "direction", "hinges", "qashatah", "raddad", "hinges_count", "leaf_thickness", "sticker_number", "specifications", "leaf_size", "leaf_size_2", "window_width", "window_height", "window_position", "final_delivery_date"]:
            if col not in columns:
                try:
                    with db_engine.begin() as conn:
                        if col in ["qashatah", "raddad"]:
                            conn.execute(text(f"ALTER TABLE project_details ADD COLUMN {col} VARCHAR DEFAULT 'NO'"))
                        elif col == "hinges_count":
                            conn.execute(text(f"ALTER TABLE project_details ADD COLUMN {col} INTEGER DEFAULT 4"))
                        elif col == "leaf_thickness":
                            conn.execute(text(f"ALTER TABLE project_details ADD COLUMN {col} VARCHAR DEFAULT '4.5'"))
                        else:
                            conn.execute(text(f"ALTER TABLE project_details ADD COLUMN {col} VARCHAR"))
                except Exception:
                    pass
        if "is_fire_door_locked" not in columns:
            try:
                with db_engine.begin() as conn:
                    conn.execute(text("ALTER TABLE project_details ADD COLUMN is_fire_door_locked BOOLEAN NOT NULL DEFAULT FALSE"))
            except Exception:
                pass
        if "quantity" not in columns:
            try:
                with db_engine.begin() as conn:
                    conn.execute(text("ALTER TABLE project_details ADD COLUMN quantity INTEGER DEFAULT 1"))
            except Exception:
                pass

    # Check items table for position column
    if "items" in table_names:
        columns = [c["name"] for c in inspector.get_columns("items")]
        if "position" not in columns:
            try:
                with db_engine.begin() as conn:
                    conn.execute(text("ALTER TABLE items ADD COLUMN position INTEGER DEFAULT 0"))
            except Exception:
                pass
        if "sku" not in columns:
            try:
                with db_engine.begin() as conn:
                    conn.execute(text("ALTER TABLE items ADD COLUMN sku VARCHAR(7)"))
            except Exception:
                pass
            try:
                with db_engine.begin() as conn:
                    conn.execute(text("CREATE UNIQUE INDEX ix_items_sku ON items (sku)"))
            except Exception:
                pass

    # Check contractors table for contacts column
    if "contractors" in table_names:
        columns = [c["name"] for c in inspector.get_columns("contractors")]
        if "contacts" not in columns:
            try:
                with db_engine.begin() as conn:
                    conn.execute(text("ALTER TABLE contractors ADD COLUMN contacts VARCHAR"))
            except Exception:
                pass

    # Fix items subcategories if they are invalid for their category
    if "items" in table_names and "departments" in table_names and "subdepartments" in table_names:
        try:
            with db_engine.begin() as conn:
                res_depts = conn.execute(text("SELECT id, name FROM departments")).fetchall()
                for d_id, d_name in res_depts:
                    res_subs = conn.execute(text("SELECT name FROM subdepartments WHERE department_id = :d_id"), {"d_id": d_id}).fetchall()
                    valid_subs = {r[0] for r in res_subs}
                    items = conn.execute(text("SELECT id, name, subcategory FROM items WHERE category = :cat"), {"cat": d_name}).fetchall()
                    for item_id, item_name, subcat in items:
                        if subcat and subcat.strip() != "" and subcat not in valid_subs:
                            conn.execute(text("UPDATE items SET subcategory = NULL WHERE id = :item_id"), {"item_id": item_id})
        except Exception as e:
            print(f"[SCHEMA FIX] Error fixing invalid item subcategories: {e}")

    # Check notifications tables
    if ("notifications" not in table_names or 
        "user_notifications" not in table_names or 
        "user_notification_settings" not in table_names):
        try:
            models.Base.metadata.create_all(bind=db_engine)
        except Exception:
            pass

    # Ensure items have SKUs populated if any exist without SKU
    db_session = SessionLocal()
    try:
        items_missing_sku = db_session.query(models.Item).filter(models.Item.sku == None).all()
        if items_missing_sku:
            depts = {d.name: d.id for d in db_session.query(models.Department).all()}
            subdepts = {s.name: s.id for s in db_session.query(models.SubDepartment).all()}
            seq_counters = {}
            for item in items_missing_sku:
                dept_id = depts.get(item.category, 0)
                subdept_id = subdepts.get(item.subcategory, 0) if item.subcategory else 0
                key = (dept_id, subdept_id)
                seq_counters[key] = seq_counters.get(key, 0) + 1
                seq = seq_counters[key]
                item.sku = f"{dept_id % 100:02d}{subdept_id % 100:02d}{seq % 1000:03d}"
            db_session.commit()
    except Exception:
        db_session.rollback()
    finally:
        db_session.close()
