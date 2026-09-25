from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Float, Boolean
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_approved = Column(Integer, default=0, nullable=False)
    
    # Profile information
    full_name = Column(String, nullable=True)
    job_title = Column(String, nullable=True)
    employment_id = Column(String, nullable=True)
    department = Column(String, nullable=True)
    avatar_url = Column(String, nullable=True)
    salary = Column(String, nullable=True)
    manager_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    allowed_holidays = Column(Integer, default=21, nullable=True)

    manager = relationship("User", remote_side=[id], backref="subordinates")
    permissions = relationship("UserPermission", back_populates="user", cascade="all, delete-orphan")
    managed_projects = relationship("Project", foreign_keys="[Project.executive_manager_id]", back_populates="executive_manager")
    assigned_tasks = relationship("ProjectTask", foreign_keys="[ProjectTask.assigned_to]", back_populates="assignee")
    created_tasks = relationship("ProjectTask", foreign_keys="[ProjectTask.created_by]", back_populates="creator")
    hr_requests = relationship("HRRequest", back_populates="user", cascade="all, delete-orphan")
    attendance_records = relationship("AttendanceRecord", back_populates="user", cascade="all, delete-orphan")
    vacation_days = relationship("EmployeeVacationDay", back_populates="user", cascade="all, delete-orphan")
    salaries = relationship("EmployeeSalary", back_populates="user", cascade="all, delete-orphan")

class Department(Base):
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    
    subdepartments = relationship("SubDepartment", back_populates="department", cascade="all, delete-orphan")

class SubDepartment(Base):
    __tablename__ = "subdepartments"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False)
    
    department = relationship("Department", back_populates="subdepartments")

class UserPermission(Base):
    __tablename__ = "user_permissions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    department_name = Column(String, nullable=False)
    can_edit = Column(Integer, default=1) # 1 for True, 0 for False (SQLite boolean compatibility)
    
    user = relationship("User", back_populates="permissions")

class Item(Base):
    __tablename__ = "items"

    id = Column(Integer, primary_key=True, index=True)
    sku = Column(String(7), unique=True, index=True, nullable=True)
    name = Column(String, index=True)
    description = Column(String, nullable=True)
    category = Column(String, index=True)
    subcategory = Column(String, index=True, nullable=True) # Used for accessories
    quantity = Column(Integer, default=0)
    image_url = Column(String, nullable=True)
    position = Column(Integer, default=0, nullable=True)

    transactions = relationship("Transaction", back_populates="item", cascade="all, delete-orphan")
    reservations = relationship("Reservation", back_populates="item", cascade="all, delete-orphan")

