"""
Real engine output for the public demo, which has no server behind it.

The demo build (.github/workflows/pages.yml) runs this on made-up invoices and ships the result as
demo-alerts.json. So the alerts the demo marks «ساختهٔ موتور» are what this engine finds, word for word,
and change whenever the engine does. Two of the made-up decisions come from an imagined auditor, to
show what the engine learns from decisions.

Run from server/:  python -m tarazban.demo ../public/demo-alerts.json
"""
import json
import math
import random
import sys
from pathlib import Path

from . import pipeline
from .store import connect
from .text import _jalali_days, weekday

HEAD = 'invoice_id,invoice_number,po_id,supplier_id,supplier_name,invoice_date,total_amount,warehouse_code'
NAMES = ['پخش البرز', 'چاپ نقش', 'حمل‌ونقل پارسه', 'لبنیات دشت', 'کارتن‌سازی ایران', 'روغن نوین', 'شیشهٔ آفتاب', 'نخ و پارچهٔ یزد']
WAREHOUSES = ['WH-TEH-01', 'WH-TEH-02', 'WH-ISF-01', 'WH-MSH-01', 'WH-SHZ-01']
START = _jalali_days(1404, 7, 1)
LABEL = {}
for m in range(7, 13):
    for d in range(1, 31):
        LABEL[_jalali_days(1404, m, d) - START] = f'1404/{m:02d}/{d:02d}'
REVIEWER = 'حسابرس ارشد - م. رضایی'


def business_day(day: int) -> int:
    return day - 1 if weekday(START + day) == 6 else day  # nobody here bills on a Friday


def invoices() -> list[str]:
    rng = random.Random(1404)
    rows, n = [HEAD], 0

    def add(supplier, name, day, amount, number=None, wh=None):
        nonlocal n
        n += 1
        rows.append(f'INV-{n:05d},{number or f"{supplier}-{1000 + n}"},PO-{n:05d},{supplier},{name},'
                    f'{LABEL[day]},{int(amount)},{wh or WAREHOUSES[n % len(WAREHOUSES)]}')

    for s in range(40):  # ordinary suppliers, five months of invoices
        base = rng.uniform(20, 200) * 1_000_000
        name = f'{NAMES[s % len(NAMES)]} {s // len(NAMES) + 1}'
        for _ in range(60):
            add(f'SUP-{s:03d}', name, business_day(rng.randrange(140)), round(base * math.exp(rng.gauss(0, 0.2)), -3))
    for w in range(20):  # a weekly cleaning fee, then last week's invoice entered again a day later with two digits swapped
        add('SUP-MEHR', 'خدمات نظافت مهر', business_day(w * 7), 12_000_000, number=str(4500 + 9 * w), wh='WH-TEH-01')
    add('SUP-MEHR', 'خدمات نظافت مهر', business_day(7 * 19 + 1), 12_000_000, number='4761', wh='WH-TEH-01')
    for i in range(20):  # two steady suppliers; one sends three large invoices, the other one
        for supplier, name in (('SUP-KIAN', 'تجهیزات سرمایشی کیان'), ('SUP-ARIA', 'بسته‌بندی آریا')):
            add(supplier, name, business_day(i * 6), [44, 46, 48, 50, 52, 54, 56][i % 7] * 1_000_000, wh='WH-ISF-01')
    for k, amount in enumerate((400, 410, 420)):
        add('SUP-KIAN', 'تجهیزات سرمایشی کیان', business_day(122 + k * 4), amount * 1_000_000, wh='WH-ISF-01')
    add('SUP-ARIA', 'بسته‌بندی آریا', business_day(131), 430_000_000, wh='WH-ISF-01')
    add('SUP-NOPA', 'بازرگانی نوپا', business_day(136), 9_000_000_000, wh='WH-TEH-02')  # a new supplier's first invoice
    return rows


def build() -> dict:
    conn = connect(':memory:')
    pipeline.receive(conn, 'invoices-1404.csv', '\n'.join(invoices()).encode())
    # the imagined auditor rejects Kian's first two large invoices: an annual maintenance contract
    kian = sorted((a for a in pipeline.state(conn)['alerts']
                   if a['rule_id'] == 'P0_AMOUNT_OUTLIER' and a['supplier_id'] == 'SUP-KIAN'),
                  key=lambda a: a['evidence']['invoice_number'])
    for a in kian[:2]:
        pipeline.decide(conn, a['alert_id'], 'FALSE_POSITIVE', REVIEWER, 'قرارداد سالانهٔ نگهداری است؛ فاکتورهای بزرگ آن معمول است.')
    state = pipeline.state(conn)
    for a in state['alerts']:
        a['source_fa'] = 'ساختهٔ موتور'
    return {'alerts': state['alerts'], 'audit_logs': state['audit_logs']}


if __name__ == '__main__':
    out = build()
    path = Path(sys.argv[1])
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(out, ensure_ascii=False), encoding='utf-8')
    print(len(out['alerts']), 'alerts:', ', '.join(sorted({a['rule_id'] for a in out['alerts']})))
