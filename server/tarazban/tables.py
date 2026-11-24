"""
A received file as rows: CSV or Excel (.xlsx), told apart by content, not by name.

Exports from Iranian accounting software are rarely a clean table. Above the column names there is
often a report title and a date range; inside, a section label alone on its row, the column names
repeated on every printed page, and a sum row at the end. `tidy` finds the row of column names and
drops those other rows, for CSV and Excel alike. Rows keep their number in the file, so evidence
still points at the row a person sees in Excel.
"""
import io
import re
from datetime import date, datetime

from .text import decode, norm_text, read_csv

XLSX = b'PK\x03\x04'
XLS = b'\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1'
HEADER_SCAN = 30  # the column names are looked for within this many rows from the top
TOTAL = re.compile(r'^(جمع|مجموع|total|sum)( کل| نهایی| صفحه| گروه)?\s*:?$')


class Unreadable(ValueError):
    """The file cannot be read; the message is for the person."""


def read(data: bytes) -> tuple[list[tuple[int, list[str]]], str | None]:
    """Rows with their number in the file, and for a workbook the sheet they came from."""
    if data.startswith(XLSX):
        return read_xlsx(data)
    if data.startswith(XLS):
        raise Unreadable('این فایل اکسل قدیمی (.xls) است. آن را در اکسل باز کنید و با «Save As» به شکل .xlsx یا CSV ذخیره کنید.')
    text = decode(data)
    if re.match(r'\s*<', text.lstrip('﻿')) and '<table' in text[:5000].lower():
        raise Unreadable('این فایل در واقع یک صفحهٔ وب است که نرم‌افزار با پسوند اکسل ذخیره کرده. آن را در اکسل باز کنید و '
                         'با «Save As» به شکل .xlsx یا CSV ذخیره کنید.')
    return read_csv(text), None


def _cell(v) -> str:
    if v is None:
        return ''
    if isinstance(v, bool):
        return 'TRUE' if v else 'FALSE'
    if isinstance(v, (datetime, date)):  # a real Excel date is Gregorian; Jalali dates arrive as text
        return f'{v.year:04d}-{v.month:02d}-{v.day:02d}'
    if isinstance(v, float):
        return str(int(v)) if v.is_integer() else f'{v:.6f}'.rstrip('0').rstrip('.')
    return str(v).strip()


def read_xlsx(data: bytes) -> tuple[list[tuple[int, list[str]]], str | None]:
    """The sheet with the most filled rows (a workbook often has a cover or notes sheet too)."""
    from openpyxl import load_workbook  # only Excel files need it

    try:
        book = load_workbook(io.BytesIO(data), read_only=True, data_only=True)
    except Exception as e:  # a damaged file or another kind of zip
        raise Unreadable('فایل اکسل خوانده نشد. آن را در اکسل باز کنید و دوباره ذخیره کنید.') from e
    sheets = []
    try:
        for ws in book.worksheets:  # each sheet read once: a read-only sheet streams and cannot be read again
            rows = []
            for n, values in enumerate(ws.iter_rows(values_only=True), start=1):
                cells = [_cell(v) for v in values]
                while cells and not cells[-1]:
                    cells.pop()
                if cells:
                    rows.append((n, cells))
            sheets.append((ws.title, rows))
    finally:
        book.close()
    filled = [s for s in sheets if s[1]]
    if not filled:
        raise Unreadable('فایل اکسل خالی است.')
    title, rows = max(filled, key=lambda s: len(s[1]))
    return rows, (title if len(filled) > 1 else None)


def _is_text(cell: str) -> bool:
    return bool(cell) and not re.fullmatch(r'[\d\s.,/٫٬،()\-]+', norm_text(cell))


def tidy(rows: list[tuple[int, list[str]]]) -> tuple[list[str], list[tuple[int, list[str]]]]:
    """The column names, and the data rows under them without titles, section labels, repeated names and sums."""
    top = rows[:HEADER_SCAN]
    width = max((sum(1 for c in cells if c) for _, cells in top), default=0)
    header_at = 0
    for i, (_, cells) in enumerate(top):
        filled = [c for c in cells if c]
        if len(filled) >= max(2, round(0.6 * width)) and sum(_is_text(c) for c in filled) >= 0.6 * len(filled):
            header_at = i
            break
    header = rows[header_at][1] if rows else []
    names = [h.strip() for h in header]
    named = [n for n in names if n]
    data = []
    for line, cells in rows[header_at + 1:]:
        filled = [c for c in cells if c]
        if not filled:
            continue
        if len(filled) == 1 and len(names) >= 3:  # a section label, or a signature line under the table
            continue
        if [c.strip() for c in filled] == named:  # the column names again, as printed on every page
            continue
        if any(TOTAL.match(norm_text(c).lower()) for c in filled[:3]):
            continue
        data.append((line, cells))
    return names, data
