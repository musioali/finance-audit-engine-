"""An invoice with no purchase order, so it skipped the match of order, goods receipt and invoice."""
from ..text import parse_amount
from . import Finding, Step, or_none, supplier_label


class InvoiceWithoutPo:
    id = 'P0_3WAY_MATCH'
    title = 'مغایرت سه‌جانبه سفارش، رسید و فاکتور'
    version = '1.2.0'
    kind = 'invoice'

    def run(self, rows: list[dict], profiles: dict) -> list[Finding]:
        findings = []
        for r in rows:
            # only rows from files that have a purchase-order column at all
            if 'po_id' not in r or r['po_id'].strip():
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
