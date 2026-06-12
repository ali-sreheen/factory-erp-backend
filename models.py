from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)

    permissions = relationship("UserPermission", back_populates="user", cascade="all, delete-orphan")
    managed_projects = relationship("Project", foreign_keys="[Project.executive_manager_id]", back_populates="executive_manager")
    assigned_tasks = relationship("ProjectTask", foreign_keys="[ProjectTask.assigned_to]", back_populates="assignee")
    created_tasks = relationship("ProjectTask", foreign_keys="[ProjectTask.created_by]", back_populates="creator")

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
    executive_manager_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    paint_color = Column(String, nullable=True)
    manufacturing_type = Column(String, nullable=True)
    installation_type = Column(String, nullable=True)
    notes = Column(String, nullable=True)
    status = Column(String, default="Pending") # Pending, Active, Completed
    
    # Tracking fields
    step_design = Column(String, default="لم يتم البدء")
    step_cutting = Column(String, default="لم يتم البدء")
    step_forming = Column(String, default="لم يتم البدء")
    step_assembly = Column(String, default="لم يتم البدء")
    step_painting = Column(String, default="لم يتم البدء")
    step_accessories = Column(String, default="لم يتم البدء")
    step_installation = Column(String, default="لم يتم البدء")
    expected_completion_date = Column(DateTime(timezone=True), nullable=True)

    executive_manager = relationship("User", foreign_keys=[executive_manager_id], back_populates="managed_projects")
    details = relationship("ProjectDetail", back_populates="project", cascade="all, delete-orphan")
    attachments = relationship("ProjectAttachment", back_populates="project", cascade="all, delete-orphan")
    tasks = relationship("ProjectTask", back_populates="project", cascade="all, delete-orphan")
    transactions = relationship("Transaction", back_populates="project")
    reservations = relationship("Reservation", back_populates="project")

class ProjectDetail(Base):
    __tablename__ = "project_details"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    door_number = Column(String, nullable=True)
    quantity = Column(Integer, nullable=True, default=1)
    width = Column(String, nullable=True)
    height = Column(String, nullable=True)
    depth = Column(String, nullable=True)
    direction = Column(String, nullable=True)
    lock_type = Column(String, nullable=True)
    profile_type = Column(String, nullable=True)
    door_type = Column(String, nullable=True)
    fire_resistance = Column(String, nullable=True)
    window_details = Column(String, nullable=True)
    architrave = Column(String, nullable=True)
    architrave_2 = Column(String, nullable=True)
    under_tile = Column(String, nullable=True)
    notes = Column(String, nullable=True)

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