class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    item_id = Column(Integer, ForeignKey("items.id"))
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True) # Linked to User
    change = Column(Integer, nullable=False) # positive for add, negative for sub
    project_name = Column(String, nullable=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    notes = Column(String, nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())

    item = relationship("Item", back_populates="transactions")
    user = relationship("User") # Relationship to retrieve username
    project = relationship("Project", back_populates="transactions")

class Reservation(Base):
    __tablename__ = "reservations"

    id = Column(Integer, primary_key=True, index=True)
    item_id = Column(Integer, ForeignKey("items.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    quantity = Column(Integer, nullable=False)
    project_name = Column(String, nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())

    item = relationship("Item", back_populates="reservations")
    user = relationship("User")
    project = relationship("Project", back_populates="reservations")

class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    project_number = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, index=True, nullable=False)
    delivery_date = Column(DateTime(timezone=True), nullable=True)
    contractor_name = Column(String, nullable=True)
    engineer_name = Column(String, nullable=True)
    engineer_phone = Column(String, nullable=True)
    location = Column(String, nullable=True)
    map_url = Column(String, nullable=True)
    executive_manager_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    paint_color = Column(String, nullable=True)
    manufacturing_type = Column(String, nullable=True)
    installation_type = Column(String, nullable=True)
    notes = Column(String, nullable=True)
    status = Column(String, default="Pending") # Pending, Active, Completed
    activated_at = Column(DateTime(timezone=True), nullable=True)
    delivery_approval = Column(String, default="stopped") # stopped, approved
    
    # Tracking fields
    step_design = Column(String, default="لم يتم البدء")
    step_cutting = Column(String, default="لم يتم البدء")
    step_forming = Column(String, default="لم يتم البدء")
    step_assembly = Column(String, default="لم يتم البدء")
    step_painting = Column(String, default="لم يتم البدء")
    step_accessories = Column(String, default="لم يتم البدء")
    step_installation = Column(String, default="لم يتم البدء")
    expected_completion_date = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    signed_handover_url = Column(String, nullable=True)

    executive_manager = relationship("User", foreign_keys=[executive_manager_id], back_populates="managed_projects")
    details = relationship("ProjectDetail", back_populates="project", cascade="all, delete-orphan")
    attachments = relationship("ProjectAttachment", back_populates="project", cascade="all, delete-orphan")
    tasks = relationship("ProjectTask", back_populates="project", cascade="all, delete-orphan")
    transactions = relationship("Transaction", back_populates="project")
    reservations = relationship("Reservation", back_populates="project")
    change_orders = relationship("ProjectChangeOrder", back_populates="project", cascade="all, delete-orphan")
    punch_list = relationship("ProjectPunchListItem", back_populates="project", cascade="all, delete-orphan")

class ProjectDetail(Base):
    __tablename__ = "project_details"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    door_number = Column(String, nullable=True)
    sticker_number = Column(String, nullable=True)
    quantity = Column(Integer, nullable=True, default=1)
    width = Column(String, nullable=True)
    height = Column(String, nullable=True)
    depth = Column(String, nullable=True)
    direction = Column(String, nullable=True)
    lock_type = Column(String, nullable=True)
    hinges = Column(String, nullable=True)
    profile_type = Column(String, nullable=True)
    door_type = Column(String, nullable=True)
    leaf_thickness = Column(String, default="4.5", nullable=True)
    qashatah = Column(String, default="NO", nullable=True)
    fire_resistance = Column(String, nullable=True)
    raddad = Column(String, default="NO", nullable=True)
    hinges_count = Column(Integer, default=4, nullable=True)
    window_details = Column(String, nullable=True)
    window_width = Column(String, nullable=True)
    window_height = Column(String, nullable=True)
    window_position = Column(String, nullable=True)
    architrave = Column(String, nullable=True)
    architrave_2 = Column(String, nullable=True)
    under_tile = Column(String, nullable=True)
    leaf_size = Column(String, nullable=True)
    leaf_size_2 = Column(String, nullable=True)
    specifications = Column(String, nullable=True)
    notes = Column(String, nullable=True)
    final_delivery_date = Column(String, nullable=True)
    is_fire_door_locked = Column(Boolean, default=False, nullable=True)

    project = relationship("Project", back_populates="details")

class ProjectAttachment(Base):
    __tablename__ = "project_attachments"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    file_url = Column(String, nullable=False)
    file_name = Column(String, nullable=False)

    project = relationship("Project", back_populates="attachments")

class ProjectTask(Base):
    __tablename__ = "project_tasks"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    assigned_to = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(String, default="Pending") # Pending, InProgress, Completed
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    project = relationship("Project", back_populates="tasks")
    assignee = relationship("User", foreign_keys=[assigned_to], back_populates="assigned_tasks")
    creator = relationship("User", foreign_keys=[created_by], back_populates="created_tasks")

class PurchaseRequest(Base):
    __tablename__ = "purchase_requests"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    quantity = Column(Integer, nullable=True)
    expected_price = Column(String, nullable=True) # string or float, float is better but string is safer for "100 JOD". I'll use String.
    requested_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(String, default="Pending") # Pending, Active, Purchased
    attached_image_url = Column(String, nullable=True)
    invoice_image_url = Column(String, nullable=True)
    items_image_url = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    requested_by = relationship("User", foreign_keys=[requested_by_id])

class Supplier(Base):
    __tablename__ = "suppliers"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    phone = Column(String, nullable=True)
    supply_type = Column(String, nullable=True)
    location = Column(String, nullable=True)
    maps_url = Column(String, nullable=True)

class Contractor(Base):
    __tablename__ = "contractors"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    contact_person = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    contacts = Column(String, nullable=True) # JSON string: [{"name": "...", "phone": "..."}]
    finance_dept = Column(String, nullable=True)
    financial_phone = Column(String, nullable=True)
    notes = Column(String, nullable=True)

class ProjectOption(Base):
    __tablename__ = "project_options"
    
    id = Column(Integer, primary_key=True, index=True)
    option_type = Column(String, index=True, nullable=False) # "lock" or "hinge"
    name = Column(String, index=True, nullable=False)
    sku = Column(String(7), nullable=True)
    is_fire_rated = Column(Boolean, default=False, nullable=False)

class SheetSize(Base):
    __tablename__ = "sheet_sizes"
    
    id = Column(Integer, primary_key=True, index=True)
    thickness = Column(Float, index=True, nullable=False) # 1.5 or 1.2
    width = Column(Float, nullable=False)
    height = Column(Float, nullable=False)
    sku = Column(String(7), nullable=True)

class HRRequest(Base):
    __tablename__ = "hr_requests"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    request_type = Column(String, nullable=False) # "مغادرة", "اجازة", "استفسار"
    reason = Column(String, nullable=False)
    request_date = Column(DateTime(timezone=True), server_default=func.now())
    start_date = Column(String, nullable=True) # "YYYY-MM-DD" for vacation
    end_date = Column(String, nullable=True)   # "YYYY-MM-DD" for vacation
    start_time = Column(String, nullable=True) # "HH:MM" for permission
    end_time = Column(String, nullable=True)   # "HH:MM" for permission
    attachment_url = Column(String, nullable=True)
    status = Column(String, default="قيد الانتظار", nullable=False) # "قيد الانتظار", "موافق", "مرفوض"

    user = relationship("User", back_populates="hr_requests")

class AttendanceRecord(Base):
    __tablename__ = "attendance_records"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    record_date = Column(String, nullable=False) # "YYYY-MM-DD"
    check_in = Column(String, nullable=True) # "HH:MM:SS"
    check_out = Column(String, nullable=True) # "HH:MM:SS"
    status = Column(String, default="حاضر", nullable=False) # "حاضر", "غائب", "إجازة", etc.

    user = relationship("User", back_populates="attendance_records")

class EmployeeVacationDay(Base):
    __tablename__ = "employee_vacation_days"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    vacation_date = Column(String, nullable=False) # "YYYY-MM-DD"
    notes = Column(String, nullable=True)

    user = relationship("User", back_populates="vacation_days")


class EmployeeSalary(Base):
    __tablename__ = "employee_salaries"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    month = Column(String, nullable=False) # "YYYY-MM"
    basic_salary = Column(Float, default=0.0)
    social_security_deduction = Column(Float, default=0.0)
    other_deductions = Column(Float, default=0.0)
    loans = Column(Float, default=0.0)
    overtime = Column(Float, default=0.0)
    total = Column(Float, default=0.0)

    user = relationship("User", back_populates="salaries")


class ServiceJob(Base):
    __tablename__ = "service_jobs"

    id = Column(Integer, primary_key=True, index=True)
    job_number = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, index=True, nullable=False)
    client_name = Column(String, index=True, nullable=False)
    client_phone = Column(String, nullable=True)
    contact_person = Column(String, nullable=True)
    received_date = Column(DateTime(timezone=True), nullable=True)
    expected_delivery_date = Column(DateTime(timezone=True), nullable=True)
    assigned_to = Column(String, nullable=True)
    status = Column(String, default="قيد التنفيذ") # قيد الانتظار, قيد التنفيذ, مكتمل, تم التسليم

    # Manufacturing Operations
    op_design = Column(Boolean, default=False)
    op_laser_cutting = Column(Boolean, default=False)
    op_bending = Column(Boolean, default=False)
    op_punching = Column(Boolean, default=False)
    op_welding = Column(Boolean, default=False)
    op_painting = Column(Boolean, default=False)

    # Sheet Details
    sheet_thickness = Column(Float, nullable=True)
    sheet_ownership = Column(String, nullable=True) # "شركة فراس وطارق الجدع" or "العميل"
    sheet_type = Column(String, nullable=True) # "مغلفن", "ستانليس ستيل", "اسود", "مدهون"
    notes = Column(String, nullable=True)

    # Pricing & Technical Specs
    final_price = Column(Float, default=0.0)
    tax_inclusive = Column(Boolean, default=True)
    cutting_length = Column(Float, nullable=True)
    bends_count = Column(Integer, nullable=True)
    punch_strokes_count = Column(Integer, nullable=True)
    expected_duration = Column(String, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    attachments = relationship("ServiceJobAttachment", back_populates="job", cascade="all, delete-orphan")
    created_by = relationship("User", foreign_keys=[created_by_id])


class ServiceJobAttachment(Base):
    __tablename__ = "service_job_attachments"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(Integer, ForeignKey("service_jobs.id"), nullable=False)
    file_url = Column(String, nullable=False)
    file_name = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    job = relationship("ServiceJob", back_populates="attachments")


class ServiceClient(Base):
    __tablename__ = "service_clients"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    phone = Column(String, nullable=True)
    company = Column(String, nullable=True)
    contacts = Column(String, nullable=True) # JSON list of {name, phone}
    notes = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())



class FireDoorRule(Base):
    __tablename__ = "fire_door_rules"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=True)
    min_height = Column(Float, nullable=True)
    max_height = Column(Float, nullable=True)
    min_width = Column(Float, nullable=True)
    max_width = Column(Float, nullable=True)
    min_depth = Column(Float, nullable=True)
    max_depth = Column(Float, nullable=True)
    min_architrave = Column(Float, nullable=True)
    max_architrave = Column(Float, nullable=True)
    min_architrave_2 = Column(Float, nullable=True)
    max_architrave_2 = Column(Float, nullable=True)
    min_leaf_thickness = Column(Float, nullable=True)
    max_leaf_thickness = Column(Float, nullable=True)
    leaf_thickness = Column(String, nullable=True, default="الجميع")
    profile_type = Column(String, nullable=True, default="الجميع")
    door_type = Column(String, nullable=True, default="الجميع")
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    message = Column(String, nullable=False)
    type = Column(String, default="info") # project_created, project_status_changed, etc.
    reference_id = Column(Integer, nullable=True) # e.g. project_id
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user_notifications = relationship("UserNotification", back_populates="notification", cascade="all, delete-orphan")


