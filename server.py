import os
import json
from datetime import datetime

import pandas as pd
from flask import Flask, jsonify, request, send_from_directory
from dotenv import load_dotenv

from models import db, TrainingLog, WeightLog, StepsLog
from db_utils import (
    load_training_log, load_weight_log, load_steps_log,
    append_training_entry, append_weight_entry, append_steps_entry,
    update_training_entry, delete_training_entry,
)
from insights import generate_insights

# Try to import from Excel for exercise data
try:
    import data_utils as old_data_utils
except ImportError:
    old_data_utils = None

load_dotenv()

app = Flask(__name__, static_folder="static", static_url_path="")

# Database configuration
database_url = os.getenv("DATABASE_URL")
if database_url and database_url.startswith("postgres://"):
    # Railway uses postgres://, but SQLAlchemy requires postgresql://
    database_url = database_url.replace("postgres://", "postgresql://", 1)
    app.config["SQLALCHEMY_DATABASE_URI"] = database_url
elif database_url:
    app.config["SQLALCHEMY_DATABASE_URI"] = database_url
else:
    # Local development: use SQLite
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///strength_dashboard.db"

app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db.init_app(app)


# Global error handler - return JSON instead of HTML for all errors
@app.errorhandler(Exception)
def handle_error(error):
    return jsonify({"error": str(error)}), 500


def df_to_records(df):
    out = df.copy()
    for col in out.columns:
        if "date" in col.lower() or out[col].dtype == "datetime64[ns]":
            out[col] = out[col].apply(lambda v: v.strftime("%Y-%m-%d") if hasattr(v, "strftime") and pd.notnull(v) else None)
    return json.loads(out.to_json(orient="records"))


@app.route("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


@app.route("/api/training", methods=["GET"])
def get_training():
    try:
        df = load_training_log()
        records = df_to_records(df)
        for i, r in enumerate(records):
            r["_idx"] = r.get("id", i)  # Use database ID instead of index
        return jsonify(records)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/training", methods=["POST"])
def add_training():
    try:
        body = request.get_json(force=True)
        if not body.get("Exercise"):
            return jsonify({"error": "Exercise is required"}), 400
        append_training_entry(body)
        return jsonify({"status": "ok"}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/training/<int:row_idx>", methods=["PUT"])
def edit_training(row_idx):
    body = request.get_json(force=True)
    try:
        update_training_entry(row_idx, body)
    except IndexError as e:
        return jsonify({"error": str(e)}), 404
    return jsonify({"status": "ok"})


@app.route("/api/training/<int:row_idx>", methods=["DELETE"])
def remove_training(row_idx):
    try:
        delete_training_entry(row_idx)
    except IndexError as e:
        return jsonify({"error": str(e)}), 404
    return jsonify({"status": "ok"})


@app.route("/api/weight", methods=["GET"])
def get_weight():
    try:
        return jsonify(df_to_records(load_weight_log()))
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/weight", methods=["POST"])
def add_weight():
    try:
        body = request.get_json(force=True)
        date_str = body.get("Date")
        weight = body.get("Weight")
        if not date_str or weight is None:
            return jsonify({"error": "Date and Weight are required"}), 400
        try:
            dt = datetime.strptime(date_str, "%Y-%m-%d")
            weight = float(weight)
        except (ValueError, TypeError):
            return jsonify({"error": "Invalid date or weight"}), 400
        append_weight_entry(dt, weight)
        return jsonify({"status": "ok"}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/steps", methods=["GET"])
def get_steps():
    try:
        return jsonify(df_to_records(load_steps_log()))
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/steps", methods=["POST"])
def add_steps():
    try:
        body = request.get_json(force=True)
        date_str = body.get("Date")
        steps = body.get("Steps")
        if not date_str or steps is None:
            return jsonify({"error": "Date and Steps are required"}), 400
        try:
            dt = datetime.strptime(date_str, "%Y-%m-%d")
            steps = int(steps)
        except (ValueError, TypeError):
            return jsonify({"error": "Invalid date or steps"}), 400
        append_steps_entry(dt, steps)
        return jsonify({"status": "ok"}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/exercises", methods=["GET"])
def get_exercises():
    """Get unique exercises from Excel file (local) or database (Railway), grouped by muscle group."""
    try:
        exercises_by_muscle = {}
        
        # Try loading from Excel first (local development)
        if old_data_utils is not None:
            try:
                excel_df = old_data_utils.load_training_log()
                for _, row in excel_df.iterrows():
                    muscle = row.get("Muscle Group", "").strip()
                    exercise = row.get("Exercise", "").strip()
                    if muscle and exercise:
                        if muscle not in exercises_by_muscle:
                            exercises_by_muscle[muscle] = []
                        if exercise not in exercises_by_muscle[muscle]:
                            exercises_by_muscle[muscle].append(exercise)
            except Exception as e:
                # If Excel fails, continue to database fallback
                pass
        
        # Also load from database (for Railway / production)
        if not exercises_by_muscle:  # Only if Excel failed
            try:
                entries = TrainingLog.query.all()
                for entry in entries:
                    muscle = entry.muscle_group or ""
                    exercise = entry.exercise or ""
                    if muscle and exercise:
                        if muscle not in exercises_by_muscle:
                            exercises_by_muscle[muscle] = []
                        if exercise not in exercises_by_muscle[muscle]:
                            exercises_by_muscle[muscle].append(exercise)
            except Exception as e:
                pass
        
        # Sort exercises within each muscle group
        for muscle in exercises_by_muscle:
            exercises_by_muscle[muscle].sort()
        
        return jsonify(exercises_by_muscle), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/insights", methods=["GET"])
def get_insights():
    try:
        log_df = load_training_log()
        weight_df = load_weight_log()
        return jsonify(generate_insights(log_df, weight_df))
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    port = int(os.getenv("PORT", 5050))
    app.run(host="0.0.0.0", port=port, debug=os.getenv("FLASK_ENV") == "development")
