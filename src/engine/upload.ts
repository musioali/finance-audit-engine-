/**
 * Runs the checks on a CSV file the user uploads (purchase invoices or purchase order lines).
 * Everything here works on the file's own rows: no sample catalogue, no assumed limits.
 */
import { AlertPriority, ColumnQualityMetric, LinkedCycleRecord, P0RuleId, RiskAlert, TableQualityReport } from '../types';
import { EngineState, formatRials, normalizePersianText, RULE_METADATA, toStandardDigits } from './p2pEngine';

// ───────────────────────── reading ─────────────────────────

/** RFC 4180 CSV: quoted fields, doubled quotes, separators and line breaks inside quotes. Detects , ; or tab. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, '');
  const firstBreak = src.search(/\r?\n/);
  const head = firstBreak === -1 ? src : src.slice(0, firstBreak);
  const delim = [',', ';', '\t'].reduce((best, d) => (head.split(d).length > head.split(best).length ? d : best), ',');

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const endRow = () => {
    row.push(field);
    if (row.some((f) => f.trim() !== '')) rows.push(row);
    row = [];
    field = '';
  };
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"' && field.trim() === '') {
      field = '';
      quoted = true;
    } else if (c === delim) {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      endRow();
    } else field += c;
  }
  if (field !== '' || row.length) endRow();
  return rows;
}

/**
 * Amounts as Iranian files write them: Persian or Arabic digits, thousands separators (, ٬ ،),
 * Sepidar's "/" or the Arabic "٫" as decimal mark, and negatives as (…) or a trailing minus.
 * Returns null when the text is not a number, so a bad cell is reported instead of read as zero.
 */
export function parseAmount(raw: string | undefined | null): number | null {
  if (raw == null) return null;
  let s = toStandardDigits(String(raw)).replace(/[\s‌‎‏]/g, '');
  if (!s) return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (s.startsWith('-') || s.endsWith('-')) {
    negative = true;
    s = s.replace(/^-|-$/g, '');
  }
  s = s.replace(/[,٬،'’]/g, '').replace(/[/٫]/g, '.');
  if ((s.match(/\./g) || []).length > 1) s = s.replace(/\./g, '');
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return negative ? -n : n;
}

function jalaliDays(y: number, m: number, d: number) {
  const leaps = Math.floor(((y - 1) * 8 + 29) / 33);
  return (y - 1) * 365 + leaps + (m <= 6 ? (m - 1) * 31 : 186 + (m - 7) * 30) + d;
}
const GREGORIAN_SHIFT = jalaliDays(1404, 1, 1) - Math.floor(Date.UTC(2025, 2, 21) / 86_400_000);

/** A day count for a Jalali (1404/03/01) or Gregorian (2025-05-22) date, or null if it is not a date. */
export function dayNumber(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const m = toStandardDigits(String(raw)).trim().match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})/);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  if (y > 1900) return Math.floor(Date.UTC(y, mo - 1, d) / 86_400_000) + GREGORIAN_SHIFT;
  if (y < 1300 || y > 1500) return null;
  return jalaliDays(y, mo, d);
}

function showDate(raw: string | undefined) {
  const m = toStandardDigits(String(raw ?? '')).trim().match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})/);
  return m ? `${m[1]}/${m[2].padStart(2, '0')}/${m[3].padStart(2, '0')}` : 'بی‌تاریخ';
}

/** Invoice numbers compared the way a person would: no separators, no case, no leading zeros, one digit set. */
export function invoiceKey(raw: string): string {
  return toStandardDigits(raw)
    .toUpperCase()
    .replace(/[^0-9A-Z؀-ۿ]/g, '')
    .replace(/(^|[^0-9])0+(?=\d)/g, '$1');
}

/** "F-1001-A", "F-1001 B", "1001/2": the number with a short suffix added, which usually marks a re-entry. */
function suffixBase(raw: string): string | null {
  const s = toStandardDigits(raw).trim();
  const m = s.match(/^(.*?\d)[\s\-_/.]?([A-Za-z]{1,2})$/) || s.match(/^(.*\d)[\-_/.](\d{1,2})$/);
  return m ? invoiceKey(m[1]) : null;
}

