"""A unit price far above the median of the same item's recent purchases (same unit), across every file received."""
from collections import defaultdict

from ..text import day_number, norm_text, parse_amount
from . import Finding, Step, or_none, supplier_label

PRICE_JUMP = 1.45  # flag a price more than 45% above the recent median
PRICE_HISTORY_MIN = 3
PRICE_HISTORY_MAX = 6


class PriceJump:
    id = 'P0_PRICE_DEVIATION'
    title = 'انحراف غیرعادی قیمت خرید کالا'
    version = '1.2.0'
    kind = 'po_line'

    def run(self, rows: list[dict], profiles: dict) -> list[Finding]:
        by_item = defaultdict(list)
        for r in rows:
            price = parse_amount(r.get('unit_price'))
            item = norm_text(r.get('item_code')).upper()
            if not item or price is None or price <= 0:
                continue
            by_item[(item, norm_text(r.get('unit')))].append((r, price, day_number(r.get('po_date'))))

        findings = []
        for lines in by_item.values():
            lines.sort(key=lambda x: (x[2] if x[2] is not None else float('inf'), x[0]['_id']))
            for k in range(PRICE_HISTORY_MIN, len(lines)):
                recent = sorted(p for _, p, _ in lines[max(0, k - PRICE_HISTORY_MAX):k])
                mid = len(recent) // 2
                median = recent[mid] if len(recent) % 2 else (recent[mid - 1] + recent[mid]) / 2
                r, price, _ = lines[k]
                if price <= median * PRICE_JUMP:
                    continue
                jump = price / median - 1
                amount = parse_amount(r.get('line_amount')) or price
                findings.append(Finding(
                    detector=self.id,
                    entity=r.get('po_id') or f"سطر {r['_row']}",
                    risk=55 + 50 * jump,
                    confidence=70 + 5 * min(len(recent), 5),
                    exposure=amount,
                    supplier_id=or_none(r.get('supplier_id')),
                    supplier_name=supplier_label(r),
                    warehouse=or_none(r.get('warehouse_code')),
                    facts={
                        'item_code': r.get('item_code'),
                        'po_id': r.get('po_id') or f"سطر {r['_row']}",
                        'unit_price_rials': price,
                        'recent_median_rials': median,
                        'previous_purchases': len(recent),
                        'jump_pct': round(jump * 100, 1),
                    },
                    features={'jump': jump, 'previous_purchases': len(recent), 'amount': amount},
                    steps=[Step(r['_id'], 'price', True, amount, {'unit_price': price, 'median': median})],
                    records=[r['_id']],
                ))
        return findings
