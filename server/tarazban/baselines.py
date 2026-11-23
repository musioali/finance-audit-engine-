"""
The normal behaviour of each supplier, learned from the company's own rows.

It is recomputed from everything received on every run, so it sharpens with each file. Detectors
read it to tell an unusual event from this supplier's routine: a service fee billed again every month
is routine, the same fee billed twice in two days is not.

Later models (anomaly scores, learning from decisions, a language model writing explanations) read
the same profiles, so what counts as "normal" is decided in one place.
"""
from collections import defaultdict
from dataclasses import dataclass, field

from .detectors import median, supplier_key
from .text import day_number, parse_amount

ROUTINE_MIN_DAYS = 4  # an amount billed on at least this many different days is part of the supplier's routine


@dataclass
class Routine:
    """One amount the supplier bills again and again."""
    count: int  # invoices with exactly this amount
    days: int  # different days they were dated
    gap_days: float  # median days between those days


@dataclass
class Supplier:
    # (day or None, amount, record id) of each invoice with a positive amount, in date order
    invoices: list[tuple[float | None, float, int]] = field(default_factory=list)
    routines: dict[float, Routine] = field(default_factory=dict)


def learn(rows: dict[str, list[dict]]) -> dict[str, Supplier]:
    """Profiles by supplier key, from the stored rows of every kind."""
    profiles: dict[str, Supplier] = defaultdict(Supplier)
    days_of = defaultdict(lambda: defaultdict(list))
    for r in rows.get('invoice', []):
        amount = parse_amount(r.get('total_amount'))
        if amount is None or amount <= 0:
            continue
        key = supplier_key(r)
        day = day_number(r.get('invoice_date'))
        profiles[key].invoices.append((day, amount, r['_id']))
        if day is not None:
            days_of[key][amount].append(day)

    for key, p in profiles.items():
        p.invoices.sort(key=lambda x: (x[0] if x[0] is not None else float('inf'), x[2]))
        for amount, days in days_of[key].items():
            distinct = sorted(set(days))
            if len(distinct) >= ROUTINE_MIN_DAYS:
                gaps = [b - a for a, b in zip(distinct, distinct[1:])]
                p.routines[amount] = Routine(len(days), len(distinct), median(gaps))
    return dict(profiles)
