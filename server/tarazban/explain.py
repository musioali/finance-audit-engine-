"""
Words for findings. Detectors return facts only; this module turns facts into the sentences an
auditor reads. A language model can later take this module's place and write from the same facts,
which keeps every number it states tied to a row of data.
"""
from .detectors import supplier_label
from .features import YEAR_END_DAYS
from .text import fa, fa1, fa_date, show_date


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

    if detector == 'P0_UNUSUAL_PATTERN':
        reasons = f['reasons']
        return (
            f'ترکیب نادر در فاکتور {f["invoice_number"]} از {f["supplier"]}: {"، ".join(_short(r) for r in reasons)}.',
            [f'مبلغ {fa(f["amount_rials"])} ریال، تاریخ {fa_date(f["invoice_date"])}، در {where[0]}.']
            + [_long(r, f) for r in reasons]
            + [f'هیچ قاعدهٔ ثابتی این فاکتور را نگرفته است. مدل از همهٔ {fa(f["company_invoices"])} فاکتور شرکت '
               'یاد گرفته که این ترکیب نادر است. نادر بودن به معنی نادرست بودن نیست؛ تصمیم حسابرس به مدل یاد می‌دهد '
               'کدام نادرها مهم‌اند.'],
        )

    return 'یافتهٔ تازه', []


# Names of the detectors' features, for saying what a model learned from the decisions.
FEATURE_FA = {
    'amount': 'مبلغ', 'amount_gap_ratio': 'فاصلهٔ دو مبلغ', 'days_apart': 'فاصلهٔ تاریخ دو فاکتور',
    'days_vs_routine_gap': 'فاصله نسبت به فاصلهٔ همیشگی', 'match_same': 'شمارهٔ یکسان', 'match_suffix': 'پسوند در شماره',
    'match_swap': 'جابه‌جایی رقم در شماره', 'routine_invoices': 'تکرار مبلغ همیشگی',
    'avg_share_of_limit': 'نزدیکی به سقف تأیید', 'one_item': 'یک کالا بودن سفارش‌ها', 'parts': 'تعداد سفارش‌ها',
    'span_days': 'بازهٔ روزهای سفارش', 'total_over_limit': 'جمع سفارش‌ها نسبت به سقف', 'jump': 'اندازهٔ جهش قیمت',
    'previous_purchases': 'تعداد خریدهای قبلی', 'unit_price': 'قیمت واحد', 'times_usual': 'چند برابر مبلغ معمول',
    'robust_z': 'فاصله از پراکندگی معمول', 'log_spread': 'پرنوسانی مبلغ‌های تأمین‌کننده',
    'previous_invoices': 'تعداد فاکتورهای قبلی', 'amount_size': 'اندازهٔ مبلغ', 'rounder': 'رُندتر بودن از معمول',
    'supplier_age': 'سابقهٔ تأمین‌کننده', 'gap_vs_usual': 'سکوت پیش از فاکتور', 'same_day': 'فاکتورهای همان روز',
    'friday': 'تاریخ جمعه', 'year_end': 'روزهای آخر سال', 'isolation_score': 'میزان نادر بودن',
}


def basis_words(title: str, b: dict, confidence: float) -> tuple[str, list[str]]:
    """Where an alert's confidence comes from: a short label, and lines for the reasons once decisions exist."""
    n, c = b['reviewed'], b['confirmed']
    if b['source'] == 'built_in':
        return 'از قدرت نشانه؛ هنوز بی تصمیم', []
    if b['source'] == 'model':
        lines = [f'یادگیری از تصمیم‌ها: مدلی که از {fa(n)} تصمیم روی هشدارهای «{title}» یاد گرفته ({fa(c)} تأیید)، '
                 f'احتمال تأیید این هشدار را {fa1(confidence)}٪ می‌داند.']
        effects = [f'{FEATURE_FA.get(x["feature"], x["feature"])} در این هشدار {"بیشتر" if x["higher"] else "کمتر"} از '
                   f'هشدارهای بررسی‌شده است و احتمال را {"بالا برده" if x["raises"] else "پایین آورده"}'
                   for x in b['factors']]
        if effects:
            lines.append('بیشترین اثر: ' + '؛ '.join(effects) + '.')
        short = f'مدل، از {fa(n)} تصمیم قبلی'
    else:
        outcome = 'هیچ‌کدام تأیید نشد' if c == 0 else 'همه تأیید شد' if c == n else f'{fa(c)} تأیید شد'
        lines = [f'یادگیری از تصمیم‌ها: از {fa(n)} هشدار «{title}» که حسابرس‌ها بررسی کرده‌اند، {outcome}.']
        short = f'از {fa(n)} تصمیم قبلی'
    sn, sc = b.get('supplier_reviewed', 0), b.get('supplier_confirmed', 0)
    if sn:
        lines.append(
            f'برای همین تأمین‌کننده، هر {fa(sn)} هشدار این نوع نادرست دانسته شده است.' if sc == 0
            else f'برای همین تأمین‌کننده، هر {fa(sn)} هشدار این نوع تأیید شده است.' if sc == sn
            else f'برای همین تأمین‌کننده، از {fa(sn)} هشدار این نوع {fa(sc)} تأیید شده است.'
        )
    return short, lines


