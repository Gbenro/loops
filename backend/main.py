from datetime import datetime, timedelta
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List

from database import get_db, User, Loop, Subtask, Base, engine
from security import (
    create_access_token,
    get_password_hash,
    authenticate_user,
    get_current_user,
    ACCESS_TOKEN_EXPIRE_MINUTES
)
from schemas import (
    UserCreate, UserResponse, Token,
    LoopCreate, LoopUpdate, LoopResponse,
    SyncRequest, SyncResponse, SubtaskBase
)

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI()

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def loop_to_response(db_loop: Loop) -> dict:
    """Convert DB Loop to response format with camelCase fields."""
    return {
        "id": db_loop.client_id,
        "tier": db_loop.tier,
        "type": db_loop.type,
        "recurrence": db_loop.recurrence,
        "status": db_loop.status,
        "title": db_loop.title,
        "color": db_loop.color,
        "period": db_loop.period,
        "linkedTo": db_loop.linked_to,
        "rolledFrom": db_loop.rolled_from,
        "subtasks": [
            {"id": s.client_id, "text": s.text, "done": s.done}
            for s in sorted(db_loop.subtasks, key=lambda x: x.order)
        ],
        "created_at": db_loop.created_at,
        "updated_at": db_loop.updated_at,
    }


@app.post("/signup", response_model=UserResponse)
def create_user(user: UserCreate, db: Session = Depends(get_db)):
    existing_user = db.query(User).filter(User.email == user.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

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


@app.post("/loops", response_model=LoopResponse)
def create_loop(
    loop: LoopCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    db_loop = Loop(
        client_id=loop.id,
        tier=loop.tier,
        type=loop.type,
        recurrence=loop.recurrence,
        status=loop.status,
        title=loop.title,
        color=loop.color,
        period=loop.period,
        linked_to=loop.linkedTo,
        rolled_from=loop.rolledFrom,
        owner_id=current_user.id
    )
    db_loop.subtasks = [
        Subtask(client_id=s.id, text=s.text, done=s.done, order=i)
        for i, s in enumerate(loop.subtasks)
    ]
    db.add(db_loop)
    db.commit()
    db.refresh(db_loop)
    return loop_to_response(db_loop)


@app.get("/loops", response_model=List[LoopResponse])
def read_loops(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    loops = db.query(Loop).filter(Loop.owner_id == current_user.id).all()
    return [loop_to_response(l) for l in loops]


@app.get("/loops/{client_id}", response_model=LoopResponse)
def get_loop(
    client_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    db_loop = db.query(Loop).filter(
        Loop.client_id == client_id,
        Loop.owner_id == current_user.id
    ).first()
    if not db_loop:
        raise HTTPException(status_code=404, detail="Loop not found")
    return loop_to_response(db_loop)


@app.put("/loops/{client_id}", response_model=LoopResponse)
def update_loop(
    client_id: str,
    loop: LoopUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    db_loop = db.query(Loop).filter(
        Loop.client_id == client_id,
        Loop.owner_id == current_user.id
    ).first()

    if not db_loop:
        raise HTTPException(status_code=404, detail="Loop not found")

    update_data = loop.model_dump(exclude_unset=True)

    # Handle field name mapping
    field_mapping = {
        "linkedTo": "linked_to",
        "rolledFrom": "rolled_from"
    }

    for key, value in update_data.items():
        if key == "subtasks" and value is not None:
            # Replace subtasks
            db.query(Subtask).filter(Subtask.loop_id == db_loop.id).delete()
            db_loop.subtasks = [
                Subtask(client_id=s["id"], text=s["text"], done=s["done"], order=i)
                for i, s in enumerate(value)
            ]
        else:
            db_key = field_mapping.get(key, key)
            setattr(db_loop, db_key, value)

    db.commit()
    db.refresh(db_loop)
    return loop_to_response(db_loop)


@app.delete("/loops/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_loop(
    client_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    db_loop = db.query(Loop).filter(
        Loop.client_id == client_id,
        Loop.owner_id == current_user.id
    ).first()

    if not db_loop:
        raise HTTPException(status_code=404, detail="Loop not found")

    db.delete(db_loop)
    db.commit()
    return None


@app.post("/sync", response_model=SyncResponse)
def sync_loops(
    sync_req: SyncRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Bulk sync endpoint for offline-first pattern.
    Accepts all client loops, returns merged server state.
    """
    server_time = datetime.utcnow()
    conflicts = []

    # Get existing loop client_ids for this user
    existing_loops = {
        l.client_id: l
        for l in db.query(Loop).filter(Loop.owner_id == current_user.id).all()
    }

    client_ids_seen = set()

    for client_loop in sync_req.loops:
        client_ids_seen.add(client_loop.id)
        existing = existing_loops.get(client_loop.id)

        if existing:
            # Check for conflicts
            if sync_req.lastSyncTimestamp and existing.updated_at > sync_req.lastSyncTimestamp:
                conflicts.append({
                    "client_id": client_loop.id,
                    "reason": "server_modified"
                })
            # Update existing loop
            existing.tier = client_loop.tier
            existing.type = client_loop.type
            existing.recurrence = client_loop.recurrence
            existing.status = client_loop.status
            existing.title = client_loop.title
            existing.color = client_loop.color
            existing.period = client_loop.period
            existing.linked_to = client_loop.linkedTo
            existing.rolled_from = client_loop.rolledFrom
            existing.updated_at = server_time

            # Replace subtasks
            db.query(Subtask).filter(Subtask.loop_id == existing.id).delete()
            existing.subtasks = [
                Subtask(client_id=s.id, text=s.text, done=s.done, order=i)
                for i, s in enumerate(client_loop.subtasks)
            ]
        else:
            # Create new loop
            db_loop = Loop(
                client_id=client_loop.id,
                tier=client_loop.tier,
                type=client_loop.type,
                recurrence=client_loop.recurrence,
                status=client_loop.status,
                title=client_loop.title,
                color=client_loop.color,
                period=client_loop.period,
                linked_to=client_loop.linkedTo,
                rolled_from=client_loop.rolledFrom,
                owner_id=current_user.id,
                created_at=server_time,
                updated_at=server_time
            )
            db_loop.subtasks = [
                Subtask(client_id=s.id, text=s.text, done=s.done, order=i)
                for i, s in enumerate(client_loop.subtasks)
            ]
            db.add(db_loop)

    # Delete loops not in client's list (they were deleted client-side)
    for client_id, existing in existing_loops.items():
        if client_id not in client_ids_seen:
            db.delete(existing)

    db.commit()

    # Return all user's loops
    all_loops = db.query(Loop).filter(Loop.owner_id == current_user.id).all()

    return SyncResponse(
        loops=[loop_to_response(l) for l in all_loops],
        serverTimestamp=server_time,
        conflicts=conflicts
    )
