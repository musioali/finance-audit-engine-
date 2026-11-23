"""
Words for findings. Detectors return facts only; this module turns facts into the sentences an
auditor reads. A language model can later take this module's place and write from the same facts,
which keeps every number it states tied to a row of data.
"""
from .detectors import supplier_label
from .text import fa, fa1, show_date


def _how_duplicate(f: dict) -> str:
    if f['match'] == 'suffix':
        return 'شمارهٔ دوم همان شمارهٔ اول است با یک پسوند اضافه'
    if f['match'] == 'swap':
        return 'دو رقم کنار هم در شمارهٔ فاکتور جابه‌جا شده‌اند'
    if not f['same_amount']:
        return 'شمارهٔ فاکتور یکی است ولی مبلغ کمی فرق دارد'
    a, b = f['invoice_numbers']
    return 'شمارهٔ فاکتور دقیقاً یکی است' if a.strip() == b.strip() else 'شمارهٔ فاکتور یکی است و فقط شکل نوشتنش فرق دارد'


def describe(detector: str, f: dict, where: list[str]) -> tuple[str, list[str]]:
    """The summary line and the reasons, from a finding's facts. `where` names each step's file and row."""
    if detector == 'P0_DUPLICATE_INVOICE':
        how = _how_duplicate(f)
        n1, n2 = f['invoice_numbers']
        a1, a2 = f['amounts_rials']
        why = [
            f'{how}: «{n1}» در {where[0]} و «{n2}» در {where[1]}.',
            f'مبلغ هر دو {fa(a1)} ریال است.' if f['same_amount'] else f'مبلغ‌ها {fa(a1)} و {fa(a2)} ریال است.',
        ]
        if f['days_apart'] is not None:
            why.append('هر دو در یک روز ثبت شده‌اند.' if f['days_apart'] == 0 else f'تاریخ دو فاکتور {fa(f["days_apart"])} روز فاصله دارد.')
        if f.get('routine_invoices'):
            why.append(f'این تأمین‌کننده همین مبلغ را {fa(f["routine_invoices"])} بار فاکتور کرده است، '
                       f'معمولاً با فاصلهٔ {fa(f["routine_gap_days"])} روز.')
        return f'احتمال ثبت دوبارهٔ فاکتور {n1} برای {f["supplier"]}: {how}.', why

    if detector == 'P0_3WAY_MATCH':
        return (
            f'فاکتور {f["invoice_number"]} به مبلغ {fa(f["amount_rials"])} ریال شمارهٔ سفارش خرید ندارد.',
            [
                f'ستون شمارهٔ سفارش خرید در {where[0]} خالی است.',
                'فاکتوری که به سفارش خرید وصل نیست، از تطبیق سفارش، رسید انبار و فاکتور رد شده است.',
            ],
        )

    if detector == 'P0_SPLIT_PO':
        limit, approver = f['approval_limit_rials'], f['approver']
        orders = '، '.join(f'{p} ({fa(a)} ریال)' for p, a in zip(f['po_ids'], f['amounts_rials']))
        return (
            f'{fa(len(f["po_ids"]))} سفارش برای {f["supplier"]} در {fa(f["span_days"] + 1)} روز، '
            f'هر کدام زیر سقف {fa(limit)} ریالِ {approver}، با جمع {fa(f["combined_amount_rials"])} ریال.',
            [
                f'سقف تأیید {approver} طبق دادهٔ دریافتی {fa(limit)} ریال است.',
                f'سفارش‌ها: {orders}.',
                f'میانگین هر سفارش {fa(f["avg_share_of_limit"] * 100)}٪ سقف است'
                + (' و همه برای یک کالا هستند.' if f['one_item'] else '.'),
            ],
        )

    if detector == 'P0_PRICE_DEVIATION':
        n = fa(f['previous_purchases'])
        return (
            f'قیمت واحد {f["item_code"]} در سفارش {f["po_id"]} {fa(f["jump_pct"])}٪ بالاتر از میانهٔ {n} خرید قبلی همین کالاست.',
            [
                f'قیمت واحد این سفارش {fa(f["unit_price_rials"])} ریال است.',
                f'میانهٔ {n} خرید قبلی همین کالا {fa(f["recent_median_rials"])} ریال است.',
            ],
        )

    if detector == 'P0_AMOUNT_OUTLIER':
        n = fa(f['previous_invoices'])
        return (
            f'فاکتور {f["invoice_number"]} از {f["supplier"]} {fa1(f["times_usual"])} برابر مبلغ معمول این تأمین‌کننده است.',
            [
                f'مبلغ این فاکتور {fa(f["amount_rials"])} ریال است، در {where[0]}.',
                f'میانهٔ {n} فاکتور قبلی همین تأمین‌کننده {fa(f["usual_median_rials"])} ریال است '
                f'و بزرگ‌ترینشان {fa(f["previous_max_rials"])} ریال بوده است.',
                'مبلغ معمول از سابقهٔ خود این تأمین‌کننده یاد گرفته شده است، نه از یک سقف ثابت.',
            ],
        )

    return 'یافتهٔ تازه', []


def _step_words(detector: str, step: dict, rec: dict, facts: dict) -> tuple[str, str, str | None]:
    """Label, detail line and (when not the supplier) the party, for one document in the chain."""
    role = step['role']
    if role in ('first', 'repeat', 'no_po'):
        label = {'first': 'فاکتور اول', 'repeat': 'فاکتور مشکوک به تکرار', 'no_po': 'فاکتور بدون سفارش خرید'}[role]
        return label, f'شمارهٔ فاکتور در فایل: {rec.get("invoice_number", "")}', None
    if role == 'part':
        return 'سفارش خرید', f'{fa(step["facts"]["share_of_limit"] * 100)}٪ سقف تأیید', f'تأیید: {facts["approver"]}'
    if role == 'outlier':
        s = step['facts']
        return 'فاکتور با مبلغ غیرعادی', f'{fa1(s["times_usual"])} برابر میانهٔ فاکتورهای قبلی ({fa(s["usual"])} ریال)', None
    if role == 'price':
        s = step['facts']
        return 'سفارش خرید با قیمت بالاتر', f'قیمت واحد {fa(s["unit_price"])} ریال، میانهٔ قبلی {fa(s["median"])} ریال', None
    return role, '', None


def where(rec: dict) -> str:
    return f'{rec["_file"]}، سطر {fa(rec["_row"])}'


def chain(detector: str, steps: list[dict], records: dict[int, dict], facts: dict) -> list[dict]:
    out = []
    for step in steps:
        rec = records[step['record']]
        label, details, party = _step_words(detector, step, rec, facts)
        invoice = rec['_kind'] == 'invoice'
        if invoice:
            record_id = rec.get('invoice_id') or rec.get('invoice_number') or f'سطر {rec["_row"]}'
        else:
            record_id = step['facts'].get('po_id') or rec.get('po_id') or f'سطر {rec["_row"]}'
        out.append({
            'stage': 'INVOICE' if invoice else 'PO',
            'stage_label_fa': label,
            'record_id': record_id,
            'date_str': show_date(rec.get('invoice_date' if invoice else 'po_date')),
            'amount_rials': step['amount'],
            'actor_or_party': party or supplier_label(rec),
            'details_fa': details,
            'is_anomalous': step['anomalous'],
            'source_file': rec['_file'],
            'source_row_id': rec['_row'],
        })
    return out