function isAdjacentSwap(a: string, b: string) {
  if (a.length !== b.length || a === b) return false;
  const diff: number[] = [];
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diff.push(i);
  return diff.length === 2 && diff[1] === diff[0] + 1 && a[diff[0]] === b[diff[1]] && a[diff[1]] === b[diff[0]];
}

// ───────────────────────── alerts ─────────────────────────

type Row = Record<string, string> & { _row: string };

const DUPLICATE_DAYS = 30;

const priorityOf = (risk: number): AlertPriority => (risk >= 90 ? 'CRITICAL' : risk >= 80 ? 'HIGH' : risk >= 65 ? 'MEDIUM' : 'LOW');

function nowJalali() {
  const d = new Date();
  return `${d.toLocaleDateString('fa-IR')}، ${d.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}`;
}

class AlertBook {
  readonly batchId = `CSV-${Date.now().toString(36).toUpperCase()}`;
  readonly list: RiskAlert[] = [];
  private readonly created = nowJalali();
  private readonly fileName: string;
  constructor(fileName: string) {
    this.fileName = fileName;
  }

  add(a: {
    rule: P0RuleId;
    entity: string;
    supplierId: string | null;
    supplierName: string | null;
    warehouse: string | null;
    risk: number;
    confidence: number;
    exposure: number;
    summary: string;
    why: string[];
    evidence: Record<string, unknown>;
    chain: Array<Omit<LinkedCycleRecord, 'source_file'>>;
  }) {
    const risk = Math.round(Math.min(99, Math.max(0, a.risk)) * 10) / 10;
    this.list.push({
      alert_id: `${this.batchId}-${String(this.list.length + 1).padStart(3, '0')}`,
      batch_id: this.batchId,
      rule_id: a.rule,
      rule_title_fa: RULE_METADATA[a.rule].title_fa,
      rule_version: '1.1.0',
      primary_entity_id: a.entity,
      supplier_id: a.supplierId,
      supplier_name: a.supplierName,
      warehouse_code: a.warehouse,
      department: null,
      risk_score: risk,
      confidence_score: Math.round(a.confidence),
      financial_exposure: a.exposure,
      priority: priorityOf(risk),
      status: 'NEW',
      assigned_to: null,
      summary_fa: a.summary,
      why_flagged_fa: a.why,
      evidence: { source_file: this.fileName, ...a.evidence },
      p2p_chain: a.chain.map((c) => ({ ...c, source_file: this.fileName })),
      created_at: this.created,
    });
  }
}

const rowNo = (r: Row) => Number(r._row);
const supplierKey = (r: Row) => normalizePersianText(r.supplier_id || r.supplier_name).toUpperCase();
const supplierLabel = (r: Row) => normalizePersianText(r.supplier_name || r.supplier_id) || 'نامشخص';
const orNull = (v: string | undefined) => (v && v.trim() ? v.trim() : null);

