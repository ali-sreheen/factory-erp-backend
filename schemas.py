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
    username: Optional[str] = None

    class Config:
        from_attributes = True

class Item(ItemBase):
    id: int
    reservations: list[ReservationBrief] = []

    class Config:
        from_attributes = True

class ItemDescriptionUpdate(BaseModel):
    description: Optional[str] = None

# Reservation schemas
class ReservationCreate(BaseModel):
    quantity: int
    project_name: str

class ReservationResponse(BaseModel):
    id: int
    item_id: int
    user_id: Optional[int] = None
    username: Optional[str] = None
    quantity: int
    project_name: str
    timestamp: datetime

    class Config:
        from_attributes = True
