from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List

from .database import get_db, User, Loop, Base, engine
from .security import (
    create_access_token, 
    get_password_hash, 
    authenticate_user, 
    get_current_user,
    ACCESS_TOKEN_EXPIRE_MINUTES
)
from .schemas import UserCreate, UserResponse, LoopCreate, LoopUpdate, Token

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI()

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/signup", response_model=UserResponse)
def create_user(user: UserCreate, db: Session = Depends(get_db)):
    # Check if user already exists
    existing_user = db.query(User).filter(User.email == user.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create new user
    hashed_password = get_password_hash(user.password)
    db_user = User(email=user.email, hashed_password=hashed_password)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    return UserResponse(id=db_user.id, email=db_user.email)

@app.post("/token", response_model=Token)
def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(), 
    db: Session = Depends(get_db)
):
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(
        data={"sub": user.email}, 
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/loops", response_model=LoopCreate)
def create_loop(
    loop: LoopCreate, 
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    db_loop = Loop(**loop.dict(), owner_id=current_user.id)
    db.add(db_loop)
    db.commit()
    db.refresh(db_loop)
    return db_loop

@app.get("/loops", response_model=List[LoopCreate])
def read_loops(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return db.query(Loop).filter(Loop.owner_id == current_user.id).all()

@app.put("/loops/{loop_id}", response_model=LoopCreate)
def update_loop(
    loop_id: int, 
    loop: LoopUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    db_loop = db.query(Loop).filter(
        Loop.id == loop_id, 
        Loop.owner_id == current_user.id
    ).first()
    
    if not db_loop:
        raise HTTPException(status_code=404, detail="Loop not found")
    
    # Update loop attributes
    for key, value in loop.dict(exclude_unset=True).items():
        setattr(db_loop, key, value)
    
    db.commit()
    db.refresh(db_loop)
    return db_loop

@app.delete("/loops/{loop_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_loop(
    loop_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    db_loop = db.query(Loop).filter(
        Loop.id == loop_id, 
        Loop.owner_id == current_user.id
    ).first()
    
    if not db_loop:
        raise HTTPException(status_code=404, detail="Loop not found")
    
    db.delete(db_loop)
    db.commit()
    return None