function checkInvoices(rows: Row[], headers: string[], book: AlertBook) {
  type Inv = { r: Row; key: string; base: string | null; amount: number | null };
  const bySupplier = new Map<string, Inv[]>();
  for (const r of rows) {
    const inv: Inv = { r, key: invoiceKey(r.invoice_number || ''), base: suffixBase(r.invoice_number || ''), amount: parseAmount(r.total_amount) };
    if (!inv.key) continue;
    const k = supplierKey(r);
    bySupplier.set(k, [...(bySupplier.get(k) || []), inv]);
  }

  const invStep = (inv: Inv, label: string, anomalous: boolean): Omit<LinkedCycleRecord, 'source_file'> => ({
    stage: 'INVOICE',
    stage_label_fa: label,
    record_id: inv.r.invoice_id || inv.r.invoice_number,
    date_str: showDate(inv.r.invoice_date),
    amount_rials: inv.amount ?? undefined,
    actor_or_party: supplierLabel(inv.r),
    details_fa: `شمارهٔ فاکتور در فایل: ${inv.r.invoice_number}`,
    is_anomalous: anomalous,
    source_row_id: rowNo(inv.r),
  });

  // 1) duplicates: same supplier, and the same number written differently, a re-entry suffix, or two swapped digits
  for (const list of bySupplier.values()) {
    const byKey = new Map<string, Inv[]>();
    const bySig = new Map<string, Inv[]>();
    for (const inv of list) {
      byKey.set(inv.key, [...(byKey.get(inv.key) || []), inv]);
      const sig = [...inv.key].sort().join('');
      bySig.set(sig, [...(bySig.get(sig) || []), inv]);
    }
    const seen = new Set<string>();
    for (const a of list) {
      const candidates: Array<[Inv, 'same' | 'suffix' | 'swap']> = [];
      for (const b of byKey.get(a.key) || []) candidates.push([b, 'same']);
      if (a.base) for (const b of byKey.get(a.base) || []) candidates.push([b, 'suffix']);
      for (const b of bySig.get([...a.key].sort().join('')) || []) if (isAdjacentSwap(a.key, b.key)) candidates.push([b, 'swap']);

      for (const [b, kind] of candidates) {
        if (a === b || a.amount == null || b.amount == null || a.amount <= 0) continue;
        const pair = [rowNo(a.r), rowNo(b.r)].sort((x, y) => x - y).join('-');
        if (seen.has(pair)) continue;
        const sameAmount = a.amount === b.amount;
        const nearAmount = Math.abs(a.amount - b.amount) <= Math.max(1000, 0.01 * Math.max(a.amount, b.amount));
        if (kind === 'same' ? !nearAmount : !sameAmount) continue;
        // a suffix or a digit swap alone is weak: the two must also be dated close together
        if (kind !== 'same') {
          const [da, db] = [dayNumber(a.r.invoice_date), dayNumber(b.r.invoice_date)];
          if (da == null || db == null || Math.abs(da - db) > DUPLICATE_DAYS) continue;
        }
        seen.add(pair);
        const [first, second] = rowNo(a.r) < rowNo(b.r) ? [a, b] : [b, a];
        const how = {
          same: sameAmount ? 'شمارهٔ فاکتور یکی است و فقط شکل نوشتنش فرق دارد' : 'شمارهٔ فاکتور یکی است ولی مبلغ کمی فرق دارد',
          suffix: 'شمارهٔ دوم همان شمارهٔ اول است با یک پسوند اضافه',
          swap: 'دو رقم کنار هم در شمارهٔ فاکتور جابه‌جا شده‌اند',
        }[kind];
        const risk = kind === 'same' ? (sameAmount ? 95 : 86) : 88;
        book.add({
          rule: 'P0_DUPLICATE_INVOICE',
          entity: `${first.r.invoice_number} / ${second.r.invoice_number}`,
          supplierId: orNull(first.r.supplier_id),
          supplierName: supplierLabel(first.r),
          warehouse: orNull(second.r.warehouse_code),
          risk,
          confidence: kind === 'same' ? 95 : 85,
          exposure: second.amount!,
          summary: `احتمال ثبت دوبارهٔ فاکتور ${first.r.invoice_number} برای ${supplierLabel(first.r)}: ${how}.`,
          why: [
            `${how}: «${first.r.invoice_number}» در سطر ${formatRials(rowNo(first.r))} و «${second.r.invoice_number}» در سطر ${formatRials(rowNo(second.r))}.`,
            sameAmount
              ? `مبلغ هر دو ${formatRials(first.amount!)} ریال است.`
              : `مبلغ‌ها ${formatRials(first.amount!)} و ${formatRials(second.amount!)} ریال است.`,
          ],
          evidence: {
            source_rows: [rowNo(first.r), rowNo(second.r)],
            invoice_numbers: [first.r.invoice_number, second.r.invoice_number],
            amounts_rials: [first.amount, second.amount],
            match: kind,
          },
          chain: [invStep(first, 'فاکتور اول', false), invStep(second, 'فاکتور مشکوک به تکرار', true)],
        });
      }
    }
  }

  // 2) invoices with no purchase order (only when the file has a po_id column at all)
  if (headers.includes('po_id')) {
    for (const r of rows) {
      const amount = parseAmount(r.total_amount);
      if ((r.po_id || '').trim() || amount == null || amount <= 0) continue;
      const inv = { r, key: '', base: null, amount };
      book.add({
        rule: 'P0_3WAY_MATCH',
        entity: r.invoice_id || r.invoice_number || `سطر ${rowNo(r)}`,
        supplierId: orNull(r.supplier_id),
        supplierName: supplierLabel(r),
        warehouse: orNull(r.warehouse_code),
        risk: 82,
        confidence: 95,
        exposure: amount,
        summary: `فاکتور ${r.invoice_number || r.invoice_id} به مبلغ ${formatRials(amount)} ریال شمارهٔ سفارش خرید ندارد.`,
        why: [
          `ستون po_id در سطر ${formatRials(rowNo(r))} خالی است.`,
          'فاکتوری که به سفارش خرید وصل نیست، از تطبیق سفارش، رسید انبار و فاکتور رد شده است.',
        ],
        evidence: { source_row_id: rowNo(r), invoice_number: r.invoice_number, total_amount_rials: amount },
        chain: [invStep(inv, 'فاکتور بدون سفارش خرید', true)],
      });
    }
  }
}

