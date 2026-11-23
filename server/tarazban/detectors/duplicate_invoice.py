"""
The same supplier invoice entered twice: the same number written differently, a re-entry suffix, or two
swapped digits.

A suffix or a swap alone is weak evidence, and it is weaker still when the amount is one the supplier
bills routinely: a monthly fee with numbers 1023 and 1032 is two months, not one invoice twice. Such a
pair is left out when the two are as far apart as the supplier's usual gap for that amount, learned
from its own history (baselines.py); the same fee twice within a couple of days is still flagged.
"""
import re
from collections import defaultdict

from ..text import day_number, parse_amount, std_digits
from . import Finding, Step, or_none, supplier_key, supplier_label

DUPLICATE_DAYS = 30  # a suffix or digit swap alone is weak: the two must also be dated this close


def invoice_key(raw: str) -> str:
    """Invoice numbers compared the way a person would: no separators, no case, no leading zeros, one digit set."""
    s = re.sub(r'[^0-9A-Z؀-ۿ]', '', std_digits(raw).upper())
    return re.sub(r'(^|[^0-9])0+(?=\d)', r'\1', s)


def suffix_base(raw: str) -> str | None:
    """"F-1001-A", "F-1001 B", "1001/2": the number with a short suffix added, which usually marks a re-entry."""
    s = std_digits(raw).strip()
    m = re.match(r'^(.*?\d)[\s\-_/.]?([A-Za-z]{1,2})$', s) or re.match(r'^(.*\d)[\-_/.](\d{1,2})$', s)
    return invoice_key(m[1]) if m else None


def is_adjacent_swap(a: str, b: str) -> bool:
    if len(a) != len(b) or a == b:
        return False
    diff = [i for i in range(len(a)) if a[i] != b[i]]
    return len(diff) == 2 and diff[1] == diff[0] + 1 and a[diff[0]] == b[diff[1]] and a[diff[1]] == b[diff[0]]


class DuplicateInvoice:
    id = 'P0_DUPLICATE_INVOICE'
    title = 'فاکتور تکراری و مشابه'
    version = '1.3.0'
    kind = 'invoice'

    def run(self, rows: list[dict], profiles: dict) -> list[Finding]:
        by_supplier = defaultdict(list)
        for r in rows:
            key = invoice_key(r.get('invoice_number', ''))
            if key:
                inv = {'r': r, 'key': key, 'base': suffix_base(r.get('invoice_number', '')),
                       'amount': parse_amount(r.get('total_amount'))}
                by_supplier[supplier_key(r)].append(inv)

        findings, seen = [], set()
        for supplier, invoices in by_supplier.items():
            routines = profiles[supplier].routines if supplier in profiles else {}
            by_key, by_sig = defaultdict(list), defaultdict(list)
            for inv in invoices:
                by_key[inv['key']].append(inv)
                by_sig[''.join(sorted(inv['key']))].append(inv)

            for a in invoices:
                candidates = [(b, 'same') for b in by_key[a['key']]]
                if a['base']:
                    candidates += [(b, 'suffix') for b in by_key.get(a['base'], [])]
                candidates += [(b, 'swap') for b in by_sig[''.join(sorted(a['key']))] if is_adjacent_swap(a['key'], b['key'])]

                for b, match in candidates:
                    if a is b or a['amount'] is None or b['amount'] is None or a['amount'] <= 0:
                        continue
                    pair = tuple(sorted((a['r']['_id'], b['r']['_id'])))
                    if pair in seen:
                        continue
                    same_amount = a['amount'] == b['amount']
                    near_amount = abs(a['amount'] - b['amount']) <= max(1000, 0.01 * max(a['amount'], b['amount']))
                    if not (near_amount if match == 'same' else same_amount):
                        continue
                    da, db = day_number(a['r'].get('invoice_date')), day_number(b['r'].get('invoice_date'))
                    days = abs(da - db) if da is not None and db is not None else None
                    if match != 'same' and (days is None or days > DUPLICATE_DAYS):
                        continue
                    routine = routines.get(a['amount']) if same_amount else None
                    if match != 'same' and routine and days >= routine.gap_days / 2:
                        continue  # as far apart as this supplier usually bills this amount
                    seen.add(pair)
                    findings.append(self._finding(a, b, match, same_amount, days, routine))
        return findings

    def _finding(self, a, b, match, same_amount, days, routine) -> Finding:
        first, second = (a, b) if a['r']['_id'] < b['r']['_id'] else (b, a)
        r1, r2 = first['r'], second['r']
        return Finding(
            detector=self.id,
            entity=f"{r1['invoice_number']} / {r2['invoice_number']}",
            risk=(95 if same_amount else 86) if match == 'same' else 88,
            confidence=95 if match == 'same' else 85,
            exposure=second['amount'],
            supplier_id=or_none(r1.get('supplier_id')),
            supplier_name=supplier_label(r1),
            warehouse=or_none(r2.get('warehouse_code')),
            facts={
                'match': match,
                'supplier': supplier_label(r1),
                'invoice_numbers': [r1['invoice_number'], r2['invoice_number']],
                'amounts_rials': [first['amount'], second['amount']],
                'same_amount': same_amount,
                'days_apart': days,
                'routine_invoices': routine.count if routine else 0,
                'routine_gap_days': routine.gap_days if routine else None,
            },
            features={
                'amount': second['amount'],
                'amount_gap_ratio': abs(first['amount'] - second['amount']) / max(first['amount'], second['amount']),
                'days_apart': days,
                'match_same': int(match == 'same'),
                'match_suffix': int(match == 'suffix'),
                'match_swap': int(match == 'swap'),
                'routine_invoices': routine.count if routine else 0,
                'days_vs_routine_gap': days / routine.gap_days if routine and days is not None and routine.gap_days else None,
            },
            steps=[
                Step(r1['_id'], 'first', False, first['amount']),
                Step(r2['_id'], 'repeat', True, second['amount']),
            ],
            records=[r1['_id'], r2['_id']],
        )
