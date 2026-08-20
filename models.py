"""SQLAlchemy ORM models for strength dashboard."""
from datetime import datetime
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


class TrainingLog(db.Model):
    """Training session log entry."""
    __tablename__ = 'training_log'
    
    id = db.Column(db.Integer, primary_key=True)
    week = db.Column(db.String(50))
    day = db.Column(db.String(20))
    workout = db.Column(db.String(100))
    date = db.Column(db.DateTime, nullable=False, index=True)
    muscle_group = db.Column(db.String(50))
    exercise = db.Column(db.String(100), nullable=False)
    target_sets_reps = db.Column(db.String(50))
    weight_kg = db.Column(db.Float)
    avg_reps_3_sets = db.Column(db.Float)
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    @property
    def volume(self):
        """Calculate volume: weight * reps * sets."""
        if self.weight_kg and self.avg_reps_3_sets:
            return self.weight_kg * self.avg_reps_3_sets * 3
        return 0
    
    def to_dict(self):
        return {
            'id': self.id,
            'Week': self.week,
            'Day': self.day,
            'Workout': self.workout,
            'Date': self.date.isoformat() if self.date else None,
            'Muscle Group': self.muscle_group,
            'Exercise': self.exercise,
            'Target Sets/Reps': self.target_sets_reps,
            'Weight (kg)': self.weight_kg,
            'Avg Reps (3 sets)': self.avg_reps_3_sets,
            'Notes': self.notes,
            'Volume': self.volume,
        }


class WeightLog(db.Model):
    """Body weight tracking log."""
    __tablename__ = 'weight_log'
    
    id = db.Column(db.Integer, primary_key=True)
    date = db.Column(db.DateTime, nullable=False, index=True, unique=True)
    weight = db.Column(db.Float, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'Date': self.date.isoformat() if self.date else None,
            'Weight': self.weight,
        }


class StepsLog(db.Model):
    """Daily step count log."""
    __tablename__ = 'steps_log'
    
    id = db.Column(db.Integer, primary_key=True)
    date = db.Column(db.DateTime, nullable=False, index=True, unique=True)
    steps = db.Column(db.Integer, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'Date': self.date.isoformat() if self.date else None,
            'Steps': self.steps,
        }
