from sqlalchemy import create_engine, Column, Integer, String, DateTime, ForeignKey, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import os

# Database Configuration
DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://user:password@localhost/loopsdb')

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    loops = relationship("Loop", back_populates="owner")

class Loop(Base):
    __tablename__ = "loops"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(String, unique=True, index=True)  # Frontend's string UID
    tier = Column(String, nullable=False)  # "daily" | "weekly" | "monthly"
    type = Column(String, nullable=False)  # "open" | "windowed"
    recurrence = Column(String, nullable=True)  # null | "daily" | "weekly" | "monthly"
    status = Column(String, default="active")  # "active" | "expired"
    title = Column(String, nullable=False)
    color = Column(String, nullable=False)  # hex color e.g., "#FF6B35"
    period = Column(String, nullable=False)  # "2024-02-19" | "2024-W08" | "2024-02"
    linked_to = Column(String, nullable=True)  # client_id of parent loop
    rolled_from = Column(String, nullable=True)  # previous period string
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    owner_id = Column(Integer, ForeignKey("users.id"))
    owner = relationship("User", back_populates="loops")
    subtasks = relationship("Subtask", back_populates="loop", cascade="all, delete-orphan")


class Subtask(Base):
    __tablename__ = "subtasks"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(String, index=True)  # Frontend's string UID
    text = Column(String, nullable=False)
    done = Column(Boolean, default=False)
    order = Column(Integer, default=0)  # Preserve ordering

    loop_id = Column(Integer, ForeignKey("loops.id", ondelete="CASCADE"))
    loop = relationship("Loop", back_populates="subtasks")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()