"""
The standard purchase-to-pay data model. Every file, whatever ERP it comes from, is mapped onto
these fields once; detectors only ever see these names.

To add a table (goods receipts, payments, suppliers), add a Kind here: mapping, storage and the
data-quality report pick it up without other changes.
"""
from dataclasses import dataclass, replace


@dataclass(frozen=True)
class Field:
    name: str
    label: str
    type: str = 'text'  # text | amount | date
    required: bool = False  # the file cannot be read without it
    aliases: tuple[str, ...] = ()  # column names seen in exports, used to suggest a mapping


@dataclass(frozen=True)
class Kind:
    name: str
    label: str
    fields: tuple[Field, ...]
    core: tuple[str, ...]  # fields whose coverage is reported as "the needed columns"

    def field(self, name: str) -> Field:
        return next(f for f in self.fields if f.name == name)


SUPPLIER_ID = Field('supplier_id', 'کد تأمین‌کننده', aliases=(
    'vendor_id', 'supplier_code', 'vendor_code', 'کد تامین کننده', 'کد طرف حساب', 'کد فروشنده', 'کد تفصیلی'))
SUPPLIER_NAME = Field('supplier_name', 'نام تأمین‌کننده', aliases=(
    'vendor_name', 'supplier', 'vendor', 'نام تامین کننده', 'تامین کننده', 'نام طرف حساب', 'طرف حساب',
    'نام فروشنده', 'فروشنده'))
WAREHOUSE = Field('warehouse_code', 'انبار', aliases=('warehouse', 'کد انبار', 'انبار'))
PO_ID = Field('po_id', 'شمارهٔ سفارش خرید', aliases=(
    'po_number', 'po_no', 'po', 'order_id', 'شماره سفارش خرید', 'شماره سفارش', 'کد سفارش'))

INVOICE = Kind(
    name='invoice',
    label='فاکتورهای خرید',
    fields=(
        Field('invoice_number', 'شمارهٔ فاکتور', required=True, aliases=(
            'invoice_no', 'inv_no', 'invoice', 'شماره فاکتور خرید', 'شماره فاکتور', 'شماره صورتحساب')),
        Field('total_amount', 'مبلغ کل فاکتور', 'amount', required=True, aliases=(
            'amount', 'total', 'invoice_amount', 'مبلغ کل', 'مبلغ فاکتور', 'جمع کل', 'مبلغ نهایی', 'مبلغ')),
        Field('invoice_date', 'تاریخ فاکتور', 'date', aliases=('date', 'تاریخ فاکتور', 'تاریخ صورتحساب', 'تاریخ')),
        SUPPLIER_ID,
        SUPPLIER_NAME,
        PO_ID,
        Field('invoice_id', 'شناسهٔ سند در نرم‌افزار', aliases=('doc_id', 'id', 'شماره سند', 'شناسه سند', 'شناسه')),
        WAREHOUSE,
    ),
    core=('invoice_number', 'supplier_id', 'invoice_date', 'total_amount', 'po_id'),
)

PO_LINE = Kind(
    name='po_line',
    label='سفارش‌های خرید',
    fields=(
        replace(PO_ID, required=True),
        Field('line_amount', 'مبلغ سطر', 'amount', required=True, aliases=(
            'amount', 'line_total', 'مبلغ سطر', 'مبلغ کل سطر', 'مبلغ')),
        Field('po_date', 'تاریخ سفارش', 'date', aliases=('order_date', 'date', 'تاریخ سفارش', 'تاریخ')),
        SUPPLIER_ID,
        SUPPLIER_NAME,
        Field('item_code', 'کد کالا', aliases=('item', 'sku', 'product_code', 'کد کالا', 'کالا')),
        Field('unit', 'واحد', aliases=('uom', 'واحد سنجش', 'واحد')),
        Field('quantity', 'مقدار', 'amount', aliases=('qty', 'مقدار', 'تعداد')),
        Field('unit_price', 'قیمت واحد', 'amount', aliases=('price', 'قیمت واحد', 'مبلغ واحد', 'فی', 'نرخ')),
        Field('approved_by', 'تأییدکننده', aliases=('approver', 'تایید کننده', 'تصویب کننده')),
        Field('approval_limit_rials', 'سقف تأیید (ریال)', 'amount', aliases=(
            'approval_limit', 'سقف تایید', 'سقف اختیار', 'سقف مجاز')),
        WAREHOUSE,
    ),
    core=('po_id', 'supplier_id', 'item_code', 'unit_price', 'line_amount', 'po_date', 'approved_by', 'approval_limit_rials'),
)

KINDS: dict[str, Kind] = {k.name: k for k in (INVOICE, PO_LINE)}
