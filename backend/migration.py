import os
import json
from sqlalchemy.orm import Session
from database import SessionLocal, User, Loop
from security import get_current_user

def migrate_local_storage(user_id: int, local_storage_path: str):
    """
    Migrate loops from local storage to database for a specific user
    
    Args:
        user_id (int): ID of the user to migrate loops for
        local_storage_path (str): Path to local storage JSON file
    """
    # Create database session
    db = SessionLocal()
    
    try:
        # Read local storage file
        with open(local_storage_path, 'r') as f:
            local_loops = json.load(f)
        
        # Migrate each loop
        for local_loop in local_loops:
            db_loop = Loop(
                title=local_loop.get('title', 'Migrated Loop'),
                description=local_loop.get('description', ''),
                status=local_loop.get('status', 'active'),
                owner_id=user_id
            )
            db.add(db_loop)
        
        # Commit migrations
        db.commit()
        
        print(f"Successfully migrated {len(local_loops)} loops for user {user_id}")
    
    except Exception as e:
        db.rollback()
        print(f"Migration error: {e}")
    
    finally:
        db.close()

def main():
    # Example usage - in production, this would be part of user registration/import
    local_storage_path = os.path.join(
        os.path.expanduser('~'), 
        '.loops-local-storage.json'
    )
    
    if os.path.exists(local_storage_path):
        # In a real app, you'd get the user_id from authentication
        user_id = 1  # Replace with actual user ID
        migrate_local_storage(user_id, local_storage_path)
    else:
        print("No local storage file found for migration")