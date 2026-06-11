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

    class Config:
        from_attributes = True
        orm_mode = True

class UserUpdate(BaseModel):
    username: str
    password: Optional[str] = None

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
    width: Optional[str] = None
    height: Optional[str] = None
    depth: Optional[str] = None
    lock_type: Optional[str] = None
    profile_type: Optional[str] = None
    door_type: Optional[str] = None
    fire_resistance: Optional[str] = None
    window_details: Optional[str] = None
    architrave: Optional[str] = None
    architrave_2: Optional[str] = None
    under_tile: Optional[str] = None
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
    executive_manager_id: Optional[int] = None
    paint_color: Optional[str] = None
    notes: Optional[str] = None
    status: str = "Pending"

class ProjectCreate(ProjectBase):
    pass

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    delivery_date: Optional[datetime] = None
    contractor_name: Optional[str] = None
    engineer_name: Optional[str] = None
    engineer_phone: Optional[str] = None
    location: Optional[str] = None
    executive_manager_id: Optional[int] = None
    paint_color: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None

class ProjectResponse(ProjectBase):
    id: int
    details: List[ProjectDetailResponse] = []
    attachments: List[ProjectAttachmentResponse] = []
    tasks: List[ProjectTaskResponse] = []

    class Config:
        from_attributes = True
