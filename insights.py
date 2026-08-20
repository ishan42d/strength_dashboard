"""AI insight engine: tries a real OpenAI call (via Azure OpenAI creds
in .env), falls back to a rule-based heuristic engine if that's unavailable
or fails."""
import os
import json
import numpy as np
import pandas as pd
from dotenv import load_dotenv

load_dotenv()

AZURE_OPENAI_KEY = os.getenv("AZURE_OPENAI_KEY")
AZURE_OPENAI_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT")
AZURE_OPENAI_DEPLOYMENT = os.getenv("AZURE_OPENAI_DEPLOYMENT")


def _trend(series: pd.Series):
    s = series.dropna()
    if len(s) < 2:
        return 0.0
    x = np.arange(len(s))
    return np.polyfit(x, s.values, 1)[0]


def _summarize_data(log_df: pd.DataFrame, weight_df: pd.DataFrame) -> dict:
    df = log_df.dropna(subset=["Weight (kg)"]).copy()
    per_exercise = []
    for exercise, g in df.sort_values("Date").groupby("Exercise"):
        g = g.dropna(subset=["Date"])
        if g.empty:
            continue
        per_exercise.append({
            "exercise": exercise,
            "sessions": len(g),
            "first_weight": float(g["Weight (kg)"].iloc[0]),
            "last_weight": float(g["Weight (kg)"].iloc[-1]),
            "trend_slope": round(float(_trend(g["Weight (kg)"])), 3),
        })
    w = weight_df.dropna(subset=["Weight"]).sort_values("Date")
    weight_series = [{"date": str(d.date()), "weight": float(v)} for d, v in zip(w["Date"], w["Weight"])]
    muscle_counts = df["Muscle Group"].value_counts().to_dict() if "Muscle Group" in df else {}
    return {
        "per_exercise": per_exercise,
        "weight_series": weight_series,
        "muscle_group_set_counts": muscle_counts,
        "total_sessions": int(df.dropna(subset=["Date"])["Date"].nunique()),
    }


def _call_openai(summary: dict) -> list[dict] | None:
    if not AZURE_OPENAI_KEY:
        return None
    try:
        from openai import AzureOpenAI
        client = AzureOpenAI(
            api_key=AZURE_OPENAI_KEY,
            api_version="2024-10-01-preview",
            azure_endpoint=AZURE_OPENAI_ENDPOINT
        )
        model = AZURE_OPENAI_DEPLOYMENT or "gpt-4"

        prompt = (
            "You are a knowledgeable strength coach analyzing a lifter's training log. "
            "Here is a JSON summary of their exercise progression, bodyweight trend, and "
            "muscle group set distribution:\n\n"
            f"{json.dumps(summary, indent=2)}\n\n"
            "Return 3-6 concise, specific, actionable insight cards as a JSON array. "
            "Each item must have exactly these keys: "
            '"type" (one of "success", "warning", "info"), "title" (max 6 words), '
            '"body" (1-2 sentences, specific, use exercise names/numbers when relevant). '
            "Respond with ONLY the JSON array, no markdown fences, no extra text."
        )
        resp = client.chat.completions.create(
            model=model,
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}],
        )
        text = resp.choices[0].message.content.strip()
        if text.startswith("```"):
            text = text.strip("`")
            text = text.split("\n", 1)[1] if "\n" in text else text
            if text.lower().startswith("json"):
                text = text[4:]
        data = json.loads(text)
        if isinstance(data, list) and all("title" in d and "body" in d for d in data):
            for d in data:
                d.setdefault("type", "info")
            return data
    except Exception as e:
        print(f"[insights] OpenAI call failed, falling back to rule-based: {e}")
    return None


