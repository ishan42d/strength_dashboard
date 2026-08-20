"""Database initialization script."""
import os
from server import app, db

def init_db():
    """Initialize the database - run this once before first deployment."""
    with app.app_context():
        print("Creating database tables...")
        db.create_all()
        print("✓ Database initialized successfully!")

if __name__ == "__main__":
    init_db()
