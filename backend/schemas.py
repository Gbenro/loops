from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime


# User schemas
class UserBase(BaseModel):
    email: EmailStr


class UserCreate(UserBase):
    password: str = Field(..., min_length=8)


class UserResponse(UserBase):
    id: int

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str


# Subtask schemas
class SubtaskBase(BaseModel):
    id: str  # client_id
    text: str
    done: bool = False


class SubtaskCreate(SubtaskBase):
    pass


class SubtaskResponse(SubtaskBase):
    class Config:
        from_attributes = True


# Loop schemas
class LoopBase(BaseModel):
    id: str  # client_id (e.g., "l1234abc")
    tier: str  # "daily" | "weekly" | "monthly"
    type: str  # "open" | "windowed"
    recurrence: Optional[str] = None
    status: Optional[str] = "active"
    title: str
    color: str
    period: str
    linkedTo: Optional[str] = None
    rolledFrom: Optional[str] = None
    subtasks: Optional[List[SubtaskBase]] = []


class LoopCreate(LoopBase):
    pass


class LoopResponse(LoopBase):
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class LoopUpdate(BaseModel):
    tier: Optional[str] = None
    type: Optional[str] = None
    recurrence: Optional[str] = None
    status: Optional[str] = None
    title: Optional[str] = None
    color: Optional[str] = None
    period: Optional[str] = None
    linkedTo: Optional[str] = None
    rolledFrom: Optional[str] = None
    subtasks: Optional[List[SubtaskBase]] = None


# Sync schemas
class SyncRequest(BaseModel):
    loops: List[LoopCreate]
    lastSyncTimestamp: Optional[datetime] = None


class SyncResponse(BaseModel):
    loops: List[LoopResponse]
    serverTimestamp: datetime
    conflicts: List[dict] = []
