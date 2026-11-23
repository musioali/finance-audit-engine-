"""
Detectors: every check, from a fixed rule to a learned model, has the same shape.

A detector reads the stored rows of one kind (in the standard model), and the learned profile of
each supplier (baselines.py), and returns Findings. A Finding carries no prose: only numbers and
names (`facts`), numeric `features` for learning, and the rows behind it. Text is written from the
facts in explain.py, so the wording can change, or be written by a language model, without touching
detection.

To add a detector, write a class with `id`, `title`, `version`, `kind` and `run(rows, profiles)`,
and list it in DETECTORS. Raise `version` whenever what it finds changes: each logged decision keeps
the version it was made on. A detector with `supplementary = True` (a model that looks at everything)
reports only rows that no other detector reports.
"""
from dataclasses import dataclass, field

from ..text import norm_text


@dataclass
class Step:
    """One document in the chain an auditor sees: the row it comes from and its part in the finding."""
    record: int
    role: str
    anomalous: bool
    amount: float | None = None
    facts: dict = field(default_factory=dict)


@dataclass
class Finding:
    detector: str
    entity: str
    risk: float
    confidence: float
    exposure: float
    supplier_id: str | None
    supplier_name: str | None
    warehouse: str | None
    facts: dict
    features: dict
    steps: list[Step]
    records: list[int]


# Helpers on stored rows. A row is its standard fields plus _id, _file and _row.

def supplier_key(r: dict) -> str:
    return norm_text(r.get('supplier_id') or r.get('supplier_name')).upper()


def supplier_label(r: dict) -> str:
    """The name as the file writes it, with Persian ی and ک and single spaces; the half-space stays."""
    name = (r.get('supplier_name') or r.get('supplier_id') or '').replace('ي', 'ی').replace('ك', 'ک')
    return ' '.join(name.split()) or 'نامشخص'


def or_none(v) -> str | None:
    return v.strip() if v and v.strip() else None


def median(values) -> float:
    s = sorted(values)
    mid = len(s) // 2
    return s[mid] if len(s) % 2 else (s[mid - 1] + s[mid]) / 2


from .amount_outlier import AmountOutlier  # noqa: E402
from .duplicate_invoice import DuplicateInvoice  # noqa: E402
from .invoice_without_po import InvoiceWithoutPo  # noqa: E402
from .price_jump import PriceJump  # noqa: E402
from .split_order import SplitOrder  # noqa: E402
from .unusual_pattern import UnusualPattern  # noqa: E402

DETECTORS = [DuplicateInvoice(), InvoiceWithoutPo(), SplitOrder(), PriceJump(), AmountOutlier(), UnusualPattern()]
TITLES = {d.id: d.title for d in DETECTORS}