const SPLIT_WINDOW_DAYS = 3;
const PRICE_JUMP = 1.45;
const PRICE_HISTORY_MIN = 3;
const PRICE_HISTORY_MAX = 6;

function checkOrders(rows: Row[], book: AlertBook) {
  // purchase orders: one entry per po_id, summed over its lines
  type Po = { id: string; first: Row; rows: Row[]; amount: number; limit: number | null; day: number | null; items: Set<string> };
  const pos = new Map<string, Po>();
  for (const r of rows) {
    const id = (r.po_id || '').trim() || `سطر ${r._row}`;
    const po = pos.get(id) || { id, first: r, rows: [], amount: 0, limit: parseAmount(r.approval_limit_rials), day: dayNumber(r.po_date), items: new Set<string>() };
    po.rows.push(r);
    po.amount += parseAmount(r.line_amount) ?? 0;
    if (r.item_code) po.items.add(normalizePersianText(r.item_code).toUpperCase());
    pos.set(id, po);
  }

  // split orders: same supplier, same approver, within a few days, each under the approver's limit, together over it
  const groups = new Map<string, Po[]>();
  for (const po of pos.values()) {
    if (po.day == null || po.limit == null || po.limit <= 0 || po.amount <= 0 || !normalizePersianText(po.first.approved_by)) continue;
    const key = `${supplierKey(po.first)}|${normalizePersianText(po.first.approved_by).toUpperCase()}`;
    groups.set(key, [...(groups.get(key) || []), po]);
  }
  for (const list of groups.values()) {
    list.sort((a, b) => a.day! - b.day!);
    for (let i = 0; i < list.length; ) {
      let j = i;
      while (j + 1 < list.length && list[j + 1].day! - list[i].day! <= SPLIT_WINDOW_DAYS) j++;
      const limit = Math.min(...list.slice(i, j + 1).map((p) => p.limit!));
      const parts = list.slice(i, j + 1).filter((p) => p.amount < limit);
      const total = parts.reduce((s, p) => s + p.amount, 0);
      if (parts.length >= 2 && total > limit) {
        const closeness = parts.reduce((s, p) => s + p.amount / limit, 0) / parts.length;
        const allItems = new Set(parts.flatMap((p) => [...p.items]));
        const oneItem = allItems.size === 1;
        const approver = parts[0].first.approved_by || 'نامشخص';
        const span = parts[parts.length - 1].day! - parts[0].day!;
        book.add({
          rule: 'P0_SPLIT_PO',
          entity: parts.map((p) => p.id).join(' / '),
          supplierId: orNull(parts[0].first.supplier_id),
          supplierName: supplierLabel(parts[0].first),
          warehouse: orNull(parts[0].first.warehouse_code),
          risk: 60 + 30 * closeness + 4 * Math.min(parts.length - 2, 2) + (oneItem ? 3 : 0),
          confidence: oneItem ? 92 : 80,
          exposure: total,
          summary: `${formatRials(parts.length)} سفارش برای ${supplierLabel(parts[0].first)} در ${formatRials(span + 1)} روز، هر کدام زیر سقف ${formatRials(limit)} ریالِ ${approver}، با جمع ${formatRials(total)} ریال.`,
          why: [
            `سقف تأیید ${approver} طبق همین فایل ${formatRials(limit)} ریال است.`,
            `سفارش‌ها: ${parts.map((p) => `${p.id} (${formatRials(p.amount)} ریال)`).join('، ')}.`,
            `میانگین هر سفارش ${Math.round(closeness * 100).toLocaleString('fa-IR')}٪ سقف است${oneItem ? ' و همه برای یک کالا هستند' : ''}.`,
          ],
          evidence: {
            po_ids: parts.map((p) => p.id),
            approval_limit_rials: limit,
            combined_amount_rials: total,
            window_days: SPLIT_WINDOW_DAYS,
            source_rows: parts.flatMap((p) => p.rows.map(rowNo)),
          },
          chain: parts.map((p) => ({
            stage: 'PO' as const,
            stage_label_fa: 'سفارش خرید',
            record_id: p.id,
            date_str: showDate(p.first.po_date),
            amount_rials: p.amount,
            actor_or_party: `تأیید: ${approver}`,
            details_fa: `${formatRials(Math.round((p.amount / limit) * 100))}٪ سقف تأیید`,
            is_anomalous: true,
            source_row_id: rowNo(p.first),
          })),
        });
        i = j + 1;
      } else i++;
    }
  }

  // price jumps: each line against the median of the same item's recent purchases in the same file
  const byItem = new Map<string, Array<{ r: Row; price: number; day: number | null }>>();
  for (const r of rows) {
    const price = parseAmount(r.unit_price);
    const item = normalizePersianText(r.item_code).toUpperCase();
    if (!item || price == null || price <= 0) continue;
    const key = `${item}|${normalizePersianText(r.unit)}`;
    byItem.set(key, [...(byItem.get(key) || []), { r, price, day: dayNumber(r.po_date) }]);
  }
  for (const list of byItem.values()) {
    list.sort((a, b) => (a.day ?? Infinity) - (b.day ?? Infinity) || rowNo(a.r) - rowNo(b.r));
    for (let k = PRICE_HISTORY_MIN; k < list.length; k++) {
      const recent = list.slice(Math.max(0, k - PRICE_HISTORY_MAX), k).map((x) => x.price).sort((a, b) => a - b);
      const mid = recent.length / 2;
      const median = recent.length % 2 ? recent[Math.floor(mid)] : (recent[mid - 1] + recent[mid]) / 2;
      const line = list[k];
      if (line.price <= median * PRICE_JUMP) continue;
      const jump = line.price / median - 1;
      const amount = parseAmount(line.r.line_amount) ?? line.price;
      book.add({
        rule: 'P0_PRICE_DEVIATION',
        entity: line.r.po_id || `سطر ${line.r._row}`,
        supplierId: orNull(line.r.supplier_id),
        supplierName: supplierLabel(line.r),
        warehouse: orNull(line.r.warehouse_code),
        risk: 55 + 50 * jump,
        confidence: 70 + 5 * Math.min(recent.length, 5),
        exposure: amount,
        summary: `قیمت واحد ${line.r.item_code} در سفارش ${line.r.po_id} ${Math.round(jump * 100).toLocaleString('fa-IR')}٪ بالاتر از میانهٔ ${formatRials(recent.length)} خرید قبلی همین کالاست.`,
        why: [
          `قیمت واحد این سفارش ${formatRials(line.price)} ریال است.`,
          `میانهٔ ${formatRials(recent.length)} خرید قبلی همین کالا در همین فایل ${formatRials(median)} ریال است.`,
        ],
        evidence: { source_row_id: rowNo(line.r), item_code: line.r.item_code, unit_price_rials: line.price, recent_median_rials: median, previous_purchases: recent.length },
        chain: [
          {
            stage: 'PO',
            stage_label_fa: 'سفارش خرید با قیمت بالاتر',
            record_id: line.r.po_id || `سطر ${line.r._row}`,
            date_str: showDate(line.r.po_date),
            amount_rials: amount,
            actor_or_party: supplierLabel(line.r),
            details_fa: `قیمت واحد ${formatRials(line.price)} ریال، میانهٔ قبلی ${formatRials(median)} ریال`,
            is_anomalous: true,
            source_row_id: rowNo(line.r),
          },
        ],
      });
    }
  }
}

