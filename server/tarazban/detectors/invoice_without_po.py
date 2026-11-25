"""An invoice with no purchase order: it bypassed requisition, order and receiving.

Some payees never go through purchasing at all (payroll, utilities, insurance, recurring rent),
while a shell or uncontracted vendor might also bill regularly without a PO. When a supplier has no
purchase order anywhere in the company's data and bills regularly across enough days, emit a single
supplier-level summary alert instead of flooding the auditor with one alert per invoice, while
keeping per-invoice alerts for one-off or burst no-PO invoices and any PO-based supplier that
suddenly submits an invoice without a PO."""

from collections import defaultdict

from ..text import day_number, parse_amount
from . import Finding, Step, or_none, supplier_key, supplier_label

REGULAR_DAYS_MIN = 3  # billed on at least this many distinct dates with no PO anywhere
REGULAR_SPAN_DAYS = 14  # spread over at least two weeks so a multi-day burst is still caught


class InvoiceWithoutPo:
    id = 'P0_3WAY_MATCH'
    title = 'مغایرت سه‌جانبه سفارش، رسید و فاکتور'
    version = '1.3.0'
    kind = 'invoice'

    def run(self, rows: list[dict], profiles: dict) -> list[Finding]:
        has_po: set[str] = set()
        no_po_by_supplier: dict[str, list[tuple[int | None, float, dict]]] = defaultdict(list)
        for r in rows:
            supplier = supplier_key(r)
            if (r.get('po_id') or '').strip():
                has_po.add(supplier)
                continue
            # only rows from files that have a purchase-order column at all
            if 'po_id' not in r:
                continue
            amount = parse_amount(r.get('total_amount'))
            if amount is None or amount <= 0:
                continue
            no_po_by_supplier[supplier].append((day_number(r.get('invoice_date')), amount, r))

        findings = []
        for supplier, items in no_po_by_supplier.items():
            dated = sorted((item for item in items if item[0] is not None), key=lambda x: (x[0], x[2]['_id']))
            distinct_days = {d for d, _, _ in dated}
            span_days = (dated[-1][0] - dated[0][0]) if dated else 0
            if supplier not in has_po and len(distinct_days) >= REGULAR_DAYS_MIN and span_days >= REGULAR_SPAN_DAYS:
                findings.append(self._supplier_summary(items, dated, len(distinct_days), span_days))
                continue
            for _, amount, r in items:
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

    def _supplier_summary(self, items: list[tuple[int | None, float, dict]], dated: list[tuple[int | None, float, dict]],
                          distinct_days: int, span_days: int) -> Finding:
        first_day, first_amount, first = dated[0]
        last_day, last_amount, last = dated[-1]
        total = sum(amount for _, amount, _ in items)
        name = supplier_label(first)
        steps = [Step(first['_id'], 'no_po_first', True, first_amount)]
        if last['_id'] != first['_id']:
            steps.append(Step(last['_id'], 'no_po_last', True, last_amount))
        return Finding(
            detector=self.id,
            entity=or_none(first.get('supplier_id')) or name,
            risk=70,
            confidence=75,
            exposure=total,
            supplier_id=or_none(first.get('supplier_id')),
            supplier_name=name,
            warehouse=or_none(first.get('warehouse_code')),
            facts={
                'supplier_summary': True,
                'supplier': name,
                'invoice_count': len(items),
                'total_amount_rials': total,
                'first_date': first.get('invoice_date') or '',
                'last_date': last.get('invoice_date') or '',
                'distinct_days': distinct_days,
                'span_days': span_days,
            },
            features={
                'amount': total,
                'invoice_count': len(items),
                'span_days': span_days,
                'supplier_summary': 1,
            },
            steps=steps,
            records=[r['_id'] for _, _, r in items],
        )
