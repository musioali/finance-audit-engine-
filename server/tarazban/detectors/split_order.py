"""Orders split to stay under an approver's limit: same supplier and approver, within days, each under the limit, together over it."""
from collections import defaultdict

from ..text import day_number, norm_text, parse_amount
from . import Finding, Step, or_none, supplier_key, supplier_label

SPLIT_WINDOW_DAYS = 3


class SplitOrder:
    id = 'P0_SPLIT_PO'
    title = 'شکستن سفارش زیر سقف تأیید'
    version = '1.2.0'
    kind = 'po_line'

    def run(self, rows: list[dict]) -> list[Finding]:
        # one entry per purchase order, summed over its lines
        orders = {}
        for r in rows:
            po_id = r.get('po_id', '').strip() or f"سطر {r['_row']}"
            po = orders.setdefault(po_id, {
                'id': po_id, 'first': r, 'rows': [], 'amount': 0, 'items': set(),
                'limit': parse_amount(r.get('approval_limit_rials')), 'day': day_number(r.get('po_date')),
            })
            po['rows'].append(r)
            po['amount'] += parse_amount(r.get('line_amount')) or 0
            if r.get('item_code'):
                po['items'].add(norm_text(r['item_code']).upper())

        groups = defaultdict(list)
        for po in orders.values():
            approver = norm_text(po['first'].get('approved_by'))
            if po['day'] is None or not po['limit'] or po['limit'] <= 0 or po['amount'] <= 0 or not approver:
                continue
            groups[(supplier_key(po['first']), approver.upper())].append(po)

        findings = []
        for pos in groups.values():
            pos.sort(key=lambda p: p['day'])
            i = 0
            while i < len(pos):
                j = i
                while j + 1 < len(pos) and pos[j + 1]['day'] - pos[i]['day'] <= SPLIT_WINDOW_DAYS:
                    j += 1
                window = pos[i:j + 1]
                limit = min(p['limit'] for p in window)
                parts = [p for p in window if p['amount'] < limit]
                total = sum(p['amount'] for p in parts)
                if len(parts) >= 2 and total > limit:
                    findings.append(self._finding(parts, limit, total))
                    i = j + 1
                else:
                    i += 1
        return findings

    def _finding(self, parts, limit, total) -> Finding:
        closeness = sum(p['amount'] / limit for p in parts) / len(parts)
        one_item = len(set().union(*(p['items'] for p in parts))) == 1
        first = parts[0]['first']
        span = parts[-1]['day'] - parts[0]['day']
        return Finding(
            detector=self.id,
            entity=' / '.join(p['id'] for p in parts),
            risk=60 + 30 * closeness + 4 * min(len(parts) - 2, 2) + (3 if one_item else 0),
            confidence=92 if one_item else 80,
            exposure=total,
            supplier_id=or_none(first.get('supplier_id')),
            supplier_name=supplier_label(first),
            warehouse=or_none(first.get('warehouse_code')),
            facts={
                'supplier': supplier_label(first),
                'approver': first.get('approved_by') or 'نامشخص',
                'po_ids': [p['id'] for p in parts],
                'amounts_rials': [p['amount'] for p in parts],
                'approval_limit_rials': limit,
                'combined_amount_rials': total,
                'span_days': span,
                'window_days': SPLIT_WINDOW_DAYS,
                'avg_share_of_limit': round(closeness, 4),
                'one_item': one_item,
            },
            features={
                'parts': len(parts),
                'avg_share_of_limit': closeness,
                'total_over_limit': total / limit,
                'span_days': span,
                'one_item': int(one_item),
                'amount': total,
            },
            steps=[Step(p['first']['_id'], 'part', True, p['amount'], {'share_of_limit': p['amount'] / limit, 'po_id': p['id']})
                   for p in parts],
            records=[r['_id'] for p in parts for r in p['rows']],
        )