class UserNotification(Base):
    __tablename__ = "user_notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    notification_id = Column(Integer, ForeignKey("notifications.id"), nullable=False)
    is_read = Column(Boolean, default=False, nullable=False)
    read_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User")
    notification = relationship("Notification", back_populates="user_notifications")


class UserNotificationSetting(Base):
    __tablename__ = "user_notification_settings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    setting_key = Column(String, nullable=False, index=True)
    is_enabled = Column(Boolean, default=True, nullable=False)

    user = relationship("User")


class ProjectChangeOrder(Base):
    __tablename__ = "project_change_orders"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False, index=True)
    order_number = Column(String, nullable=False) # e.g. CO-01
    title = Column(String, nullable=False)
    description = Column(String, nullable=False)
    requested_by = Column(String, nullable=True) # e.g. مهندس الموقع / المقاول
    cost_impact = Column(String, nullable=True, default="بدون تكلفة")
    time_impact = Column(String, nullable=True, default="بدون تأخير")
    status = Column(String, default="معتمد") # معتمد, قيد المراجعة, مرفوض
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    project = relationship("Project", back_populates="change_orders")


class ProjectPunchListItem(Base):
    __tablename__ = "project_punch_list"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False, index=True)
    door_number = Column(String, nullable=True)
    description = Column(String, nullable=False)
    priority = Column(String, default="عادي") # عادي, عاجل
    status = Column(String, default="قيد المعالجة") # قيد المعالجة, تم الإصلاح, معتمد
    photo_url = Column(String, nullable=True)
    assigned_to = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    project = relationship("Project", back_populates="punch_list")
