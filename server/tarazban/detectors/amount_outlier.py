"""
An invoice far larger than this supplier usually bills.

"Usually" is learned from the supplier's own earlier invoices, not a fixed ceiling: a supplier that
bills anywhere between 5 and 300 million is not flagged for 350 million, one that always bills about
40 million is flagged for 400 million. Amounts are compared on a log scale with the median and the
median absolute deviation, which a few odd invoices in the history barely move.

A supplier's routine amounts (baselines.py: a monthly fee and the like) are left out of its history
when it has enough other invoices, so a fixed fee billed half the time does not make every other
invoice look many times "usual". A supplier that bills little besides its routine amounts is measured
against them: ten times its monthly fee is still unusual.

The thresholds were set on simulated data (200,000 invoices from 500 suppliers of different spread,
with inflation): about 40 alerts with nothing planted, and two in three tenfold invoices planted on
suppliers with a narrow spread found. The auditors' decisions are what will tune them on real data.
"""
import math

from . import Finding, Step, median, or_none, supplier_label

HISTORY_MIN = 12  # with fewer earlier invoices the supplier's normal is not known yet
HISTORY_MAX = 48  # only the most recent ones, so steady inflation moves the normal along with it
OUTLIER_Z = 4.5  # robust z-score of the log amount against the earlier ones
OUTLIER_TIMES = 3.0  # and at least this many times their median, so a narrow spread does not flag small steps
MIN_SPREAD = 0.1  # a supplier who always bills the same amount still gets this much spread on the log scale


class AmountOutlier:
    id = 'P0_AMOUNT_OUTLIER'
    title = 'مبلغ غیرعادی برای این تأمین‌کننده'
    version = '1.3.0'
    kind = 'invoice'

    def run(self, rows: list[dict], profiles: dict) -> list[Finding]:
        by_id = {r['_id']: r for r in rows}
        findings = []
        for profile in profiles.values():
            if profile.placeholder:  # many unrelated buyers under one name: no "usual" amount to compare with
                continue
            others = [inv for inv in profile.invoices if inv[1] not in profile.routines]
            pool = others if len(others) >= HISTORY_MIN else profile.invoices
            seen = []
            for _, amount, record in pool:
                seen.append(amount)
                if len(seen) <= HISTORY_MIN or amount in profile.routines:
                    continue
                earlier = seen[-HISTORY_MAX - 1:-1]
                usual = median(earlier)
                if amount < OUTLIER_TIMES * usual:
                    continue
                logs = [math.log(a) for a in earlier]
                center = median(logs)
                spread = max(1.4826 * median([abs(x - center) for x in logs]), MIN_SPREAD)
                z = (math.log(amount) - center) / spread
                if z < OUTLIER_Z:
                    continue
                findings.append(self._finding(by_id[record], amount, usual, earlier, z, spread))
        return findings

    def _finding(self, r, amount, usual, earlier, z, spread) -> Finding:
        times = amount / usual
        number = r.get('invoice_number') or r.get('invoice_id') or f"سطر {r['_row']}"
        return Finding(
            detector=self.id,
            entity=r.get('invoice_id') or number,
            risk=55 + 10 * math.log2(times),
            confidence=min(90, 60 + len(earlier)),  # more history, firmer normal
            exposure=amount,
            supplier_id=or_none(r.get('supplier_id')),
            supplier_name=supplier_label(r),
            warehouse=or_none(r.get('warehouse_code')),
            facts={
                'supplier': supplier_label(r),
                'invoice_number': number,
                'amount_rials': amount,
                'usual_median_rials': usual,
                'previous_max_rials': max(earlier),
                'previous_invoices': len(earlier),
                'times_usual': round(times, 1),
            },
            features={
                'amount': amount,
                'times_usual': times,
                'robust_z': z,
                'log_spread': spread,
                'previous_invoices': len(earlier),
            },
            steps=[Step(r['_id'], 'outlier', True, amount, {'times_usual': times, 'usual': usual})],
            records=[r['_id']],
        )
