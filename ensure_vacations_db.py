import os
import sys
from sqlalchemy import text
from database import engine, Base, load_env
import models  # Import to register all models with Base metadata

load_env()

print("Checking database tables...")
try:
    # This will create employee_vacation_days table if it doesn't exist
    Base.metadata.create_all(bind=engine)
    print("Tables checked/created successfully.")
except Exception as e:
    print(f"Error checking/creating tables: {e}")

# Ensure allowed_holidays column exists in users table
with engine.connect() as conn:
    try:
        conn.execute(text("SELECT allowed_holidays FROM users LIMIT 1"))
        print("Column 'allowed_holidays' already exists in 'users' table.")
    except Exception:
        # Rollback the failed transaction from checking
        conn.rollback()
        print("Adding 'allowed_holidays' column to 'users' table...")
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN allowed_holidays INTEGER DEFAULT 21"))
            # Connect commit depends on sqlalchemy version, for safety:
            try:
                conn.commit()
            except AttributeError:
                pass
            print("Successfully added 'allowed_holidays' column.")
        except Exception as e:
            print(f"Error adding column: {e}")

print("Database check completed successfully!")
