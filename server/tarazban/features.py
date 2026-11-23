"""
Numbers that describe each dated invoice against its supplier's normal behaviour (baselines.py).

Where it can, a number is relative: an amount against what this supplier usually bills, roundness
against how round its amounts usually are, a gap against its usual gap. Models read these vectors
(detectors/unusual_pattern.py), and the same numbers, by name, tell the auditor why a model found an
invoice unusual. A new feature is one more entry in FEATURES and one more value in the vector.
"""
import math
from dataclasses import dataclass
from statistics import median

from .text import days_to_year_end, weekday

HISTORY = 48  # the supplier's most recent invoices that set "usual"
YEAR_END_DAYS = 10  # the last days of the Jalali year, when books are closed in a hurry
KNOWN_BEFORE = 60  # a supplier first seen this close to the start of the data was there before it
MIN_HABIT = 5  # invoices before a supplier's own roundness counts as its habit

# name -> which side is unusual: 'high', 'low' or 'both'
FEATURES = {
    'times_usual': 'high',  # log of the amount over the median of the supplier's previous invoices
    'amount_size': 'high',  # log10 of the amount, against all the company's invoices
    'rounder': 'high',  # the supplier's usual count of non-zero digits minus this amount's
    'supplier_age': 'low',  # log days since the supplier's first invoice
    'gap_vs_usual': 'high',  # log of days since its previous invoice over its usual gap: a long silence
    'same_day': 'high',  # the supplier's invoices dated this day, over its count on a busy day (90th percentile)
    'friday': 'high',  # dated on a Friday
    'year_end': 'high',  # dated in the last days of the year
}


@dataclass(slots=True)
class Invoice:
    record: int
    supplier: str  # profile key
    day: int
    amount: float
    usual: float | None  # median of the previous invoices, when there are at least 3
    digits: int
    usual_digits: float
    own_habit: bool  # usual_digits is the supplier's own; else the company's, for a supplier with a few invoices
    age: int | None  # days since the supplier's first invoice; None when it was there before the data
    gap: int | None  # days since the supplier's previous invoice day
    usual_gap: float | None  # the supplier's median gap between invoice days
    same_day: int
    busy_day: int  # the supplier's invoice count on a busy billing day
    vector: list[float]


def significant_digits(amount: float) -> int:
    """500,000,000 has 1, 385,250,000 has 5."""
    return len(str(int(round(amount))).rstrip('0')) or 1


def build(profiles: dict) -> list[Invoice]:
    starts = [p.invoices[0][0] for p in profiles.values() if p.invoices and p.invoices[0][0] is not None]
    if not starts:
        return []
    data_start = min(starts)
    company_digits = median(significant_digits(a) for p in profiles.values() for _, a, _ in p.invoices)
    out = []
    for key, p in profiles.items():
        dated = [(d, a, r) for d, a, r in p.invoices if d is not None]
        if not dated:
            continue
        per_day: dict[int, int] = {}
        for d, _, _ in dated:
            per_day[d] = per_day.get(d, 0) + 1
        days = sorted(per_day)
        usual_gap = median([b - a for a, b in zip(days, days[1:])]) if len(days) > 2 else None
        counts = sorted(per_day.values())
        busy_day = counts[int(0.9 * (len(counts) - 1))]
        # how round this supplier's amounts usually are; a supplier with a few invoices has no habit yet
        own_habit = len(dated) >= MIN_HABIT
        usual_digits = median(significant_digits(a) for _, a, _ in dated) if own_habit else company_digits
        first = dated[0][0]
        known_before = first - data_start < KNOWN_BEFORE
        previous_day = before = None  # before: the last earlier day the supplier billed
        for k, (day, amount, record) in enumerate(dated):
            earlier = [a for _, a, _ in dated[max(0, k - HISTORY):k]]
            usual = median(earlier) if len(earlier) >= 3 else None
            if previous_day is not None and day > previous_day:
                before = previous_day
            gap = day - before if before is not None else None
            age = None if known_before else day - first
            digits = significant_digits(amount)
            vector = [
                math.log(amount / usual) if usual else 0.0,
                math.log10(amount),
                usual_digits - digits,
                math.log1p(age) if age is not None else math.log1p(day - data_start + 365),
                math.log((gap + 1) / (usual_gap + 1)) if gap is not None and usual_gap else 0.0,
                per_day[day] / busy_day,
                1.0 if weekday(day) == 6 else 0.0,
                1.0 if days_to_year_end(day) < YEAR_END_DAYS else 0.0,
            ]
            out.append(Invoice(record, key, day, amount, usual, digits, usual_digits, own_habit, age, gap, usual_gap,
                               per_day[day], busy_day, vector))
            previous_day = day
    return out