def _rule_based_insights(log_df: pd.DataFrame, weight_df: pd.DataFrame) -> list[dict]:
    insights = []
    df = log_df.dropna(subset=["Weight (kg)"]).copy()

    if df.empty:
        return [{"type": "info", "title": "Not enough data yet",
                  "body": "Log some sets with weight/reps to unlock AI insights."}]

    overload_wins, plateaus = [], []
    for exercise, g in df.sort_values("Date").groupby("Exercise"):
        g = g.dropna(subset=["Date"])
        if len(g) < 2:
            continue
        slope = _trend(g["Weight (kg)"])
        if slope > 0.05:
            overload_wins.append((exercise, g["Weight (kg)"].iloc[-1], slope))
        elif abs(slope) < 1e-6 and len(g) >= 3:
            plateaus.append(exercise)

    if overload_wins:
        top = sorted(overload_wins, key=lambda t: -t[2])[:3]
        names = ", ".join(f"{n} (now {w:g}kg)" for n, w, _ in top)
        insights.append({"type": "success", "title": "Progressive overload detected",
                          "body": f"You're trending upward in load on {names}. Keep pushing — this is exactly how strength adaptation happens."})

    if plateaus:
        names = ", ".join(plateaus[:3])
        insights.append({"type": "warning", "title": "Possible plateau",
                          "body": f"Weight has stayed flat across recent sessions for {names}. Consider adding reps, a small load bump (2.5-5%), or a deload week."})

    vol_by_date = df.dropna(subset=["Date"]).groupby("Date")["Volume"].sum().sort_index()
    if len(vol_by_date) >= 2:
        slope = _trend(vol_by_date)
        if slope > 0:
            insights.append({"type": "success", "title": "Training volume is climbing",
                              "body": "Total session volume (weight x reps x sets) is trending up. Your work capacity is improving."})
        else:
            insights.append({"type": "warning", "title": "Volume trending down",
                              "body": "Recent session volume is lower than earlier sessions — check recovery, sleep, or nutrition if this wasn't intentional."})

    if "Muscle Group" in df.columns:
        counts = df["Muscle Group"].value_counts()
        if len(counts) > 1 and counts.max() > 2 * counts.min():
            insights.append({"type": "info", "title": "Muscle group imbalance",
                              "body": f"{counts.idxmax()} gets far more logged sets than {counts.idxmin()}. Worth checking your split still hits everything evenly."})

    if len(weight_df.dropna(subset=["Weight"])) >= 2:
        w = weight_df.dropna(subset=["Weight"]).sort_values("Date")
        w_slope = _trend(w["Weight"])
        avg_load_slope = np.mean([s for _, _, s in overload_wins]) if overload_wins else 0
        if w_slope < -0.05 and avg_load_slope > 0:
            insights.append({"type": "success", "title": "Recomposition in progress",
                              "body": "Bodyweight is trending down while lifted loads trend up — a strong sign of body recomposition."})
        elif w_slope > 0.05 and avg_load_slope <= 0:
            insights.append({"type": "warning", "title": "Weight up, strength flat",
                              "body": "Bodyweight is rising but lifts aren't progressing — worth reviewing training intensity, recovery, or protein intake."})

    # Per-exercise reps analysis
    for exercise, g in df.sort_values("Date").groupby("Exercise"):
        g = g.dropna(subset=["Date", "Avg Reps (3 sets)"])
        if len(g) < 2:
            continue
        reps_slope = _trend(g["Avg Reps (3 sets)"])
        last_reps = g["Avg Reps (3 sets)"].iloc[-1]
        last_weight = g["Weight (kg)"].iloc[-1]
        if reps_slope > 0.3 and last_reps >= 12:
            insights.append({"type": "info", "title": f"Time to increase weight on {exercise}",
                              "body": f"You're hitting {last_reps:g} reps at {last_weight:g}kg with reps trending up. Consider bumping the weight 2.5-5% and resetting to 8-10 reps."})
            break
        elif reps_slope < -0.3 and last_reps <= 6:
            insights.append({"type": "warning", "title": f"Reps declining on {exercise}",
                              "body": f"Down to {last_reps:g} reps at {last_weight:g}kg. If fatigue is building, a deload or slight weight drop could help recovery."})
            break

    # Top exercises by volume
    ex_vol = df.groupby("Exercise")["Volume"].sum().sort_values(ascending=False)
    if len(ex_vol) >= 3:
        top3 = ex_vol.head(3)
        names = ", ".join(f"{n} ({v:,.0f})" for n, v in top3.items())
        insights.append({"type": "info", "title": "Highest volume exercises",
                          "body": f"Your top 3 by total volume: {names}. These are driving most of your training stimulus."})

    # Session frequency
    dates_completed = df.dropna(subset=["Date"])["Date"].unique()
    if len(dates_completed) >= 2:
        date_range = (pd.Timestamp(max(dates_completed)) - pd.Timestamp(min(dates_completed))).days
        if date_range > 0:
            freq = len(dates_completed) / (date_range / 7)
            insights.append({"type": "success" if freq >= 3 else "info",
                              "title": f"{freq:.1f} sessions per week",
                              "body": f"You've logged {len(dates_completed)} sessions over {date_range} days. " +
                                      ("Great consistency for building strength." if freq >= 3 else "Try to hit 3-4 sessions/week for optimal progress.")})

    # Bodyweight summary
    if len(weight_df.dropna(subset=["Weight"])) >= 1:
        w = weight_df.dropna(subset=["Weight"]).sort_values("Date")
        latest = w["Weight"].iloc[-1]
        if len(w) >= 2:
            change = latest - w["Weight"].iloc[0]
            direction = "up" if change > 0 else "down"
            insights.append({"type": "info", "title": f"Bodyweight {direction} {abs(change):.1f}kg",
                              "body": f"From {w['Weight'].iloc[0]:.1f}kg to {latest:.1f}kg over your tracking period. " +
                                      ("On a lean bulk trajectory." if change > 0 else "Trending leaner — ensure protein intake stays high to preserve muscle.")})

    if not insights:
        insights.append({"type": "info", "title": "Keep logging",
                          "body": "Add a few more sessions and insights on trends, plateaus, and consistency will start appearing here."})
    return insights


def generate_insights(log_df: pd.DataFrame, weight_df: pd.DataFrame) -> list[dict]:
    summary = _summarize_data(log_df, weight_df)
    ai_result = _call_openai(summary)
    if ai_result:
        return ai_result
    return _rule_based_insights(log_df, weight_df)