// ───────────────────────── data quality ─────────────────────────

const KINDS = {
  invoices: {
    label: 'فاکتورهای خرید',
    required: ['invoice_number', 'supplier_id', 'invoice_date', 'total_amount', 'po_id'],
    amounts: ['total_amount'],
    dates: ['invoice_date'],
  },
  orders: {
    label: 'سفارش‌های خرید',
    required: ['po_id', 'supplier_id', 'item_code', 'unit_price', 'line_amount', 'po_date', 'approved_by', 'approval_limit_rials'],
    amounts: ['quantity', 'unit_price', 'line_amount', 'approval_limit_rials'],
    dates: ['po_date'],
  },
};

function qualityReport(fileName: string, kind: keyof typeof KINDS, headers: string[], rows: Row[]): TableQualityReport {
  const spec = KINDS[kind];
  const columns: Record<string, ColumnQualityMetric> = {};
  let normalized = 0;
  let validDates = 0;
  for (const h of headers) {
    let empty = 0;
    let zero = 0;
    let invalid = 0;
    for (const r of rows) {
      const v = (r[h] ?? '').trim();
      if (!v) {
        empty++;
        continue;
      }
      if (normalizePersianText(v) !== v) normalized++;
      if (spec.amounts.includes(h)) {
        const n = parseAmount(v);
        if (n == null) invalid++;
        else if (n === 0) zero++;
      }
      if (spec.dates.includes(h)) {
        if (dayNumber(v) == null) invalid++;
        else validDates++;
      }
    }
    columns[h] = {
      coverage_pct: Math.round(((rows.length - empty - invalid) / Math.max(1, rows.length)) * 1000) / 10,
      null_or_empty_count: empty,
      zero_value_count: zero,
      invalid_count: invalid,
    };
  }
  const required = spec.required.map((c) => columns[c]?.coverage_pct ?? 0);
  return {
    table_name: fileName,
    table_label_fa: `${spec.label}، ${fileName}`,
    row_count: rows.length,
    required_coverage_pct: Math.round((required.reduce((s, c) => s + c, 0) / required.length) * 10) / 10,
    normalized_persian_count: normalized,
    normalized_dates_count: validDates,
    columns,
  };
}

