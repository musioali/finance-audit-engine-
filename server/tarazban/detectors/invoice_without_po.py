"""An invoice with no purchase order, so it skipped the match of order, goods receipt and invoice.

Some payees never go through purchasing at all (payroll, utilities, insurance, recurring rent). When a
supplier has no purchase order anywhere in the company's data and bills regularly across enough days,
skipping it avoids flooding the auditor with routine bills while keeping one-off or burst no-PO invoices
and any PO-based supplier that suddenly submits an invoice without a PO.
"""
from collections import defaultdict

from ..text import day_number, parse_amount
from . import Finding, Step, or_none, supplier_key, supplier_label

REGULAR_DAYS_MIN = 3  # billed on at least this many distinct dates with no PO anywhere
REGULAR_SPAN_DAYS = 14  # spread over at least two weeks so a multi-day burst is still caught


class InvoiceWithoutPo:
    id = 'P0_3WAY_MATCH'
    title = 'مغایرت سه‌جانبه سفارش، رسید و فاکتور'
    version = '1.2.0'
    kind = 'invoice'

    def run(self, rows: list[dict], profiles: dict) -> list[Finding]:
        has_po: set[str] = set()
        days_by_supplier: dict[str, set[int]] = defaultdict(set)
        for r in rows:
            supplier = supplier_key(r)
            if (r.get('po_id') or '').strip():
                has_po.add(supplier)
                continue
            amount = parse_amount(r.get('total_amount'))
            day = day_number(r.get('invoice_date'))
            if amount is not None and amount > 0 and day is not None:
                days_by_supplier[supplier].add(day)
        regular_no_po = {
            s for s, days in days_by_supplier.items()
            if s not in has_po and len(days) >= REGULAR_DAYS_MIN and (max(days) - min(days)) >= REGULAR_SPAN_DAYS
        }

        findings = []
        for r in rows:
            # only rows from files that have a purchase-order column at all
            if 'po_id' not in r or r['po_id'].strip():
                continue
            if supplier_key(r) in regular_no_po:
                continue
            amount = parse_amount(r.get('total_amount'))
            if amount is None or amount <= 0:
                continue
            number = r.get('invoice_number') or r.get('invoice_id') or f"سطر {r['_row']}"
            findings.append(Finding(
                detector=self.id,
                entity=r.get('invoice_id') or number,
                risk=82,
                confidence=95,
                exposure=amount,
                supplier_id=or_none(r.get('supplier_id')),
                supplier_name=supplier_label(r),
                warehouse=or_none(r.get('warehouse_code')),
                facts={'invoice_number': number, 'amount_rials': amount, 'supplier': supplier_label(r)},
                features={'amount': amount},
                steps=[Step(r['_id'], 'no_po', True, amount)],
                records=[r['_id']],
            ))
        return findings
