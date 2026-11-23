"""Reading Iranian ERP exports: digits, Arabic letters, amounts, Jalali dates and CSV text."""
import csv
import io
import re
from datetime import date
from functools import lru_cache

_DIGITS = str.maketrans('۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩', '01234567890123456789')
_FA_DIGITS = str.maketrans('0123456789,', '۰۱۲۳۴۵۶۷۸۹٬')


def std_digits(s: str) -> str:
    return s.translate(_DIGITS)


def norm_text(value) -> str:
    """One way of writing Persian: Latin digits, Persian ی and ک, single spaces."""
    if value is None:
        return ''
    s = std_digits(str(value)).replace('ي', 'ی').replace('ك', 'ک').replace('‌', ' ')
    return re.sub(r'\s+', ' ', s).strip()


def fa(n) -> str:
    """A number the way the app shows it: rounded, Persian digits, ٬ between thousands."""
    return f'{round(n):,}'.translate(_FA_DIGITS)


def fa1(n) -> str:
    """A ratio with one decimal, the way the app shows it: ۸٫۳, or ۱۲ when it is whole."""
    whole, _, tenth = f'{n:,.1f}'.partition('.')
    return (whole if tenth == '0' else f'{whole}٫{tenth}').translate(_FA_DIGITS)


def parse_amount(raw):
    """
    Amounts as Iranian files write them: Persian or Arabic digits, thousands separators (, ٬ ،),
    Sepidar's "/" or the Arabic "٫" as decimal mark, and negatives as (…) or a trailing minus.
    Returns None when the text is not a number, so a bad cell is reported instead of read as zero.
    """
    if raw is None:
        return None
    s = re.sub(r'[\s‌‎‏]', '', std_digits(str(raw)))
    if not s:
        return None
    negative = False
    if s.startswith('(') and s.endswith(')'):
        negative, s = True, s[1:-1]
    if s.startswith('-') or s.endswith('-'):
        negative, s = True, s.strip('-')
    s = re.sub(r"[,٬،'’]", '', s)
    s = re.sub(r'[/٫]', '.', s)
    if s.count('.') > 1:
        s = s.replace('.', '')
    if not re.fullmatch(r'\d+(\.\d+)?', s):
        return None
    n = float(s) if '.' in s else int(s)
    if isinstance(n, float) and n.is_integer():
        n = int(n)
    return -n if negative else n


def _jalali_days(y: int, m: int, d: int) -> int:
    leaps = ((y - 1) * 8 + 29) // 33
    return (y - 1) * 365 + leaps + ((m - 1) * 31 if m <= 6 else 186 + (m - 7) * 30) + d


_EPOCH = date(1970, 1, 1)
_GREGORIAN_SHIFT = _jalali_days(1404, 1, 1) - (date(2025, 3, 21) - _EPOCH).days
_DATE = re.compile(r'^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})')


@lru_cache(maxsize=8192)  # a file has a few hundred distinct dates over many thousand rows
def day_number(raw):
    """A day count for a Jalali (1404/03/01) or Gregorian (2025-05-22) date, or None if it is not a date."""
    if not raw:
        return None
    m = _DATE.match(std_digits(str(raw)).strip())
    if not m:
        return None
    y, mo, d = (int(g) for g in m.groups())
    if not (1 <= mo <= 12 and 1 <= d <= 31):
        return None
    if y > 1900:
        try:
            return (date(y, mo, d) - _EPOCH).days + _GREGORIAN_SHIFT
        except ValueError:
            return None
    if not 1300 <= y <= 1500:
        return None
    return _jalali_days(y, mo, d)


def show_date(raw) -> str:
    m = _DATE.match(std_digits(str(raw or '')).strip())
    return f'{m[1]}/{int(m[2]):02d}/{int(m[3]):02d}' if m else 'بی‌تاریخ'


def decode(data: bytes) -> str:
    """UTF-8 (with or without BOM), else Windows-1256, which older Persian Excel exports still use."""
    try:
        return data.decode('utf-8-sig')
    except UnicodeDecodeError:
        return data.decode('cp1256', errors='replace')


def read_csv(text: str) -> list[tuple[int, list[str]]]:
    """
    Rows of a CSV file with the line each row starts on (the header is line 1).
    Quoted fields, doubled quotes and line breaks inside quotes are kept; , ; or tab is detected
    from the header line; blank rows are skipped.
    """
    text = text.lstrip('﻿')
    head = text.split('\n', 1)[0]
    delimiter = max([',', ';', '\t'], key=lambda d: (head.count(d), d == ','))
    reader = csv.reader(io.StringIO(text, newline=''), delimiter=delimiter)
    rows = []
    line = 1
    for cells in reader:
        if any(c.strip() for c in cells):
            rows.append((line, cells))
        line = reader.line_num + 1
    return rows
