"""Script to migrate data from Excel files to PostgreSQL database."""
import os
import sys
from datetime import datetime
from pathlib import Path

# Add the project root to path
sys.path.insert(0, str(Path(__file__).parent))

from server import app, db
from models import TrainingLog, WeightLog, StepsLog

def migrate_from_excel():
    """Import data from existing Excel file to database."""
    try:
        import pandas as pd
        import openpyxl
    except ImportError:
        print("Error: pandas and openpyxl are required for migration")
        print("Install with: pip install pandas openpyxl")
        return False
    
    data_file = Path(__file__).parent / "Strength_Training_Log.xlsx"
    
    if not data_file.exists():
        print(f"No Excel file found at {data_file}")
        print("Skipping migration.")
        return True
    
    print(f"Migrating data from {data_file}...")
    
    with app.app_context():
        try:
            # Import Training Log
            print("\n📝 Importing Training Log...")
            try:
                df = pd.read_excel(data_file, sheet_name="Training Log")
                df["Date"] = pd.to_datetime(df["Date"], errors="coerce")
                
                for _, row in df.iterrows():
                    if pd.isna(row["Date"]):
                        continue
                    
                    entry = TrainingLog(
                        week=row.get("Week"),
                        day=row.get("Day"),
                        workout=row.get("Workout"),
                        date=row["Date"],
                        muscle_group=row.get("Muscle Group"),
                        exercise=row.get("Exercise"),
                        target_sets_reps=row.get("Target Sets/Reps"),
                        weight_kg=pd.to_numeric(row.get("Weight (kg)"), errors="coerce"),
                        avg_reps_3_sets=pd.to_numeric(row.get("Avg Reps (3 sets)"), errors="coerce"),
                        notes=row.get("Notes"),
                    )
                    db.session.add(entry)
                
                db.session.commit()
                count = db.session.query(TrainingLog).count()
                print(f"   ✓ Imported {count} training entries")
            except Exception as e:
                print(f"   ⚠ Training log import failed: {e}")
                db.session.rollback()
            
            # Import Weight Log
            print("\n⚖️  Importing Weight Log...")
            try:
                df = pd.read_excel(data_file, sheet_name="Weight_Log")
                df["Date"] = pd.to_datetime(df["Date"], errors="coerce")
                
                for _, row in df.iterrows():
                    if pd.isna(row["Date"]):
                        continue
                    
                    entry = WeightLog(
                        date=row["Date"],
                        weight=pd.to_numeric(row.get("Weight"), errors="coerce"),
                    )
                    db.session.add(entry)
                
                db.session.commit()
                count = db.session.query(WeightLog).count()
                print(f"   ✓ Imported {count} weight entries")
            except Exception as e:
                print(f"   ⚠ Weight log import failed: {e}")
                db.session.rollback()
            
            # Import Steps Log
            print("\n👟 Importing Steps Log...")
            try:
                df = pd.read_excel(data_file, sheet_name="Steps_Log")
                df["Date"] = pd.to_datetime(df["Date"], errors="coerce")
                
                for _, row in df.iterrows():
                    if pd.isna(row["Date"]):
                        continue
                    
                    entry = StepsLog(
                        date=row["Date"],
                        steps=pd.to_numeric(row.get("Steps"), errors="coerce"),
                    )
                    db.session.add(entry)
                
                db.session.commit()
                count = db.session.query(StepsLog).count()
                print(f"   ✓ Imported {count} steps entries")
            except Exception as e:
                print(f"   ⚠ Steps log import failed: {e}")
                db.session.rollback()
            
            print("\n✓ Migration completed successfully!")
            return True
            
        except Exception as e:
            print(f"\n✗ Migration failed: {e}")
            db.session.rollback()
            return False

if __name__ == "__main__":
    success = migrate_from_excel()
    sys.exit(0 if success else 1)