// ───────────────────────── entry point ─────────────────────────

export function analyzeUploadedCsvContent(
  fileName: string,
  csvText: string,
  currentState: EngineState
): { updatedState: EngineState; addedAlertsCount: number; rowsParsed: number } {
  const table = parseCsv(csvText);
  if (table.length < 2) throw new Error('فایل باید دست‌کم یک سطر عنوان و یک سطر داده داشته باشد.');

  const headers = table[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
  const rows: Row[] = table.slice(1).map((cells, i) => {
    const r = { _row: String(i + 2) } as Row;
    headers.forEach((h, k) => (r[h] = (cells[k] ?? '').trim()));
    return r;
  });

  const isInvoices = headers.includes('invoice_number') && headers.includes('total_amount');
  const isOrders = headers.includes('po_id') && headers.includes('line_amount');
  if (!isInvoices && !isOrders) {
    throw new Error('ستون‌های فایل شناخته نشد. فایل فاکتور باید invoice_number و total_amount داشته باشد و فایل سفارش po_id و line_amount.');
  }

  const book = new AlertBook(fileName);
  if (isInvoices) checkInvoices(rows, headers, book);
  if (isOrders) checkOrders(rows, book);

  const alerts = [...book.list, ...currentState.alerts].sort(
    (a, b) => b.risk_score - a.risk_score || b.financial_exposure - a.financial_exposure
  );
  const report = qualityReport(fileName, isInvoices ? 'invoices' : 'orders', headers, rows);

  return {
    updatedState: {
      ...currentState,
      batchId: book.batchId,
      sourceSystem: fileName,
      totalRecords: currentState.totalRecords + rows.length,
      alerts,
      qualityReports: [report, ...currentState.qualityReports.filter((q) => q.table_name !== fileName)],
    },
    addedAlertsCount: book.list.length,
    rowsParsed: rows.length,
  };
}
