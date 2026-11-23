"""
Invoices whose combination of numbers is rare in this company's own data (Isolation Forest).

No rule says what to look for. The model splits the invoices at random again and again: an ordinary
invoice sits among many like it and takes many splits to stand alone, a rare one is cut off in a few.
Each invoice is described by features.py, mostly against its own supplier's normal, so a big supplier's
big invoice is ordinary and a new supplier's first round invoice dated on a Friday is not.

Rare is not wrong: the model has no labels. Its alerts carry a lower confidence than the rules', name
the invoice's numbers that are rare and how rare, and are what the auditors' decisions will teach to
rank. An invoice another detector already reports is not reported again here (`supplementary`).
"""
import numpy as np
from sklearn.ensemble import IsolationForest

from . import Finding, Step, or_none, supplier_label
from .. import features as feats

MIN_INVOICES = 1000  # with fewer, "rare" means little
TREES = 200
SCORE_MIN = 0.65  # isolation score; about 0.5 is ordinary, near 1 is cut off at once
SHARE_MAX = 0.001  # and never more than this share of the invoices (1 in 1,000)
REASON_SHARE = 0.05  # a number is named as a reason when at most this share of invoices is as extreme
NAMES = list(feats.FEATURES)


def isolation_scores(x: np.ndarray) -> np.ndarray:
    """How quickly random splits cut each row off: about 0.5 is ordinary, near 1 is cut off at once."""
    # only one side of most numbers matters to an auditor (an invoice far smaller than usual, or less
    # round, is not a warning), so the model sees the ordinary side folded onto the middle value
    middle = np.median(x, axis=0)
    seen = x.copy()
    for j, side in enumerate(feats.FEATURES.values()):
        if side == 'high':
            seen[:, j] = np.maximum(seen[:, j], middle[j])
        elif side == 'low':
            seen[:, j] = np.minimum(seen[:, j], middle[j])
    return -IsolationForest(n_estimators=TREES, random_state=0).fit(seen).score_samples(seen)


def _share(column: np.ndarray, value: float, side: str) -> float:
    n = len(column)
    above = (n - np.searchsorted(column, value, 'left')) / n
    below = np.searchsorted(column, value, 'right') / n
    return {'high': above, 'low': below}.get(side, min(above, below))


class UnusualPattern:
    id = 'P0_UNUSUAL_PATTERN'
    title = 'ترکیب نادر در فاکتور'
    version = '1.0.0'
    kind = 'invoice'
    supplementary = True

    def run(self, rows: list[dict], profiles: dict) -> list[Finding]:
        invoices = feats.build(profiles)
        if len(invoices) < MIN_INVOICES:
            return []
        x = np.array([i.vector for i in invoices])
        scores = isolation_scores(x)
        columns = np.sort(x, axis=0)
        by_id = {r['_id']: r for r in rows}
        findings = []
        for k in np.argsort(-scores)[: max(1, int(len(invoices) * SHARE_MAX))]:
            if scores[k] < SCORE_MIN:
                break
            inv = invoices[k]
            reasons = self._reasons(inv, x[k], columns)
            findings.append(self._finding(by_id[inv.record], inv, float(scores[k]), reasons, len(invoices)))
        return findings

    def _reasons(self, inv, vector, columns) -> list[dict]:
        rare = sorted(
            (_share(columns[:, j], vector[j], side), name) for j, (name, side) in enumerate(feats.FEATURES.items())
        )
        unknown = {'times_usual': inv.usual is None, 'supplier_age': inv.age is None, 'gap_vs_usual': not inv.usual_gap}
        rare = [(s, n) for s, n in rare if not unknown.get(n)]
        picked = [(s, n) for s, n in rare if s <= REASON_SHARE] or rare[:1]
        out = []
        for share, name in picked[:3]:
            r = {'feature': name, 'share_pct': round(float(share) * 100, 2)}
            if name == 'times_usual':
                r.update(times=round(inv.amount / inv.usual, 1), usual_rials=inv.usual)
            elif name == 'rounder':
                r.update(digits=inv.digits, usual_digits=inv.usual_digits, own_habit=inv.own_habit)
            elif name == 'supplier_age':
                r.update(days=inv.age)
            elif name == 'gap_vs_usual':
                r.update(gap_days=inv.gap, usual_gap_days=inv.usual_gap)
            elif name == 'same_day':
                r.update(count=inv.same_day, busy_day=inv.busy_day)
            out.append(r)
        return out

    def _finding(self, r, inv, score, reasons, n) -> Finding:
        number = r.get('invoice_number') or r.get('invoice_id') or f"سطر {r['_row']}"
        return Finding(
            detector=self.id,
            entity=r.get('invoice_id') or number,
            risk=min(85, 50 + 100 * (score - 0.5)),
            confidence=50,  # no labels yet: the auditors' decisions will tell how often rare is wrong
            exposure=inv.amount,
            supplier_id=or_none(r.get('supplier_id')),
            supplier_name=supplier_label(r),
            warehouse=or_none(r.get('warehouse_code')),
            facts={
                'supplier': supplier_label(r),
                'invoice_number': number,
                'invoice_date': r.get('invoice_date') or '',
                'amount_rials': inv.amount,
                'isolation_score': round(score, 3),
                'company_invoices': n,
                'reasons': reasons,
            },
            features={**dict(zip(NAMES, inv.vector)), 'isolation_score': score},
            steps=[Step(r['_id'], 'pattern', True, inv.amount, {'reasons': [x['feature'] for x in reasons]})],
            records=[r['_id']],
        )
