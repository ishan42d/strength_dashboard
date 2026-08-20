"""Load/save helpers for the Strength_Training_Log.xlsx workbook."""
import openpyxl
import pandas as pd
from datetime import datetime
from pathlib import Path

DATA_FILE = Path(__file__).parent / "Strength_Training_Log.xlsx"
LOG_SHEET = "Training Log"
WEIGHT_SHEET = "Weight_Log"

LOG_COLS = ["Week", "Day", "Workout", "Date", "Muscle Group", "Exercise",
            "Target Sets/Reps", "Weight (kg)", "Avg Reps (3 sets)", "Notes"]
WEIGHT_COLS = ["Date", "Weight"]
STEPS_SHEET = "Steps_Log"
STEPS_COLS = ["Date", "Steps"]


def load_training_log() -> pd.DataFrame:
    df = pd.read_excel(DATA_FILE, sheet_name=LOG_SHEET)
    df["Date"] = pd.to_datetime(df["Date"], errors="coerce")
    df["Weight (kg)"] = pd.to_numeric(df["Weight (kg)"], errors="coerce")
    df["Avg Reps (3 sets)"] = pd.to_numeric(df["Avg Reps (3 sets)"], errors="coerce")
    df["Volume"] = df["Weight (kg)"] * df["Avg Reps (3 sets)"] * 3
    return df


def load_weight_log() -> pd.DataFrame:
    df = pd.read_excel(DATA_FILE, sheet_name=WEIGHT_SHEET)
    df["Date"] = pd.to_datetime(df["Date"], errors="coerce")
    df["Weight"] = pd.to_numeric(df["Weight"], errors="coerce")
    return df.sort_values("Date").reset_index(drop=True)


def load_steps_log() -> pd.DataFrame:
    try:
        df = pd.read_excel(DATA_FILE, sheet_name=STEPS_SHEET)
    except ValueError:
        df = pd.DataFrame(columns=STEPS_COLS)
    df["Date"] = pd.to_datetime(df["Date"], errors="coerce")
    df["Steps"] = pd.to_numeric(df["Steps"], errors="coerce")
    return df.sort_values("Date").reset_index(drop=True)


def _save_all(log_df: pd.DataFrame, weight_df: pd.DataFrame, steps_df: pd.DataFrame | None = None):
    with pd.ExcelWriter(DATA_FILE, engine="openpyxl", mode="w") as writer:
        log_df.to_excel(writer, sheet_name=LOG_SHEET, index=False)
        weight_df.to_excel(writer, sheet_name=WEIGHT_SHEET, index=False)
        if steps_df is not None:
            steps_df.to_excel(writer, sheet_name=STEPS_SHEET, index=False)


def _save_both(log_df: pd.DataFrame, weight_df: pd.DataFrame):
    steps_df = load_steps_log()
    _save_all(log_df, weight_df, steps_df)


def _write_training(df: pd.DataFrame):
    weight_df = load_weight_log()
    _save_both(df, weight_df)


def append_training_entry(entry: dict):
    df = pd.read_excel(DATA_FILE, sheet_name=LOG_SHEET)
    new_row = {c: entry.get(c) for c in LOG_COLS}
    df = pd.concat([df, pd.DataFrame([new_row])], ignore_index=True)
    _write_training(df)


def update_training_entry(row_index: int, updates: dict):
    df = pd.read_excel(DATA_FILE, sheet_name=LOG_SHEET)
    if row_index < 0 or row_index >= len(df):
        raise IndexError(f"Row {row_index} out of range (0-{len(df)-1})")
    for k, v in updates.items():
        if k in df.columns:
            df.at[row_index, k] = v
    _write_training(df)


def delete_training_entry(row_index: int):
    df = pd.read_excel(DATA_FILE, sheet_name=LOG_SHEET)
    if row_index < 0 or row_index >= len(df):
        raise IndexError(f"Row {row_index} out of range (0-{len(df)-1})")
    df = df.drop(index=row_index).reset_index(drop=True)
    _write_training(df)


def append_weight_entry(date: datetime, weight: float):
    df = pd.read_excel(DATA_FILE, sheet_name=WEIGHT_SHEET)
    new_row = {"Date": date, "Weight": weight}
    df = pd.concat([df, pd.DataFrame([new_row])], ignore_index=True)
    df = df.sort_values("Date").reset_index(drop=True)
    log_df = pd.read_excel(DATA_FILE, sheet_name=LOG_SHEET)
    steps_df = load_steps_log()
    _save_all(log_df, df, steps_df)


def append_steps_entry(date: datetime, steps: int):
    df = load_steps_log()
    mask = df["Date"].dt.date == date.date()
    if mask.any():
        df.loc[mask, "Steps"] = steps
    else:
        df = pd.concat([df, pd.DataFrame([{"Date": date, "Steps": steps}])], ignore_index=True)
    df = df.sort_values("Date").reset_index(drop=True)
    log_df = pd.read_excel(DATA_FILE, sheet_name=LOG_SHEET)
    weight_df = pd.read_excel(DATA_FILE, sheet_name=WEIGHT_SHEET)
    _save_all(log_df, weight_df, df)
