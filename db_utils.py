"""Database layer for strength dashboard - replaces Excel-based data storage."""
import pandas as pd
from datetime import datetime
from models import db, TrainingLog, WeightLog, StepsLog


def load_training_log() -> pd.DataFrame:
    """Load all training log entries as DataFrame."""
    entries = TrainingLog.query.order_by(TrainingLog.date).all()
    data = []
    for entry in entries:
        row = entry.to_dict()
        data.append(row)
    
    if not data:
        return pd.DataFrame(columns=[
            "Week", "Day", "Workout", "Date", "Muscle Group", "Exercise",
            "Target Sets/Reps", "Weight (kg)", "Avg Reps (3 sets)", "Notes", "Volume"
        ])
    
    df = pd.DataFrame(data)
    df["Date"] = pd.to_datetime(df["Date"], errors="coerce")
    df["Weight (kg)"] = pd.to_numeric(df["Weight (kg)"], errors="coerce")
    df["Avg Reps (3 sets)"] = pd.to_numeric(df["Avg Reps (3 sets)"], errors="coerce")
    return df


def load_weight_log() -> pd.DataFrame:
    """Load all weight log entries as DataFrame."""
    entries = WeightLog.query.order_by(WeightLog.date).all()
    data = [entry.to_dict() for entry in entries]
    
    if not data:
        return pd.DataFrame(columns=["Date", "Weight"])
    
    df = pd.DataFrame(data)
    df["Date"] = pd.to_datetime(df["Date"], errors="coerce")
    df["Weight"] = pd.to_numeric(df["Weight"], errors="coerce")
    return df.sort_values("Date").reset_index(drop=True)


def load_steps_log() -> pd.DataFrame:
    """Load all steps log entries as DataFrame."""
    entries = StepsLog.query.order_by(StepsLog.date).all()
    data = [entry.to_dict() for entry in entries]
    
    if not data:
        return pd.DataFrame(columns=["Date", "Steps"])
    
    df = pd.DataFrame(data)
    df["Date"] = pd.to_datetime(df["Date"], errors="coerce")
    df["Steps"] = pd.to_numeric(df["Steps"], errors="coerce")
    return df.sort_values("Date").reset_index(drop=True)


def append_training_entry(entry: dict):
    """Add a new training log entry."""
    try:
        # Parse date safely
        date_obj = None
        if entry.get("Date"):
            try:
                if isinstance(entry.get("Date"), str):
                    date_obj = datetime.fromisoformat(entry.get("Date"))
                else:
                    date_obj = entry.get("Date")
            except (ValueError, TypeError) as de:
                print(f"[db] Date parse error: {de}, using now()")
                date_obj = datetime.now()
        else:
            date_obj = datetime.now()
        
        new_entry = TrainingLog(
            week=entry.get("Week"),
            day=entry.get("Day"),
            workout=entry.get("Workout"),
            date=date_obj,
            muscle_group=entry.get("Muscle Group"),
            exercise=entry.get("Exercise"),
            target_sets_reps=entry.get("Target Sets/Reps"),
            weight_kg=entry.get("Weight (kg)"),
            avg_reps_3_sets=entry.get("Avg Reps (3 sets)"),
            notes=entry.get("Notes"),
        )
        db.session.add(new_entry)
        db.session.commit()
        print("[db] Training entry added successfully")
    except Exception as e:
        db.session.rollback()
        print(f"[db] Error adding training entry: {e}")
        raise Exception(f"Failed to save training entry: {str(e)}")


def update_training_entry(row_id: int, updates: dict):
    """Update an existing training log entry."""
    entry = TrainingLog.query.filter_by(id=row_id).first()
    if not entry:
        raise IndexError(f"Training entry {row_id} not found")
    
    for key, value in updates.items():
        if key == "Date" and value:
            entry.date = datetime.fromisoformat(value) if isinstance(value, str) else value
        elif key == "Week":
            entry.week = value
        elif key == "Day":
            entry.day = value
        elif key == "Workout":
            entry.workout = value
        elif key == "Muscle Group":
            entry.muscle_group = value
        elif key == "Exercise":
            entry.exercise = value
        elif key == "Target Sets/Reps":
            entry.target_sets_reps = value
        elif key == "Weight (kg)":
            entry.weight_kg = value
        elif key == "Avg Reps (3 sets)":
            entry.avg_reps_3_sets = value
        elif key == "Notes":
            entry.notes = value
    
    db.session.commit()


def delete_training_entry(row_id: int):
    """Delete a training log entry."""
    entry = TrainingLog.query.filter_by(id=row_id).first()
    if not entry:
        raise IndexError(f"Training entry {row_id} not found")
    db.session.delete(entry)
    db.session.commit()


def append_weight_entry(date: datetime, weight: float):
    """Add or update a weight log entry."""
    try:
        # Normalize date to midnight (ignore time component)
        date_normalized = date.replace(hour=0, minute=0, second=0, microsecond=0)
        
        # Check if entry for this date exists by comparing date only
        existing = WeightLog.query.filter(
            db.func.date(WeightLog.date) == date_normalized.date()
        ).first()
        
        if existing:
            # Update existing entry
            existing.weight = weight
            existing.updated_at = datetime.utcnow()
            print(f"[db] Weight entry updated for {date_normalized.date()}")
        else:
            # Create new entry
            new_entry = WeightLog(date=date_normalized, weight=weight)
            db.session.add(new_entry)
            print(f"[db] Weight entry created for {date_normalized.date()}")
        
        db.session.commit()
        print("[db] Weight entry saved successfully")
    except Exception as e:
        db.session.rollback()
        print(f"[db] Error adding weight entry: {e}")
        raise Exception(f"Failed to save weight entry: {str(e)}")


def append_steps_entry(date: datetime, steps: int):
    """Add or update a steps log entry."""
    try:
        # Normalize date to midnight (ignore time component)
        date_normalized = date.replace(hour=0, minute=0, second=0, microsecond=0)
        
        # Check if entry for this date exists by comparing date only
        existing = StepsLog.query.filter(
            db.func.date(StepsLog.date) == date_normalized.date()
        ).first()
        
        if existing:
            # Update existing entry
            existing.steps = steps
            existing.updated_at = datetime.utcnow()
            print(f"[db] Steps entry updated for {date_normalized.date()}")
        else:
            # Create new entry
            new_entry = StepsLog(date=date_normalized, steps=steps)
            db.session.add(new_entry)
            print(f"[db] Steps entry created for {date_normalized.date()}")
        
        db.session.commit()
        print("[db] Steps entry saved successfully")
    except Exception as e:
        db.session.rollback()
        print(f"[db] Error adding steps entry: {e}")
        raise Exception(f"Failed to save steps entry: {str(e)}")
