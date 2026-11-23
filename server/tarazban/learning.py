"""
Learning from the auditors' decisions.

Every decision is logged with the alert's features as they were (pipeline.decide). Here the latest
decision on each alert becomes a label: «ناهنجاری تأییدشده» is 1, «هشدار نادرست» is 0; other statuses
say nothing about whether the alert was right. From these labels every alert gets a learned confidence,
how likely the auditors are to confirm it, with the numbers it rests on. Three layers, each used once
there are decisions enough for it:

1. the detector's confirmation rate, pulled toward the alert's built-in confidence while decisions are few
2. the same detector for the same supplier, pulled toward (1)
3. in place of (1), a logistic regression on the detector's features, once it has MODEL_MIN decisions
   with at least MODEL_EACH of each kind

Nothing is hidden or removed: the confidence and the order of the list change, the alerts stay. The
detectors' own thresholds are not touched; changing those stays a person's call.
"""
import json
from collections import defaultdict
from dataclasses import dataclass, field

import numpy as np
from sklearn.linear_model import LogisticRegression

LABELS = {'CONFIRMED': 1, 'FALSE_POSITIVE': 0}
PRIOR = 4  # the built-in confidence counts as this many decisions
SUPPLIER_PRIOR = 3  # the detector's learned rate counts as this many decisions for one supplier
MODEL_MIN = 20
MODEL_EACH = 5


@dataclass
class Model:
    names: list[str]
    mean: np.ndarray
    scale: np.ndarray
    fit: LogisticRegression
    reviewed: int

    def probability(self, features: dict) -> tuple[float, list[dict]]:
        x = (np.array([float(features.get(n, 0) or 0) for n in self.names]) - self.mean) / self.scale
        p = float(self.fit.predict_proba(x.reshape(1, -1))[0, 1])
        effect = self.fit.coef_[0] * x  # how far each number moves this alert, on the log-odds scale
        top = sorted(range(len(self.names)), key=lambda j: -abs(effect[j]))[:2]
        factors = [{'feature': self.names[j], 'higher': bool(x[j] > 0), 'raises': bool(effect[j] > 0)}
                   for j in top if abs(effect[j]) > 0.1]
        return p, factors


@dataclass
class Learned:
    rates: dict = field(default_factory=dict)  # detector -> (confirmed, reviewed)
    suppliers: dict = field(default_factory=dict)  # (detector, supplier) -> (confirmed, reviewed)
    models: dict = field(default_factory=dict)  # detector -> Model

    def confidence(self, detector: str, supplier: str, built_in: float, features: dict) -> tuple[float, dict]:
        """Learned confidence (0 to 100) and the facts behind it."""
        confirmed, reviewed = self.rates.get(detector, (0, 0))
        basis = {'reviewed': reviewed, 'confirmed': confirmed}
        model = self.models.get(detector)
        if model:
            p, factors = model.probability(features)
            basis.update(source='model', factors=factors)
        else:
            p = (confirmed + PRIOR * built_in / 100) / (reviewed + PRIOR)
            basis['source'] = 'rate' if reviewed else 'built_in'
        s_confirmed, s_reviewed = self.suppliers.get((detector, supplier), (0, 0))
        if s_reviewed:
            p = (s_confirmed + SUPPLIER_PRIOR * p) / (s_reviewed + SUPPLIER_PRIOR)
            basis.update(supplier_reviewed=s_reviewed, supplier_confirmed=s_confirmed)
        return round(100 * p, 1), basis


def supplier_of(row) -> str:
    return (row['supplier_id'] or row['supplier_name'] or '').strip()


def learn(conn) -> Learned:
    latest = {}
    for d in conn.execute(
        'SELECT d.alert_id, d.status, d.detector, d.features, a.supplier_id, a.supplier_name '
        'FROM decisions d JOIN alerts a ON a.id = d.alert_id ORDER BY d.id'
    ):
        latest[d['alert_id']] = d
    labelled = defaultdict(list)
    out = Learned()
    rates, suppliers = defaultdict(lambda: [0, 0]), defaultdict(lambda: [0, 0])
    for d in latest.values():
        if d['status'] not in LABELS:
            continue
        y = LABELS[d['status']]
        labelled[d['detector']].append((json.loads(d['features']), y))
        rates[d['detector']][0] += y
        rates[d['detector']][1] += 1
        key = (d['detector'], supplier_of(d))
        suppliers[key][0] += y
        suppliers[key][1] += 1
    out.rates = {k: tuple(v) for k, v in rates.items()}
    out.suppliers = {k: tuple(v) for k, v in suppliers.items()}
    for detector, rows in labelled.items():
        ys = [y for _, y in rows]
        if len(rows) >= MODEL_MIN and min(sum(ys), len(ys) - sum(ys)) >= MODEL_EACH:
            out.models[detector] = _fit(rows)
    return out


def _fit(rows: list[tuple[dict, int]]) -> Model:
    names = sorted({k for f, _ in rows for k, v in f.items() if isinstance(v, (int, float))})
    x = np.array([[float(f.get(n, 0) or 0) for n in names] for f, _ in rows])
    mean, scale = x.mean(axis=0), x.std(axis=0)
    scale[scale == 0] = 1
    fit = LogisticRegression(C=1.0, max_iter=1000).fit((x - mean) / scale, [y for _, y in rows])
    return Model(names, mean, scale, fit, len(rows))
