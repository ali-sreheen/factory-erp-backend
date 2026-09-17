from pydantic import BaseModel
from typing import Literal, Optional, List
from datetime import datetime

CategoryType = str
SubcategoryType = str

# User schemas
class UserCreate(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    id: int
    username: str
    is_approved: int
    full_name: Optional[str] = None
    job_title: Optional[str] = None
    employment_id: Optional[str] = None
    department: Optional[str] = None
    avatar_url: Optional[str] = None
    salary: Optional[str] = None
    manager_id: Optional[int] = None
    allowed_holidays: Optional[int] = 21
    manager: Optional['UserResponse'] = None

    class Config:
        from_attributes = True
        orm_mode = True

class UserUpdate(BaseModel):
    username: str
    password: Optional[str] = None
    full_name: Optional[str] = None
    job_title: Optional[str] = None
    employment_id: Optional[str] = None
    department: Optional[str] = None
    avatar_url: Optional[str] = None
    salary: Optional[str] = None
    manager_id: Optional[int] = None
    allowed_holidays: Optional[int] = 21

class EmployeeVacationDayBase(BaseModel):
    vacation_date: str
    notes: Optional[str] = None

class EmployeeVacationDayCreate(EmployeeVacationDayBase):
    pass

class EmployeeVacationDayResponse(EmployeeVacationDayBase):
    id: int
    user_id: int

    class Config:
        from_attributes = True
        orm_mode = True

class EmployeeSalaryBase(BaseModel):
    month: str
    basic_salary: float
    social_security_deduction: float
    other_deductions: float
    loans: float
    overtime: float

class EmployeeSalaryCreate(EmployeeSalaryBase):
    pass

class EmployeeSalaryResponse(EmployeeSalaryBase):
    id: int
    user_id: int
    total: float

    class Config:
        from_attributes = True
        orm_mode = True

class UserPermissionBase(BaseModel):
    department_name: str
    can_edit: int

class UserPermissionCreate(UserPermissionBase):
    pass

class UserPermissionResponse(UserPermissionBase):
    id: int
    user_id: int

    class Config:
        from_attributes = True
        orm_mode = True

class UserWithPermissionsResponse(UserResponse):
    permissions: List[UserPermissionResponse] = []

    class Config:
        from_attributes = True
        orm_mode = True

class SubDepartmentBase(BaseModel):
    name: str

class SubDepartmentCreate(SubDepartmentBase):
    pass

class SubDepartmentResponse(SubDepartmentBase):
    id: int
    department_id: int

    class Config:
        from_attributes = True
        orm_mode = True

class DepartmentBase(BaseModel):
    name: str

class DepartmentCreate(DepartmentBase):
    pass

class DepartmentResponse(DepartmentBase):
    id: int
    subdepartments: List[SubDepartmentResponse] = []

    class Config:
        from_attributes = True
        orm_mode = True

# Token schemas
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

# Transaction schemas
class TransactionBase(BaseModel):
    change: int
    project_name: Optional[str] = None
    project_id: Optional[int] = None
    notes: Optional[str] = None

class TransactionCreate(TransactionBase):
    pass

class TransactionResponse(TransactionBase):
    id: int
    item_id: int
    user_id: Optional[int] = None
    username: Optional[str] = None # Added for user tracking in frontend logs
    timestamp: datetime

    class Config:
        from_attributes = True

# Item schemas
class ItemBase(BaseModel):
    name: str
    description: Optional[str] = None
    category: CategoryType
    subcategory: Optional[SubcategoryType] = None
    quantity: int = 0
    image_url: Optional[str] = None
    position: Optional[int] = 0

class ItemMove(BaseModel):
    new_category: str
    new_subcategory: Optional[str] = None

class ItemCreate(ItemBase):
    pass

class ReservationBrief(BaseModel):
    id: int
    quantity: int
    project_name: str
    project_id: Optional[int] = None
    username: Optional[str] = None

    class Config:
        from_attributes = True

class Item(ItemBase):
    id: int
    sku: Optional[str] = None
    reservations: list[ReservationBrief] = []

    class Config:
        from_attributes = True

class ItemUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None

class ItemDescriptionUpdate(BaseModel):
    description: Optional[str] = None

# Reservation schemas
class ReservationCreate(BaseModel):
    quantity: int
    project_name: str
    project_id: Optional[int] = None

class ReservationResponse(BaseModel):
    id: int
    item_id: int
    user_id: Optional[int] = None
    username: Optional[str] = None
    quantity: int
    project_name: str
    project_id: Optional[int] = None
    timestamp: datetime

    class Config:
        from_attributes = True

# Project Task schemas
class ProjectTaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    assigned_to: Optional[int] = None
    status: str = "Pending"

class ProjectTaskCreate(ProjectTaskBase):
    pass

class ProjectTaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    assigned_to: Optional[int] = None
    status: Optional[str] = None

class ProjectTaskResponse(ProjectTaskBase):
    id: int
    project_id: int
    created_by: int
    created_at: datetime

    class Config:
        from_attributes = True

# Project Attachment schemas
class ProjectAttachmentBase(BaseModel):
    file_name: str
    file_url: str

class ProjectAttachmentCreate(ProjectAttachmentBase):
    pass

class ProjectAttachmentResponse(ProjectAttachmentBase):
    id: int
    project_id: int

    class Config:
        from_attributes = True

# Project Detail schemas
class ProjectDetailBase(BaseModel):
    door_number: Optional[str] = None
    sticker_number: Optional[str] = None
    quantity: Optional[int] = 1
    width: Optional[str] = None
    height: Optional[str] = None
    depth: Optional[str] = None
    direction: Optional[str] = None
    lock_type: Optional[str] = None
    hinges: Optional[str] = None
    profile_type: Optional[str] = None
    door_type: Optional[str] = None
    leaf_thickness: Optional[str] = "4.5"
    qashatah: Optional[str] = "NO"
    fire_resistance: Optional[str] = None
    raddad: Optional[str] = "NO"
    hinges_count: Optional[int] = 4
    window_details: Optional[str] = None
    window_width: Optional[str] = None
    window_height: Optional[str] = None
    window_position: Optional[str] = None
    architrave: Optional[str] = None
    architrave_2: Optional[str] = None
    under_tile: Optional[str] = None
    leaf_size: Optional[str] = None
    leaf_size_2: Optional[str] = None
    specifications: Optional[str] = None
    notes: Optional[str] = None

class ProjectDetailCreate(ProjectDetailBase):
    pass

class ProjectDetailResponse(ProjectDetailBase):
    id: int
    project_id: int

    class Config:
        from_attributes = True

# Project schemas
class ProjectBase(BaseModel):
    project_number: str
    name: str
    delivery_date: Optional[datetime] = None
    contractor_name: Optional[str] = None
    engineer_name: Optional[str] = None
    engineer_phone: Optional[str] = None
    location: Optional[str] = None
    map_url: Optional[str] = None
    executive_manager_id: Optional[int] = None
    paint_color: Optional[str] = None
    manufacturing_type: Optional[str] = None
    installation_type: Optional[str] = None
    notes: Optional[str] = None
    status: str = "Pending"
    activated_at: Optional[datetime] = None
    delivery_approval: Optional[str] = "stopped"
    step_design: Optional[str] = "لم يتم البدء"
    step_cutting: Optional[str] = "لم يتم البدء"
    step_forming: Optional[str] = "لم يتم البدء"
    step_assembly: Optional[str] = "لم يتم البدء"
    step_painting: Optional[str] = "لم يتم البدء"
    step_accessories: Optional[str] = "لم يتم البدء"
    step_installation: Optional[str] = "لم يتم البدء"
    expected_completion_date: Optional[datetime] = None

class ProjectCreate(ProjectBase):
    pass

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    delivery_date: Optional[datetime] = None
    contractor_name: Optional[str] = None
    engineer_name: Optional[str] = None
    engineer_phone: Optional[str] = None
    location: Optional[str] = None
    map_url: Optional[str] = None
    executive_manager_id: Optional[int] = None
    paint_color: Optional[str] = None
    manufacturing_type: Optional[str] = None
    installation_type: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None
    activated_at: Optional[datetime] = None
    delivery_approval: Optional[str] = None
    step_design: Optional[str] = None
    step_cutting: Optional[str] = None
    step_forming: Optional[str] = None
    step_assembly: Optional[str] = None
    step_painting: Optional[str] = None
    step_accessories: Optional[str] = None
    step_installation: Optional[str] = None
    expected_completion_date: Optional[datetime] = None

class ProjectResponse(ProjectBase):
    id: int
    details: List[ProjectDetailResponse] = []
    attachments: List[ProjectAttachmentResponse] = []
    tasks: List[ProjectTaskResponse] = []

    class Config:
        from_attributes = True

# Purchasing schemas
class SupplierBase(BaseModel):
    name: str
    phone: Optional[str] = None
    supply_type: Optional[str] = None
    location: Optional[str] = None
    maps_url: Optional[str] = None

class SupplierCreate(SupplierBase):
    pass

class SupplierUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    supply_type: Optional[str] = None
    location: Optional[str] = None
    maps_url: Optional[str] = None

class SupplierResponse(SupplierBase):
    id: int

    class Config:
        from_attributes = True

class ContractorBase(BaseModel):
    name: str
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    contacts: Optional[str] = None
    finance_dept: Optional[str] = None
    financial_phone: Optional[str] = None
    notes: Optional[str] = None

class ContractorCreate(ContractorBase):
    pass

class ContractorUpdate(BaseModel):
    name: Optional[str] = None
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    contacts: Optional[str] = None
    finance_dept: Optional[str] = None
    financial_phone: Optional[str] = None
    notes: Optional[str] = None

class ContractorResponse(ContractorBase):
    id: int

    class Config:
        from_attributes = True

class PurchaseRequestBase(BaseModel):
    title: str
    description: Optional[str] = None
    quantity: Optional[int] = None
    expected_price: Optional[str] = None

class PurchaseRequestCreate(PurchaseRequestBase):
    pass

class PurchaseRequestUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    quantity: Optional[int] = None
    expected_price: Optional[str] = None
    status: Optional[str] = None
    invoice_image_url: Optional[str] = None
    items_image_url: Optional[str] = None
    attached_image_url: Optional[str] = None

class PurchaseRequestResponse(PurchaseRequestBase):
    id: int
    requested_by_id: int
    status: str
    invoice_image_url: Optional[str] = None
    items_image_url: Optional[str] = None
    attached_image_url: Optional[str] = None
    created_at: datetime
    requested_by: Optional[UserResponse] = None

    class Config:
        from_attributes = True

class ProjectOptionBase(BaseModel):
    option_type: str
    name: str
    sku: Optional[str] = None
    is_fire_rated: bool = False

class ProjectOptionCreate(ProjectOptionBase):
    pass

class ProjectOptionResponse(ProjectOptionBase):
    id: int

    class Config:
        from_attributes = True

class SheetSizeBase(BaseModel):
    thickness: float
    width: float
    height: float
    sku: Optional[str] = None

class SheetSizeCreate(SheetSizeBase):
    pass

class SheetSizeResponse(SheetSizeBase):
    id: int

    class Config:
        from_attributes = True

class HRRequestBase(BaseModel):
    request_type: str
    reason: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    attachment_url: Optional[str] = None

class HRRequestCreate(HRRequestBase):
    pass

class HRRequestResponse(HRRequestBase):
    id: int
    user_id: int
    request_date: datetime
    status: str
    user: Optional[UserResponse] = None

    class Config:
        from_attributes = True

class HRRequestStatusUpdate(BaseModel):
    status: str

class AttendanceRecordBase(BaseModel):
    record_date: str
    check_in: Optional[str] = None
    check_out: Optional[str] = None
    status: str

class AttendanceRecordCreate(AttendanceRecordBase):
    pass

class AttendanceRecordResponse(AttendanceRecordBase):
    id: int
    user_id: int

    class Config:
        from_attributes = True


# --- SERVICE JOBS SCHEMAS ---

class ServiceJobAttachmentResponse(BaseModel):
    id: int
    job_id: int
    file_url: str
    file_name: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ServiceJobBase(BaseModel):
    job_number: str
    name: str
    client_name: str
    client_phone: Optional[str] = None
    received_date: Optional[datetime] = None
    expected_delivery_date: Optional[datetime] = None
    assigned_to: Optional[str] = None
    status: Optional[str] = "قيد التنفيذ"

    op_design: Optional[bool] = False
    op_laser_cutting: Optional[bool] = False
    op_bending: Optional[bool] = False
    op_punching: Optional[bool] = False
    op_welding: Optional[bool] = False
    op_painting: Optional[bool] = False

    sheet_thickness: Optional[float] = None
    sheet_ownership: Optional[str] = None
    sheet_type: Optional[str] = None
    notes: Optional[str] = None

    final_price: Optional[float] = 0.0
    tax_inclusive: Optional[bool] = True
    cutting_length: Optional[float] = None
    bends_count: Optional[int] = None
    punch_strokes_count: Optional[int] = None
    expected_duration: Optional[str] = None


class ServiceJobCreate(ServiceJobBase):
    pass


class ServiceJobUpdate(BaseModel):
    job_number: Optional[str] = None
    name: Optional[str] = None
    client_name: Optional[str] = None
    client_phone: Optional[str] = None
    received_date: Optional[datetime] = None
    expected_delivery_date: Optional[datetime] = None
    assigned_to: Optional[str] = None
    status: Optional[str] = None

    op_design: Optional[bool] = None
    op_laser_cutting: Optional[bool] = None
    op_bending: Optional[bool] = None
    op_punching: Optional[bool] = None
    op_welding: Optional[bool] = None
    op_painting: Optional[bool] = None

    sheet_thickness: Optional[float] = None
    sheet_ownership: Optional[str] = None
    sheet_type: Optional[str] = None
    notes: Optional[str] = None

    final_price: Optional[float] = None
    tax_inclusive: Optional[bool] = None
    cutting_length: Optional[float] = None
    bends_count: Optional[int] = None
    punch_strokes_count: Optional[int] = None
    expected_duration: Optional[str] = None


class ServiceJobResponse(ServiceJobBase):
    id: int
    created_at: Optional[datetime] = None
    created_by_id: Optional[int] = None
    attachments: List[ServiceJobAttachmentResponse] = []

    class Config:
        from_attributes = True


# --- SERVICE CLIENTS SCHEMAS ---

class ServiceClientBase(BaseModel):
    name: str
    phone: Optional[str] = None
    company: Optional[str] = None
    contacts: Optional[str] = None
    notes: Optional[str] = None


class ServiceClientCreate(ServiceClientBase):
    pass


class ServiceClientUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    contacts: Optional[str] = None
    notes: Optional[str] = None


class ServiceClientResponse(ServiceClientBase):
    id: int
    created_at: Optional[datetime] = None
    jobs_count: Optional[int] = 0


    class Config:
        from_attributes = True


# --- FIRE-RATED DOOR RULES SCHEMAS ---

class FireDoorRuleBase(BaseModel):
    name: Optional[str] = None
    min_height: Optional[float] = None
    max_height: Optional[float] = None
    min_width: Optional[float] = None
    max_width: Optional[float] = None
    min_depth: Optional[float] = None
    max_depth: Optional[float] = None
    min_architrave: Optional[float] = None
    max_architrave: Optional[float] = None
    min_architrave_2: Optional[float] = None
    max_architrave_2: Optional[float] = None
    min_leaf_thickness: Optional[float] = None
    max_leaf_thickness: Optional[float] = None
    leaf_thickness: Optional[str] = "الجميع"
    profile_type: Optional[str] = "الجميع"
    door_type: Optional[str] = "الجميع"


class FireDoorRuleCreate(FireDoorRuleBase):
    pass


class FireDoorRuleResponse(FireDoorRuleBase):
    id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


UserResponse.update_forward_refs()


