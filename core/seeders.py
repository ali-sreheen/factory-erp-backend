from sqlalchemy.orm import Session
import models
import crud
from core.database import SessionLocal

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

def run_all_seeders():
    """Seeds default admin, departments, project options, sheet sizes, and fire door rules."""
    db = SessionLocal()
    try:
        crud.seed_admin_user(db)
        seed_default_departments(db)
        crud.seed_default_project_options(db)
        crud.seed_default_sheet_sizes(db)
        crud.seed_default_fire_door_rules(db)
    finally:
        db.close()
