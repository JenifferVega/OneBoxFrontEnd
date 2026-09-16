"""Generates a Gantt diagram from the exported CSV and saves it as PDF and PNG."""

import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from matplotlib.patches import Patch
from datetime import datetime
import os

CSV_PATH = "/Users/jenifferfunez/Downloads/export_file (1) 1.csv"
OUT_DIR = "/Users/jenifferfunez/Desktop/OneBox"
PDF_PATH = os.path.join(OUT_DIR, "gantt_diagram.pdf")
PNG_PATH = os.path.join(OUT_DIR, "gantt_diagram.png")

STATUS_COLORS = {
    "Completed":   "#4CAF50",
    "In Progress": "#2196F3",
    "Pending":     "#FFC107",
    "Cancelled":   "#9E9E9E",
}
DEFAULT_COLOR = "#90A4AE"

# NOTE: The CSV headers may come from either the English or Spanish export
# of the project-management tool. We normalize any Spanish header to its
# English equivalent so the rest of the script only deals with English names.
COLUMN_ALIASES = {
    "Fecha de inicio planificada": "Planned start date",
    "Fecha de finalización planificada": "Planned end date",
    "Nivel": "Level",
    "Porcentaje completado": "Percent complete",
    "EDT": "WBS",
    "Descripción breve": "Short description",
    "Estado": "Status",
}

df = pd.read_csv(CSV_PATH)
df.columns = [c.strip() for c in df.columns]
df = df.rename(columns=COLUMN_ALIASES)

start_col = "Planned start date"
end_col   = "Planned end date"
df[start_col] = pd.to_datetime(df[start_col], errors="coerce")
df[end_col]   = pd.to_datetime(df[end_col],   errors="coerce")
df["Level"]   = pd.to_numeric(df["Level"], errors="coerce")
df["Percent complete"] = pd.to_numeric(df["Percent complete"], errors="coerce").fillna(0)

df = df.dropna(subset=[start_col, end_col]).reset_index(drop=True)
df = df[df["Level"] >= 2].reset_index(drop=True)

def short(text, n=70):
    if not isinstance(text, str):
        return ""
    text = text.replace("\t", " ").strip()
    return text if len(text) <= n else text[: n - 1] + "…"

df["label"] = df.apply(
    lambda r: ("    " * int(max(r["Level"] - 2, 0))) + f'{r["WBS"]} {short(r["Short description"])}',
    axis=1,
)

df = df.iloc[::-1].reset_index(drop=True)

fig_h = max(8, 0.28 * len(df) + 2)
fig, ax = plt.subplots(figsize=(18, fig_h))

for i, row in df.iterrows():
    start = row[start_col]
    end = row[end_col]
    duration = max((end - start).total_seconds() / 86400, 0.4)
    color = STATUS_COLORS.get(row["Status"], DEFAULT_COLOR)
    is_summary = row["Level"] == 2

    ax.barh(
        i, duration, left=start, height=0.55 if is_summary else 0.42,
        color=color, edgecolor="black", linewidth=0.8 if is_summary else 0.4,
        alpha=0.95 if is_summary else 0.75,
    )

    pct = row["Percent complete"] / 100.0
    if pct > 0:
        ax.barh(i, duration * pct, left=start, height=0.18,
                color="black", alpha=0.55)

    if duration >= 4:
        ax.text(start + (end - start) / 2, i,
                f'{int(row["Percent complete"])}%',
                ha="center", va="center", fontsize=7, color="white",
                fontweight="bold")

ax.set_yticks(range(len(df)))
ax.set_yticklabels(df["label"], fontsize=8)

for tick, level in zip(ax.get_yticklabels(), df["Level"]):
    if level == 2:
        tick.set_fontweight("bold")

ax.xaxis.set_major_locator(mdates.WeekdayLocator(byweekday=mdates.MO))
ax.xaxis.set_major_formatter(mdates.DateFormatter("%d-%b"))
ax.xaxis.set_minor_locator(mdates.DayLocator())
plt.setp(ax.get_xticklabels(), rotation=45, ha="right", fontsize=8)

ax.grid(axis="x", linestyle="--", alpha=0.4)
ax.set_axisbelow(True)

today = pd.Timestamp(datetime.now().date())
if df[start_col].min() <= today <= df[end_col].max():
    ax.axvline(today, color="red", linewidth=1.4, linestyle="--", alpha=0.8)
    ax.text(today, len(df) - 0.5, " today", color="red",
            fontsize=8, fontweight="bold", va="top")

project_name = "DHL Projects — PRJ0019825"
ax.set_title(f"Gantt Diagram — {project_name}",
             fontsize=14, fontweight="bold", pad=14)
ax.set_xlabel("Date")
ax.margins(y=0.005)

legend_items = [Patch(facecolor=c, edgecolor="black", label=s)
                for s, c in STATUS_COLORS.items()]
legend_items.append(Patch(facecolor="black", alpha=0.55, label="Progress %"))
ax.legend(handles=legend_items, loc="lower right", fontsize=9, framealpha=0.95)

plt.tight_layout()
plt.savefig(PDF_PATH, format="pdf", bbox_inches="tight")
plt.savefig(PNG_PATH, format="png", dpi=180, bbox_inches="tight")
plt.close()

print(f"PDF: {PDF_PATH}")
print(f"PNG: {PNG_PATH}")
print(f"Tasks plotted: {len(df)}")