def _pct(r: dict) -> str:
    """How many of the company's invoices are as extreme: «فقط ۲٫۶٪» or «کمتر از ۰٫۱٪»."""
    p = r['share_pct']
    return 'کمتر از ۰٫۱٪' if p < 0.1 else f'فقط {fa1(p)}٪'


def _short(r: dict) -> str:
    """A few words for one rare number of an invoice, for the summary line."""
    name = r['feature']
    if name == 'times_usual':
        return f'{fa1(r["times"])} برابر مبلغ معمول'
    if name == 'same_day':
        return f'{fa(r["count"])} فاکتور در یک روز'
    return {
        'amount_size': 'مبلغ بسیار بزرگ',
        'rounder': 'مبلغ رُندتر از معمول',
        'supplier_age': 'تأمین‌کنندهٔ تازه',
        'gap_vs_usual': 'بعد از سکوتی طولانی',
        'friday': 'تاریخ جمعه',
        'year_end': 'روزهای آخر سال',
    }.get(name, name)


def _long(r: dict, f: dict) -> str:
    """One sentence for one rare number, with how many of the company's invoices are as extreme."""
    name, pct = r['feature'], _pct(r)
    if name == 'times_usual':
        return (f'مبلغ {fa1(r["times"])} برابر میانهٔ فاکتورهای قبلی همین تأمین‌کننده ({fa(r["usual_rials"])} ریال) است؛ '
                f'{pct} فاکتورهای شرکت چنین فاصله‌ای با مبلغ معمولشان دارند.')
    if name == 'amount_size':
        return f'{pct} فاکتورهای شرکت این‌قدر بزرگ‌اند.'
    if name == 'rounder':
        whose = 'مبلغ‌های این تأمین‌کننده' if r['own_habit'] else 'مبلغ فاکتورهای شرکت'
        return (f'مبلغ فقط {fa(r["digits"])} رقم غیرصفر دارد، در حالی که {whose} معمولاً '
                f'{fa(r["usual_digits"])} رقم غیرصفر دارند؛ {pct} فاکتورها این‌قدر رُندتر از معمول‌اند.')
    if name == 'supplier_age':
        if r['days'] == 0:
            return f'این اولین روزی است که این تأمین‌کننده فاکتور دارد؛ {pct} فاکتورها از تأمین‌کننده‌ای این‌قدر تازه‌اند.'
        return f'اولین فاکتور این تأمین‌کننده {fa(r["days"])} روز پیش از این فاکتور بوده است؛ {pct} فاکتورها از تأمین‌کننده‌ای این‌قدر تازه‌اند.'
    if name == 'gap_vs_usual':
        return (f'این فاکتور بعد از {fa(r["gap_days"])} روز بی‌فاکتوری آمده، در حالی که فاصلهٔ معمول این تأمین‌کننده '
                f'{fa(r["usual_gap_days"])} روز است.')
    if name == 'same_day':
        return (f'{fa(r["count"])} فاکتور از این تأمین‌کننده با تاریخ همین روز ثبت شده است؛ '
                f'در روزهای پرکار معمولاً {fa(r["busy_day"])} فاکتور دارد.')
    if name == 'friday':
        return f'تاریخ فاکتور جمعه است؛ {pct} فاکتورهای شرکت جمعه صادر شده‌اند.'
    if name == 'year_end':
        return f'تاریخ فاکتور در {fa(YEAR_END_DAYS)} روز آخر سال است؛ {pct} فاکتورهای شرکت در این روزها صادر شده‌اند.'
    return name


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
    if role == 'pattern':
        return 'فاکتور با ترکیب نادر', '، '.join(_short(r) for r in facts['reasons']), None
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
