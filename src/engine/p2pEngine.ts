import {
  AlertAuditLog,
  AlertPriority,
  AlertStatus,
  BenchmarkMetrics,
  ColumnQualityMetric,
  DashboardSummary,
  EntityCandidate,
  LinkedCycleRecord,
  P0RuleId,
  RiskAlert,
  TableQualityReport,
} from '../types';

export const RULE_METADATA: Record<
  P0RuleId,
  { title_fa: string; category_fa: string; version: string; description_fa: string }
> = {
  P0_DUPLICATE_INVOICE: {
    title_fa: 'فاکتور تکراری و مشابه',
    category_fa: 'کنترل فاکتور و ثبت هزینه',
    version: '1.0.0',
    description_fa: 'تشخیص شماره فاکتور تکراری یا مشابه با تفاوت جزئی در کاراکتر/تاریخ برای یک تأمین‌کننده و مبلغ یکسان',
  },
  P0_SPLIT_PO: {
    title_fa: 'شکستن سفارش زیر سقف تأیید',
    category_fa: 'کنترل سقف اختیارات خرید',
    version: '1.0.0',
    description_fa: 'شناسایی چند سفارش خرید مرتبط در بازه ۳ روزه زیر سقف مجاز که مجموع آن‌ها از سقف اختیار تأییدکننده عبور می‌کند',
  },
  P0_3WAY_MATCH: {
    title_fa: 'مغایرت سه‌جانبه سفارش، رسید و فاکتور',
    category_fa: 'تطبیق سه‌جانبه',
    version: '1.0.0',
    description_fa: 'فاکتور بدون سفارش خرید معتبر، یا مغایرت مقدار/مبلغ فاکتور با سفارش خرید و رسید انبار بیش از تلرانس ۲٪',
  },
  P0_PRICE_DEVIATION: {
    title_fa: 'انحراف غیرعادی قیمت خرید کالا',
    category_fa: 'تحلیل آماری قیمت تأمین',
    version: '1.0.0',
    description_fa: 'افزایش ناگهانی قیمت واحد کالا نسبت به میانه تاریخی خرید همان کالا با لحاظ واحد اندازه‌گیری',
  },
  P0_AMOUNT_OUTLIER: {
    title_fa: 'مبلغ غیرعادی برای این تأمین‌کننده',
    category_fa: 'رفتار عادی تأمین‌کننده',
    version: '1.2.0',
    description_fa: 'فاکتوری چند برابر مبلغ معمول همان تأمین‌کننده؛ مبلغ معمول از سابقهٔ خود او یاد گرفته می‌شود، نه از یک سقف ثابت',
  },
  P0_UNUSUAL_PATTERN: {
    title_fa: 'ترکیب نادر در فاکتور',
    category_fa: 'یادگیری ماشین بی‌نظارت',
    version: '1.0.0',
    description_fa: 'فاکتوری که ترکیب ویژگی‌هایش در دادهٔ خود شرکت نادر است (Isolation Forest)؛ دلیل‌ها و میزان نادر بودن هر کدام کنار هشدار می‌آید',
  },
  P0_SUPPLIER_RISK: {
    title_fa: 'ریسک تأمین‌کننده و تغییر حساب بانکی',
    category_fa: 'تحلیل گراف موجودیت و بانک',
    version: '1.0.0',
    description_fa: 'تأمین‌کنندگان دارای شماره شبا یا شناسه ثبت مشترک در گراف، یا پرداخت کلان بلافاصله پس از تغییر شبا',
  },
  P0_APPROVAL_DEVIATION: {
    title_fa: 'انحراف در زنجیره تأیید و سطح اختیار',
    category_fa: 'ماتریس اختیارات و حاکمیت',
    version: '1.0.0',
    description_fa: 'تأیید پرداخت یا سفارش بالاتر از سقف اختیار مصوب نقش کاربری یا تمرکز غیرعادی تأیید در یک کاربر',
  },
};

export const WAREHOUSE_NAMES: Record<string, string> = {
  'WH-TEH-01': 'انبار مرکزی تهران (فتح)',
  'WH-TEH-02': 'انبار غرب تهران (شهرقدس)',
  'WH-ISF-01': 'مرکز پخش اصفهان (مورچه‌خورت)',
  'WH-MSH-01': 'مرکز پخش مشهد (طوس)',
  'WH-SHZ-01': 'مرکز پخش شیراز (منطقه ویژه)',
};

export const STATUS_LABELS: Record<AlertStatus, string> = {
  NEW: 'جدید',
  IN_REVIEW: 'در حال بررسی',
  NEEDS_INFO: 'نیازمند اطلاعات',
  CONFIRMED: 'ناهنجاری تأییدشده',
  FALSE_POSITIVE: 'هشدار نادرست',
  CLOSED: 'بسته‌شده',
};

export const PRIORITY_LABELS: Record<AlertPriority, string> = {
  CRITICAL: 'بحرانی',
  HIGH: 'بالا',
  MEDIUM: 'متوسط',
  LOW: 'پایین',
};

const PERSIAN_DIGITS_MAP: Record<string, string> = {
  '۰': '0',
  '۱': '1',
  '۲': '2',
  '۳': '3',
  '۴': '4',
  '۵': '5',
  '۶': '6',
  '۷': '7',
  '۸': '8',
  '۹': '9',
  '٠': '0',
  '١': '1',
  '٢': '2',
  '٣': '3',
  '٤': '4',
  '٥': '5',
  '٦': '6',
  '٧': '7',
  '٨': '8',
  '٩': '9',
};

export function toStandardDigits(input: string): string {
  return input.replace(/[۰-۹٠-٩]/g, (ch) => PERSIAN_DIGITS_MAP[ch] ?? ch);
}

export function normalizePersianText(val: string | null | undefined): string {
  if (!val) return '';
  return toStandardDigits(String(val))
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/\u200c/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function maskIban(iban: string | null | undefined): string {
  if (!iban || iban.length < 12) return 'نامشخص';
  const clean = toStandardDigits(iban.trim());
  return `${clean.slice(0, 6)}************${clean.slice(-4)}`;
}

export function formatRials(amount: number): string {
  return new Intl.NumberFormat('fa-IR').format(Math.round(amount));
}

export function formatMillionRials(amount: number): string {
  const millions = amount / 1_000_000;
  if (millions >= 1000) {
    return `${(millions / 1000).toLocaleString('fa-IR', { maximumFractionDigits: 2 })} میلیارد ریال`;
  }
  return `${Math.round(millions).toLocaleString('fa-IR')} میلیون ریال`;
}

export interface EngineState {
  batchId: string;
  sourceSystem: string;
  dataVersion: string;
  receivedAt: string;
  totalRecords: number;
  executionSeconds: number;
  alerts: RiskAlert[];
  auditLogs: AlertAuditLog[];
  entityCandidates: EntityCandidate[];
  qualityReports: TableQualityReport[];
  benchmark: BenchmarkMetrics;
  csvTemplates: Record<string, string>;
}

const ITEMS_CATALOG = [
  { code: 'ITM-101', name: 'روغن سرخ‌کردنی ۱.۸ لیتری طلایی', unit: 'بطری', basePrice: 920_000 },
  { code: 'ITM-102', name: 'برنج هاشمی ممتاز ۱۰ کیلویی گیلان', unit: 'کیسه', basePrice: 13_400_000 },
  { code: 'ITM-103', name: 'مایع ظرفشویی ۴ لیتری لیمویی', unit: 'گالن', basePrice: 2_250_000 },
  { code: 'ITM-104', name: 'آب‌معدنی ۰.۵ لیتری (باکس ۱۲ عددی)', unit: 'باکس', basePrice: 480_000 },
  { code: 'ITM-105', name: 'رب گوجه‌فرنگی ۸۰۰ گرمی درب آسان‌بازشو', unit: 'قوطی', basePrice: 710_000 },
  { code: 'ITM-106', name: 'پودر لباسشویی ماشینی ۵۰۰ گرمی', unit: 'بسته', basePrice: 560_000 },
  { code: 'ITM-107', name: 'چای سیاه شکسته ممتاز ۵۰۰ گرمی', unit: 'بسته', basePrice: 3_150_000 },
  { code: 'ITM-108', name: 'کارتن بسته‌بندی ۵ لایه صادراتی', unit: 'عدد', basePrice: 340_000 },
];

export const CSV_TEMPLATES: Record<string, string> = {
  'invoices.csv': [
    'invoice_id,invoice_number,po_id,supplier_id,supplier_name,invoice_date,total_amount,warehouse_code',
    'INV-9001,F-1404-9901,PO-9001,SUP-0042,صنايع غذايي بهاران زاگرس,۱۴۰۴/۱۱/۱۴,385000000,WH-ISF-01',
    'INV-9002,F-1404-9901-A,PO-9001,SUP-0042,صنایع غذایی بهاران زاگرس,1404/11/16,385000000,WH-ISF-01',
    'INV-9003,NOPO-4412,,SUP-0037,تولیدی صدف خزر,1404/11/20,275000000,WH-MSH-01',
  ].join('\n'),
  'purchase_orders.csv': [
    'po_id,supplier_id,supplier_name,item_code,unit,warehouse_code,quantity,unit_price,line_amount,po_date,approved_by,approval_limit_rials',
    'PO-SPL-101,SUP-0014,بازرگانی کاسپین پخش البرز,ITM-102,کیسه,WH-TEH-01,10,14200000,142000000,1404/11/12,USR-012,150000000',
    'PO-SPL-102,SUP-0014,بازرگانی کاسپین پخش البرز,ITM-102,کیسه,WH-TEH-01,10,14500000,145000000,1404/11/13,USR-012,150000000',
    'PO-PRC-198,SUP-0064,پخش پارس گستر,ITM-101,بطری,WH-ISF-01,100,1190000,119000000,1404/08/18,USR-026,800000000',
    'PO-PRC-199,SUP-0064,پخش پارس گستر,ITM-101,بطری,WH-ISF-01,100,1210000,121000000,1404/09/20,USR-026,800000000',
    'PO-PRC-200,SUP-0064,پخش پارس گستر,ITM-101,بطری,WH-ISF-01,100,1220000,122000000,1404/10/21,USR-026,800000000',
    'PO-PRC-201,SUP-0064,پخش پارس گستر,ITM-101,بطری,WH-ISF-01,100,1766000,176600000,1404/11/22,USR-026,800000000',
  ].join('\n'),
};

export function createEmptyEngineState(): EngineState {
  return {
    batchId: '',
    sourceSystem: '',
    dataVersion: '',
    receivedAt: '',
    totalRecords: 0,
    executionSeconds: 0,
    alerts: [],
    auditLogs: [],
    entityCandidates: [],
    qualityReports: [],
    benchmark: {
      total_records_analyzed: 0,
      execution_seconds: 0,
      sla_target_seconds: 900,
      precision_at_20: 0,
      target_precision_at_20: 60,
      seeded_anomalies_count: 0,
      detected_true_positives: 0,
      evidence_traceability_pct: 0,
      source_attribution_pct: 0,
      essential_field_coverage_pct: 0,
    },
    csvTemplates: CSV_TEMPLATES,
  };
}

export function generateSyntheticEngineState(scaleOrders: number = 15000): EngineState {
  const t0 = performance.now();
  const batchId = `BATCH-1404-${Math.floor(1000 + Math.random() * 9000)}`;

  // محاسبه تعداد کل رکوردهای شبیه‌سازی‌شده در ۸ جدول استاندارد چرخه P2P
  const prCount = scaleOrders;
  const poLineCount = Math.round(scaleOrders * 2.15);
  const grLineCount = Math.round(scaleOrders * 2.08);
  const invCount = scaleOrders + 45;
  const payCount = scaleOrders + 12;
  const supCount = 300;
  const usrCount = 40;
  const totalRecords = prCount + poLineCount + grLineCount + invCount + payCount + supCount + usrCount;

  const alerts: RiskAlert[] = [
    // 1. P0_SPLIT_PO (شکستن سفارش خرید برای عبور از سقف ۱۵۰ میلیون ریال)
    {
      alert_id: 'ALT-1404-001',
      batch_id: batchId,
      rule_id: 'P0_SPLIT_PO',
      rule_title_fa: RULE_METADATA.P0_SPLIT_PO.title_fa,
      rule_version: '1.0.0',
      primary_entity_id: 'PO-SPL-001-A / B / C',
      supplier_id: 'SUP-0014',
      supplier_name: 'بازرگانی کاسپین پخش البرز',
      warehouse_code: 'WH-TEH-01',
      department: 'بازرگانی مواد غذایی',
      risk_score: 94.5,
      confidence_score: 96.0,
      financial_exposure: 432_000_000,
      priority: 'CRITICAL',
      status: 'NEW',
      assigned_to: 'حسابرس ارشد - م. رضایی',
      summary_fa:
        'شکستن سفارش خرید به ۳ سفارش متوالی (هر کدام ۱۴۲ تا ۱۴۶ میلیون ریال) در بازه ۴۸ ساعته توسط USR-012 زیر سقف اختیار ۱۵۰ میلیون ریال؛ مجموع ۴۳۲ میلیون ریال.',
      why_flagged_fa: [
        'سقف مجاز تأیید کارشناس خرید (USR-012) طبق سیاست POL-01 معادل ۱۵۰,۰۰۰,۰۰۰ ریال است.',
        '۳ سفارش مستقل با شناسه‌های PO-SPL-001-A، PO-SPL-001-B و PO-SPL-001-C برای یک تأمین‌کننده واحد (SUP-0014) و یک کالای واحد (ITM-102) در تاریخ‌های ۱۴۰۴/۱۱/۱۲ و ۱۴۰۴/۱۱/۱۳ ثبت شده است.',
        'نسبت نزدیکی هر سفارش به آستانه مجاز ۹۶٪ است (Near-Threshold Ratio >= 85%) که الگوی کلاسیک تفکیک عمدی برای دور زدن تأیید مدیر خرید محسوب می‌شود.',
      ],
      evidence: {
        approver_id: 'USR-012 (کارشناس خرید - سقف: ۱۵۰ میلیون ریال)',
        approval_limit_rials: 150_000_000,
        window_days: 2,
        threshold_proximity_pct: 97.3,
        po_ids: ['PO-SPL-001-A', 'PO-SPL-001-B', 'PO-SPL-001-C'],
        po_amounts_rials: [142_000_000, 144_000_000, 146_000_000],
        item_code: 'ITM-102 (برنج هاشمی ممتاز ۱۰ کیلویی گیلان)',
        source_row_ids: [1420, 1421, 1455],
      },
      p2p_chain: [
        {
          stage: 'PR',
          stage_label_fa: 'درخواست خرید',
          record_id: 'PR-104810',
          date_str: '1404/11/11',
          amount_rials: 432_000_000,
          actor_or_party: 'USR-008 (درخواست‌کننده انبار مرکزی)',
          details_fa: 'درخواست تأمین ۳۲ کیسه برنج هاشمی برای انبار فتح',
          source_file: 'purchase_requests.csv',
          source_row_id: 984,
        },
        {
          stage: 'PO',
          stage_label_fa: 'سفارش خرید (تفکیک‌شده ۱)',
          record_id: 'PO-SPL-001-A',
          date_str: '1404/11/12',
          amount_rials: 142_000_000,
          actor_or_party: 'تأیید: USR-012 (کارشناس خرید)',
          details_fa: '۹۴.۶٪ سقف مجاز کارشناس - تأمین‌کننده SUP-0014',
          is_anomalous: true,
          source_file: 'purchase_orders.csv',
          source_row_id: 1420,
        },
        {
          stage: 'PO',
          stage_label_fa: 'سفارش خرید (تفکیک‌شده ۲ و ۳)',
          record_id: 'PO-SPL-001-B & C',
          date_str: '1404/11/13',
          amount_rials: 290_000_000,
          actor_or_party: 'تأیید: USR-012 (کارشناس خرید)',
          details_fa: 'دو سفارش ۱۴۴ و ۱۴۶ میلیون ریالی با فاصله کمتر از ۲۴ ساعت',
          is_anomalous: true,
          source_file: 'purchase_orders.csv',
          source_row_id: 1455,
        },
        {
          stage: 'INVOICE',
          stage_label_fa: 'فاکتور تأمین‌کننده',
          record_id: 'INV-109842',
          date_str: '1404/11/16',
          amount_rials: 432_000_000,
          actor_or_party: 'SUP-0014 (بازرگانی کاسپین پخش البرز)',
          details_fa: 'تجمیع هر ۳ سفارش در فاکتور نهایی تأمین‌کننده',
          source_file: 'invoices.csv',
          source_row_id: 2104,
        },
      ],
      is_ground_truth_tp: true,
      created_at: '1404/11/28 - 09:15',
    },

    // 2. P0_DUPLICATE_INVOICE (فاکتور تکراری با تغییر جزئی کاراکتر)
    {
      alert_id: 'ALT-1404-002',
      batch_id: batchId,
      rule_id: 'P0_DUPLICATE_INVOICE',
      rule_title_fa: RULE_METADATA.P0_DUPLICATE_INVOICE.title_fa,
      rule_version: '1.0.0',
      primary_entity_id: 'INV-DUP-019',
      supplier_id: 'SUP-0042',
      supplier_name: 'صنایع غذایی بهاران زاگرس',
      warehouse_code: 'WH-ISF-01',
      department: 'بازرگانی مواد غذایی',
      risk_score: 93.0,
      confidence_score: 95.5,
      financial_exposure: 385_000_000,
      priority: 'CRITICAL',
      status: 'NEW',
      assigned_to: null,
      summary_fa:
        'ثبت دو فاکتور با مبلغ یکسان ۳۸۵,۰۰۰,۰۰۰ ریال برای تأمین‌کننده SUP-0042 با شماره‌های F-1404-08821 و F-1404-08821-A به فاصله ۳ روز.',
      why_flagged_fa: [
        'شباهت متنی شماره فاکتورها ۹۲.۳٪ است (تفاوت صرفاً در پسوند -A پس از نرمال‌سازی ارقام فارسی).',
        'مبلغ کل هر دو فاکتور دقیقاً ۳۸۵,۰۰۰,۰۰۰ ریال و مربوط به یک تأمین‌کننده (SUP-0042) است.',
        'هر دو فاکتور به یک رسید انبار واحد (GR-008412) اشاره دارند که خطر پرداخت مضاعف (Double Payment) را ایجاد کرده است.',
      ],
      evidence: {
        match_type: 'FUZZY_NEAR_DUPLICATE',
        invoice_number_similarity: 0.923,
        invoice_ids: ['INV-008412', 'INV-DUP-019'],
        invoice_numbers: ['F-1404-08821', 'F-1404-08821-A'],
        invoice_dates: ['1404/11/14', '1404/11/17'],
        shared_po_id: 'PO-008412',
        source_row_ids: [8412, 15019],
      },
      p2p_chain: [
        {
          stage: 'PO',
          stage_label_fa: 'سفارش خرید مرجع',
          record_id: 'PO-008412',
          date_str: '1404/11/10',
          amount_rials: 385_000_000,
          actor_or_party: 'تأیید: USR-028 (مدیر خرید)',
          details_fa: 'سفارش ۵۰۰ کارتن رب گوجه‌فرنگی ۸۰۰ گرمی',
          source_file: 'purchase_orders.csv',
          source_row_id: 8412,
        },
        {
          stage: 'INVOICE',
          stage_label_fa: 'فاکتور اصلی (نوبت اول)',
          record_id: 'INV-008412',
          date_str: '1404/11/14',
          amount_rials: 385_000_000,
          actor_or_party: 'شماره فاکتور: F-1404-08821',
          details_fa: 'ثبت اولیه و پرداخت‌شده در تاریخ ۱۴۰۴/۱۱/۱۶',
          source_file: 'invoices.csv',
          source_row_id: 8412,
        },
        {
          stage: 'INVOICE',
          stage_label_fa: 'فاکتور مشابه (ثبت مجدد)',
          record_id: 'INV-DUP-019',
          date_str: '1404/11/17',
          amount_rials: 385_000_000,
          actor_or_party: 'شماره فاکتور: F-1404-08821-A',
          details_fa: 'ثبت مجدد همان هزینه با پسوند A و ارقام عربی در فایل ورودی',
          is_anomalous: true,
          source_file: 'invoices.csv',
          source_row_id: 15019,
        },
      ],
      is_ground_truth_tp: true,
      created_at: '1404/11/28 - 09:15',
    },

    // 3. P0_SUPPLIER_RISK (تغییر شماره شبا ۳ روز قبل از پرداخت کلان)
    {
      alert_id: 'ALT-1404-003',
      batch_id: batchId,
      rule_id: 'P0_SUPPLIER_RISK',
      rule_title_fa: RULE_METADATA.P0_SUPPLIER_RISK.title_fa,
      rule_version: '1.0.0',
      primary_entity_id: 'PAY-BANK-CHG-01',
      supplier_id: 'SUP-0016',
      supplier_name: 'تأمین گستر سپهر پارسیان',
      warehouse_code: 'WH-TEH-01',
      department: 'بهداشتی و شوینده',
      risk_score: 92.0,
      confidence_score: 94.0,
      financial_exposure: 650_000_000,
      priority: 'CRITICAL',
      status: 'IN_REVIEW',
      assigned_to: 'مدیر حسابرسی - ع. کاظمی',
      summary_fa:
        'پرداخت کلان ۶۵۰,۰۰۰,۰۰۰ ریال به تأمین‌کننده SUP-0016 تنها ۳ روز پس از تغییر شماره شبا در پرونده تأمین‌کننده (IR9901************9915).',
      why_flagged_fa: [
        'شماره شبای تأمین‌کننده SUP-0016 در تاریخ ۱۴۰۴/۱۱/۲۱ از حساب قدیمی به IR9901************9915 تغییر یافته است.',
        'در تاریخ ۱۴۰۴/۱۱/۲۴ (فاصله ۳ روز) دستور پرداخت ۶۵۰ میلیون ریالی صادر شده که ۲.۸ برابر میانگین پرداخت ماهانه این تأمین‌کننده است.',
        'عدم ثبت شناسه تیکت تأییدیه کتبی تغییر حساب بانکی در جدول تغییرات تأمین‌کنندگان.',
      ],
      evidence: {
        payment_id: 'PAY-BANK-CHG-01',
        supplier_id: 'SUP-0016',
        previous_iban_masked: 'IR1001************0016',
        new_iban_masked: 'IR9901************9915',
        bank_updated_date: '1404/11/21',
        payment_date: '1404/11/24',
        days_since_iban_change: 3,
        source_row_ids: [16, 15048],
      },
      p2p_chain: [
        {
          stage: 'SUPPLIER',
          stage_label_fa: 'پرونده تأمین‌کننده (تغییر شبا)',
          record_id: 'SUP-0016',
          date_str: '1404/11/21',
          actor_or_party: 'تأمین گستر سپهر پارسیان',
          details_fa: 'تغییر شبا به IR9901************9915 بدون پیوست استعلام بانک',
          is_anomalous: true,
          source_file: 'suppliers.csv',
          source_row_id: 16,
        },
        {
          stage: 'INVOICE',
          stage_label_fa: 'فاکتور تأمین‌کننده',
          record_id: 'INV-004120',
          date_str: '1404/11/22',
          amount_rials: 650_000_000,
          actor_or_party: 'SUP-0016',
          details_fa: 'فاکتور محموله شوینده صنعتی',
          source_file: 'invoices.csv',
          source_row_id: 4120,
        },
        {
          stage: 'PAYMENT',
          stage_label_fa: 'اجرای پرداخت کلان',
          record_id: 'PAY-BANK-CHG-01',
          date_str: '1404/11/24',
          amount_rials: 650_000_000,
          actor_or_party: 'تأیید پرداخت: USR-029',
          details_fa: 'واریز به شبای جدید ۳ روز پس از ویرایش حساب',
          is_anomalous: true,
          source_file: 'payments.csv',
          source_row_id: 15048,
        },
      ],
      is_ground_truth_tp: true,
      created_at: '1404/11/28 - 09:15',
    },

    // 4. P0_APPROVAL_DEVIATION (تأیید پرداخت خارج از سقف اختیار)
    {
      alert_id: 'ALT-1404-004',
      batch_id: batchId,
      rule_id: 'P0_APPROVAL_DEVIATION',
      rule_title_fa: RULE_METADATA.P0_APPROVAL_DEVIATION.title_fa,
      rule_version: '1.0.0',
      primary_entity_id: 'PAY-AUTH-004',
      supplier_id: 'SUP-0088',
      supplier_name: 'پخش سراسری نیکان خلیج فارس',
      warehouse_code: 'WH-SHZ-01',
      department: 'نوشیدنی',
      risk_score: 91.5,
      confidence_score: 98.0,
      financial_exposure: 490_000_000,
      priority: 'CRITICAL',
      status: 'NEW',
      assigned_to: null,
      summary_fa:
        'تأیید پرداخت PAY-AUTH-004 به مبلغ ۴۹۰,۰۰۰,۰۰۰ ریال توسط USR-019 (کارشناس خرید) با سقف اختیار مصوب ۱۵۰,۰۰۰,۰۰۰ ریال.',
      why_flagged_fa: [
        'بر اساس ماتریس اختیارات (users_approvals.csv)، کاربر USR-019 دارای نقش «کارشناس خرید» با سقف ۱۵۰ میلیون ریال است.',
        'مبلغ پرداخت ۴۹۰ میلیون ریال نیاز به تأیید «مدیر خرید» (سقف ۸۰۰ میلیون ریال) یا «معاون مالی» داشته است.',
        'تخطی ۲۲۶٪ از سقف اختیار مصوب سازمان.',
      ],
      evidence: {
        payment_id: 'PAY-AUTH-004',
        approved_by: 'USR-019',
        approver_role: 'کارشناس خرید',
        approval_limit_rials: 150_000_000,
        paid_amount_rials: 490_000_000,
        excess_amount_rials: 340_000_000,
        source_row_ids: [19, 15054],
      },
      p2p_chain: [
        {
          stage: 'APPROVER',
          stage_label_fa: 'ماتریس سطح اختیارات',
          record_id: 'USR-019',
          date_str: '1404/01/01',
          amount_rials: 150_000_000,
          actor_or_party: 'نقش: کارشناس خرید (واحد نوشیدنی)',
          details_fa: 'سقف مجاز تأیید طبق آیین‌نامه POL-01: حداکثر ۱۵۰ میلیون ریال',
          source_file: 'users_approvals.csv',
          source_row_id: 19,
        },
        {
          stage: 'PAYMENT',
          stage_label_fa: 'تأیید و اجرای پرداخت',
          record_id: 'PAY-AUTH-004',
          date_str: '1404/11/25',
          amount_rials: 490_000_000,
          actor_or_party: 'تأییدکننده ثبت‌شده: USR-019',
          details_fa: 'عبور ۳۴۰ میلیون ریالی از سقف مجاز کاربر تأییدکننده',
          is_anomalous: true,
          source_file: 'payments.csv',
          source_row_id: 15054,
        },
      ],
      is_ground_truth_tp: true,
      created_at: '1404/11/28 - 09:15',
    },

    // 5. P0_SUPPLIER_RISK (شبای بانکی و شناسه ثبت مشترک بین دو تأمین‌کننده در گراف NetworkX)
    {
      alert_id: 'ALT-1404-005',
      batch_id: batchId,
      rule_id: 'P0_SUPPLIER_RISK',
      rule_title_fa: RULE_METADATA.P0_SUPPLIER_RISK.title_fa,
      rule_version: '1.0.0',
      primary_entity_id: 'SUP-0251 ⟷ SUP-0011',
      supplier_id: 'SUP-0251',
      supplier_name: 'کیمیا پخش آریا ۲۵۱',
      warehouse_code: 'WH-TEH-02',
      department: 'لجستیک و بسته‌بندی',
      risk_score: 90.0,
      confidence_score: 97.5,
      financial_exposure: 540_000_000,
      priority: 'CRITICAL',
      status: 'CONFIRMED',
      assigned_to: 'حسابرس ارشد - م. رضایی',
      summary_fa:
        'کشف ارتباط پنهان در گراف موجودیت‌ها: تأمین‌کننده SUP-0251 و SUP-0011 دارای شماره شبا (IR1001************0011) و شماره ثبت مشترک (1010100011) هستند.',
      why_flagged_fa: [
        'در گراف روابط (Entity Graph)، دو گره تأمین‌کننده با شناسه‌های مجزا به یک گره شبا و یک گره شناسه ثبت متصل شده‌اند.',
        'وجود دو کد تأمین‌کننده فعال برای یک ذی‌نفع واحد باعث دور زدن سقف تجمعی خرید از تأمین‌کننده و تقسیم سفارش‌ها بین دو کد شده است.',
      ],
      evidence: {
        graph_component_id: 'COMP-IBAN-0011',
        supplier_ids: ['SUP-0011', 'SUP-0251'],
        shared_iban_masked: 'IR1001************0011',
        shared_registration_no: '1010100011',
        combined_turnover_rials: 540_000_000,
        source_row_ids: [11, 251],
      },
      p2p_chain: [
        {
          stage: 'SUPPLIER',
          stage_label_fa: 'تأمین‌کننده اول (قدیمی)',
          record_id: 'SUP-0011',
          date_str: '1402/04/10',
          amount_rials: 310_000_000,
          actor_or_party: 'پخش البرز ۱۱',
          details_fa: 'شبا: IR1001************0011 | ثبت: 1010100011',
          source_file: 'suppliers.csv',
          source_row_id: 11,
        },
        {
          stage: 'SUPPLIER',
          stage_label_fa: 'تأمین‌کننده دوم (تکراری با کد جدید)',
          record_id: 'SUP-0251',
          date_str: '1404/09/05',
          amount_rials: 230_000_000,
          actor_or_party: 'کیمیا پخش آریا ۲۵۱',
          details_fa: 'شبا: IR1001************0011 | ثبت: 1010100011 (تطابق ۱۰۰٪)',
          is_anomalous: true,
          source_file: 'suppliers.csv',
          source_row_id: 251,
        },
      ],
      is_ground_truth_tp: true,
      created_at: '1404/11/28 - 09:15',
    },

    // 6. P0_3WAY_MATCH (فاکتور بدون سفارش خرید معتبر + کسری تحویل انبار)
    {
      alert_id: 'ALT-1404-006',
      batch_id: batchId,
      rule_id: 'P0_3WAY_MATCH',
      rule_title_fa: RULE_METADATA.P0_3WAY_MATCH.title_fa,
      rule_version: '1.0.0',
      primary_entity_id: 'INV-NOPO-007',
      supplier_id: 'SUP-0037',
      supplier_name: 'تولیدی صدف خزر',
      warehouse_code: 'WH-MSH-01',
      department: 'بازرگانی مواد غذایی',
      risk_score: 86.5,
      confidence_score: 95.0,
      financial_exposure: 275_000_000,
      priority: 'HIGH',
      status: 'NEW',
      assigned_to: null,
      summary_fa:
        'فاکتور INV-NOPO-007 به مبلغ ۲۷۵,۰۰۰,۰۰۰ ریال بدون شناسه سفارش خرید (PO) معتبر و بدون رسید انبار (GR) منطبق تأیید شده است.',
      why_flagged_fa: [
        'فیلد po_id در رکورد فاکتور خالی است و در تطبیق تجمعی نیز هیچ سفارش باز برای تأمین‌کننده SUP-0037 در بازه ۳۰ روزه یافت نشد.',
        'طبق سیاست POL-01 و POL-02، هرگونه فاکتور بالای ۱۰ میلیون ریال ملزم به داشتن سفارش خرید (PO) و رسید انبار (GR) است.',
      ],
      evidence: {
        sub_type: 'INVOICE_WITHOUT_PO_AND_GR',
        invoice_id: 'INV-NOPO-007',
        invoice_number: 'NOPO-9007',
        supplier_id: 'SUP-0037',
        invoice_amount_rials: 275_000_000,
        linked_po_id: null,
        linked_gr_id: null,
        source_row_ids: [15032],
      },
      p2p_chain: [
        {
          stage: 'PO',
          stage_label_fa: 'سفارش خرید (PO)',
          record_id: 'ناموجود (NULL)',
          date_str: '—',
          amount_rials: 0,
          actor_or_party: 'فاقد سفارش در سیستم خرید',
          details_fa: 'هیچ رکوردی در purchase_orders.csv یافت نشد',
          is_anomalous: true,
          source_file: 'purchase_orders.csv',
          source_row_id: 0,
        },
        {
          stage: 'GR',
          stage_label_fa: 'رسید انبار (GR)',
          record_id: 'ناموجود (NULL)',
          date_str: '—',
          amount_rials: 0,
          actor_or_party: 'فاقد رسید تحویل کالا در انبار مشهد',
          details_fa: 'هیچ رکوردی در goods_receipts.csv یافت نشد',
          is_anomalous: true,
          source_file: 'goods_receipts.csv',
          source_row_id: 0,
        },
        {
          stage: 'INVOICE',
          stage_label_fa: 'ثبت و تأیید فاکتور',
          record_id: 'INV-NOPO-007',
          date_str: '1404/11/20',
          amount_rials: 275_000_000,
          actor_or_party: 'SUP-0037 (تولیدی صدف خزر)',
          details_fa: 'فاکتور شماره NOPO-9007 در وضعیت APPROVED',
          is_anomalous: true,
          source_file: 'invoices.csv',
          source_row_id: 15032,
        },
      ],
      is_ground_truth_tp: true,
      created_at: '1404/11/28 - 09:15',
    },

    // 7. P0_PRICE_DEVIATION (انحراف قیمت خرید +۹۲٪ بالاتر از میانه تاریخی)
    {
      alert_id: 'ALT-1404-007',
      batch_id: batchId,
      rule_id: 'P0_PRICE_DEVIATION',
      rule_title_fa: RULE_METADATA.P0_PRICE_DEVIATION.title_fa,
      rule_version: '1.0.0',
      primary_entity_id: 'PO-PRC-004',
      supplier_id: 'SUP-0064',
      supplier_name: 'پخش پارس گستر ۶۴',
      warehouse_code: 'WH-ISF-01',
      department: 'بازرگانی مواد غذایی',
      risk_score: 84.0,
      confidence_score: 91.0,
      financial_exposure: 176_640_000,
      priority: 'HIGH',
      status: 'NEEDS_INFO',
      assigned_to: 'کارشناس حسابرسی - س. محمدی',
      summary_fa:
        'خرید کالای ITM-101 (روغن سرخ‌کردنی ۱.۸ لیتری) با قیمت واحد ۱,۷۶۶,۰۰۰ ریال؛ ۹۲.۰٪ بالاتر از میانه قیمت خرید شرکت (۹۲۰,۰۰۰ ریال).',
      why_flagged_fa: [
        'میانه قیمت خرید کالای ITM-101 با واحد «بطری» در ۹ ماه گذشته ۹۲۰,۰۰۰ ریال با انحراف معیار ۵.۲٪ بوده است.',
        'در سفارش PO-PRC-004 قیمت واحد ۱,۷۶۶,۰۰۰ ریال (Z-Score > 8.4) بدون تغییر در واحد اندازه‌گیری ثبت شده است.',
        'اضافه‌پرداخت خالص در این سفارش نسبت به قیمت میانه معادل ۸۴,۶۴۰,۰۰۰ ریال است.',
      ],
      evidence: {
        po_id: 'PO-PRC-004',
        item_code: 'ITM-101',
        item_name: 'روغن سرخ‌کردنی ۱.۸ لیتری طلایی',
        unit: 'بطری',
        quantity: 100,
        order_unit_price_rials: 1_766_000,
        historical_median_price_rials: 920_000,
        deviation_pct: 92.0,
        overpayment_exposure_rials: 84_640_000,
        source_row_ids: [15039],
      },
      p2p_chain: [
        {
          stage: 'PO',
          stage_label_fa: 'سفارش خرید با انحراف قیمت',
          record_id: 'PO-PRC-004',
          date_str: '1404/11/22',
          amount_rials: 176_640_000,
          actor_or_party: 'SUP-0064 | تأیید: USR-026',
          details_fa: '۱۰۰ بطری × ۱,۷۶۶,۰۰۰ ریال (میانه بازار شرکت: ۹۲۰,۰۰۰ ریال)',
          is_anomalous: true,
          source_file: 'purchase_orders.csv',
          source_row_id: 15039,
        },
        {
          stage: 'GR',
          stage_label_fa: 'رسید انبار اصفهان',
          record_id: 'GR-PRC-004',
          date_str: '1404/11/24',
          actor_or_party: 'WH-ISF-01',
          details_fa: 'دریافت ۱۰۰ بطری (واحد کالا بررسی و تأیید شد: بطری، نه کارتن)',
          source_file: 'goods_receipts.csv',
          source_row_id: 14990,
        },
      ],
      is_ground_truth_tp: true,
      created_at: '1404/11/28 - 09:15',
    },

    // 8. P0_3WAY_MATCH (مغایرت مقدار رسید انبار با فاکتور - تحویل ناقص، فاکتور کامل)
    {
      alert_id: 'ALT-1404-008',
      batch_id: batchId,
      rule_id: 'P0_3WAY_MATCH',
      rule_title_fa: RULE_METADATA.P0_3WAY_MATCH.title_fa,
      rule_version: '1.0.0',
      primary_entity_id: 'INV-006210',
      supplier_id: 'SUP-0108',
      supplier_name: 'صنایع بسته‌بندی البرز کارتن',
      warehouse_code: 'WH-TEH-02',
      department: 'لجستیک و بسته‌بندی',
      risk_score: 81.0,
      confidence_score: 93.0,
      financial_exposure: 340_000_000,
      priority: 'HIGH',
      status: 'NEW',
      assigned_to: null,
      summary_fa:
        'مغایرت مقدار تحویل و فاکتور در سفارش PO-006210: مقدار سفارش ۱,۰۰۰ عدد، رسید واقعی انبار ۶۸۰ عدد (۳۲٪ کسری تحویل)، اما فاکتور و درخواست پرداخت برای ۱,۰۰۰ عدد کامل صادر شده است.',
      why_flagged_fa: [
        'طبق سیاست POL-03 حداکثر تلرانس مجاز دریافت کالا ۲.۰٪ است.',
        'در رسید انبار GR-006210-L1 تنها ۶۸۰ عدد کارتن ۵ لایه تحویل انبار شهرقدس شده، اما فاکتور INV-006210 به مبلغ کامل ۳۴۰,۰۰۰,۰۰۰ ریال تأیید شده است.',
        'مبلغ مازاد فاکتورشده بابت کالای تحویل‌نشده: ۱۰۸,۸۰۰,۰۰۰ ریال.',
      ],
      evidence: {
        sub_type: 'GR_SHORTFALL_FULL_INVOICE',
        po_id: 'PO-006210',
        gr_line_id: 'GR-006210-L1',
        invoice_id: 'INV-006210',
        ordered_qty: 1000,
        received_qty: 680,
        invoiced_qty_equivalent: 1000,
        shortfall_pct: 32.0,
        unreceived_billed_amount_rials: 108_800_000,
        source_row_ids: [6210, 6198, 6210],
      },
      p2p_chain: [
        {
          stage: 'PO',
          stage_label_fa: 'سفارش خرید',
          record_id: 'PO-006210',
          date_str: '1404/11/05',
          amount_rials: 340_000_000,
          actor_or_party: 'SUP-0108',
          details_fa: 'سفارش ۱,۰۰۰ عدد کارتن ۵ لایه × ۳۴۰,۰۰۰ ریال',
          source_file: 'purchase_orders.csv',
          source_row_id: 6210,
        },
        {
          stage: 'GR',
          stage_label_fa: 'رسید انبار (تحویل ناقص)',
          record_id: 'GR-006210-L1',
          date_str: '1404/11/09',
          amount_rials: 231_200_000,
          actor_or_party: 'WH-TEH-02 (انبار غرب تهران)',
          details_fa: 'مقدار تحویل واقعی: ۶۸۰ عدد (کسری ۳۲۰ عدد)',
          is_anomalous: true,
          source_file: 'goods_receipts.csv',
          source_row_id: 6198,
        },
        {
          stage: 'INVOICE',
          stage_label_fa: 'فاکتور تأییدشده (مبلغ کامل)',
          record_id: 'INV-006210',
          date_str: '1404/11/12',
          amount_rials: 340_000_000,
          actor_or_party: 'SUP-0108',
          details_fa: 'فاکتور روی ۱,۰۰۰ عدد بدون کسر کسری انبار',
          is_anomalous: true,
          source_file: 'invoices.csv',
          source_row_id: 6210,
        },
      ],
      is_ground_truth_tp: true,
      created_at: '1404/11/28 - 09:15',
    },

    // 9. P0_DUPLICATE_INVOICE (فاکتور تکراری دقیق در دو شعبه)
    {
      alert_id: 'ALT-1404-009',
      batch_id: batchId,
      rule_id: 'P0_DUPLICATE_INVOICE',
      rule_title_fa: RULE_METADATA.P0_DUPLICATE_INVOICE.title_fa,
      rule_version: '1.0.0',
      primary_entity_id: 'INV-DUP-008',
      supplier_id: 'SUP-0023',
      supplier_name: 'پخش نوشیدنی زاگرس ۲۳',
      warehouse_code: 'WH-TEH-01',
      department: 'نوشیدنی',
      risk_score: 95.0,
      confidence_score: 98.0,
      financial_exposure: 216_000_000,
      priority: 'CRITICAL',
      status: 'CONFIRMED',
      assigned_to: 'حسابرس ارشد - م. رضایی',
      summary_fa:
        'فاکتور تکراری دقیق با شماره F-1404-01600 برای تأمین‌کننده SUP-0023 به مبلغ ۲۱۶,۰۰۰,۰۰۰ ریال که دو بار با شناسه‌های INV-001600 و INV-DUP-008 ثبت شده است.',
      why_flagged_fa: [
        'تطابق ۱۰۰٪ شماره فاکتور (F-1404-01600)، کد تأمین‌کننده (SUP-0023) و مبلغ (۲۱۶,۰۰۰,۰۰۰ ریال).',
        'فاکتور اول با اعداد لاتین و فاکتور دوم با اعداد فارسی (F-۱۴۰۴-۰۱۶۰۰) در ERP ثبت شده بود که پس از لایه نرمال‌سازی کشف شد.',
      ],
      evidence: {
        match_type: 'EXACT_AFTER_PERSIAN_NORMALIZATION',
        invoice_number_similarity: 1.0,
        invoice_ids: ['INV-001600', 'INV-DUP-008'],
        raw_invoice_numbers: ['F-1404-01600', 'F-۱۴۰۴-۰۱۶۰۰'],
        source_row_ids: [1600, 15008],
      },
      p2p_chain: [
        {
          stage: 'INVOICE',
          stage_label_fa: 'ثبت اول (ارقام لاتین)',
          record_id: 'INV-001600',
          date_str: '1404/10/18',
          amount_rials: 216_000_000,
          actor_or_party: 'SUP-0023',
          details_fa: 'شماره خام: F-1404-01600',
          source_file: 'invoices.csv',
          source_row_id: 1600,
        },
        {
          stage: 'INVOICE',
          stage_label_fa: 'ثبت دوم (ارقام فارسی)',
          record_id: 'INV-DUP-008',
          date_str: '1404/10/19',
          amount_rials: 216_000_000,
          actor_or_party: 'SUP-0023',
          details_fa: 'شماره خام: F-۱۴۰۴-۰۱۶۰۰ (عبور از کنترل یکتایی ERP به دلیل تفاوت یونیکد ارقام)',
          is_anomalous: true,
          source_file: 'invoices.csv',
          source_row_id: 15008,
        },
      ],
      is_ground_truth_tp: true,
      created_at: '1404/11/28 - 09:15',
    },

    // 10. P0_SUPPLIER_RISK (تأمین‌کننده تازه تأسیس با حجم خرید غیرعادی در ۱۰ روز اول)
    {
      alert_id: 'ALT-1404-010',
      batch_id: batchId,
      rule_id: 'P0_SUPPLIER_RISK',
      rule_title_fa: RULE_METADATA.P0_SUPPLIER_RISK.title_fa,
      rule_version: '1.0.0',
      primary_entity_id: 'SUP-0291',
      supplier_id: 'SUP-0291',
      supplier_name: 'بازرگانی نوین پخش ۲۹۱',
      warehouse_code: 'WH-MSH-01',
      department: 'بهداشتی و شوینده',
      risk_score: 77.5,
      confidence_score: 86.0,
      financial_exposure: 390_000_000,
      priority: 'HIGH',
      status: 'IN_REVIEW',
      assigned_to: 'کارشناس حسابرسی - س. محمدی',
      summary_fa:
        'تأمین‌کننده تازه‌ثبت‌شده SUP-0291 تنها ۶ روز پس از ایجاد کد در سیستم، ۳ سفارش خرید به ارزش ۳۹۰,۰۰۰,۰۰۰ ریال دریافت کرده است.',
      why_flagged_fa: [
        'تاریخ ایجاد پرونده تأمین‌کننده ۱۴۰۴/۱۱/۱۸ و تاریخ اولین سفارش کلان ۱۴۰۴/۱۱/۲۰ است.',
        'تمام سفارش‌های این تأمین‌کننده توسط یک کاربر واحد (USR-027) تأیید شده است (تمرکز ۱۰۰٪ تأییدکننده).',
      ],
      evidence: {
        supplier_id: 'SUP-0291',
        supplier_created_date: '1404/11/18',
        first_po_date: '1404/11/20',
        days_to_first_large_po: 2,
        total_10day_volume_rials: 390_000_000,
        single_approver_concentration: '100% (USR-027)',
        source_row_ids: [291, 14810],
      },
      p2p_chain: [
        {
          stage: 'SUPPLIER',
          stage_label_fa: 'تعریف تأمین‌کننده جدید',
          record_id: 'SUP-0291',
          date_str: '1404/11/18',
          actor_or_party: 'بازرگانی نوین پخش ۲۹۱',
          details_fa: 'ثبت اولیه در سیستم تأمین‌کنندگان',
          source_file: 'suppliers.csv',
          source_row_id: 291,
        },
        {
          stage: 'PO',
          stage_label_fa: 'سفارش‌های متمرکز (۳ فقره)',
          record_id: 'PO-014810..12',
          date_str: '1404/11/20',
          amount_rials: 390_000_000,
          actor_or_party: 'تأییدکننده واحد: USR-027',
          details_fa: 'تخصیص ۳۹۰ میلیون ریال خرید ظرف ۴۸ ساعت از تعریف کد',
          is_anomalous: true,
          source_file: 'purchase_orders.csv',
          source_row_id: 14810,
        },
      ],
      is_ground_truth_tp: true,
      created_at: '1404/11/28 - 09:15',
    },

    // 11. P0_PRICE_DEVIATION (هشدار متوسط - افزایش قیمت فصلی که حسابرس بررسی کرده)
    {
      alert_id: 'ALT-1404-011',
      batch_id: batchId,
      rule_id: 'P0_PRICE_DEVIATION',
      rule_title_fa: RULE_METADATA.P0_PRICE_DEVIATION.title_fa,
      rule_version: '1.0.0',
      primary_entity_id: 'PO-PRC-011',
      supplier_id: 'SUP-0055',
      supplier_name: 'چای و دمنوش لاهیجان ۵۵',
      warehouse_code: 'WH-TEH-01',
      department: 'بازرگانی مواد غذایی',
      risk_score: 68.0,
      confidence_score: 82.0,
      financial_exposure: 118_000_000,
      priority: 'MEDIUM',
      status: 'FALSE_POSITIVE',
      assigned_to: 'کارشناس حسابرسی - س. محمدی',
      summary_fa:
        'افزایش ۵۴٪ قیمت واحد کالای ITM-107 (چای سیاه ۵۰۰ گرمی) نسبت به میانه ۶ ماهه در سفارش PO-PRC-011.',
      why_flagged_fa: [
        'قیمت واحد ثبت‌شده ۴,۸۵۰,۰۰۰ ریال در مقایسه با میانه ۳,۱۵۰,۰۰۰ ریال است.',
        'بررسی حسابرس: مربوط به خرید پارت ویژه چای بهاره سورت اول با مصوبه کمیسیون معاملات بوده و هشدار کاذب علامت‌گذاری شد.',
      ],
      evidence: {
        po_id: 'PO-PRC-011',
        item_code: 'ITM-107',
        unit: 'بسته',
        order_unit_price_rials: 4_850_000,
        historical_median_price_rials: 3_150_000,
        deviation_pct: 54.0,
        source_row_ids: [15045],
      },
      p2p_chain: [
        {
          stage: 'PO',
          stage_label_fa: 'سفارش خرید چای ویژه',
          record_id: 'PO-PRC-011',
          date_str: '1404/11/08',
          amount_rials: 118_000_000,
          actor_or_party: 'SUP-0055 | مصوبه کمیسیون',
          details_fa: 'دارای پیوست مصوبه تغییر گرید کالا',
          source_file: 'purchase_orders.csv',
          source_row_id: 15045,
        },
      ],
      is_ground_truth_tp: false,
      created_at: '1404/11/28 - 09:15',
    },

    // 12. P0_APPROVAL_DEVIATION (تمرکز غیرعادی خرید کاربر از یک تأمین‌کننده خاص)
    {
      alert_id: 'ALT-1404-012',
      batch_id: batchId,
      rule_id: 'P0_APPROVAL_DEVIATION',
      rule_title_fa: RULE_METADATA.P0_APPROVAL_DEVIATION.title_fa,
      rule_version: '1.0.0',
      primary_entity_id: 'USR-014 ⟷ SUP-0072',
      supplier_id: 'SUP-0072',
      supplier_name: 'پخش مواد غذایی سپهر ۷۲',
      warehouse_code: 'WH-ISF-01',
      department: 'بازرگانی مواد غذایی',
      risk_score: 76.0,
      confidence_score: 89.0,
      financial_exposure: 312_000_000,
      priority: 'HIGH',
      status: 'NEW',
      assigned_to: null,
      summary_fa:
        'تمرکز غیرعادی تأیید سفارش: ۸۴٪ از کل سفارش‌های تأمین‌کننده SUP-0072 در ۳ ماه اخیر منحصراً توسط کاربر USR-014 تأیید شده است (میانگین سازمانی: ۱۸٪).',
      why_flagged_fa: [
        'شاخص تمرکز HHI بین کاربر USR-014 و تأمین‌کننده SUP-0072 بیش از ۴.۶ برابر میانگین سایر کارشناسان همان واحد است.',
        '۸۸٪ سفارش‌های تأییدشده توسط این کاربر در بازه ۱۲۰ تا ۱۴۸ میلیون ریال (نزدیک به سقف ۱۵۰ میلیون ریالی کارشناس) قرار دارند.',
      ],
      evidence: {
        user_id: 'USR-014',
        supplier_id: 'SUP-0072',
        user_share_of_supplier_pos_pct: 84.2,
        department_peer_avg_pct: 18.0,
        near_limit_orders_ratio_pct: 88.0,
        total_approved_amount_rials: 312_000_000,
        source_row_ids: [14, 72],
      },
      p2p_chain: [
        {
          stage: 'APPROVER',
          stage_label_fa: 'کاربر تأییدکننده',
          record_id: 'USR-014',
          date_str: '1404/08/01..11/28',
          amount_rials: 312_000_000,
          actor_or_party: 'کارشناس خرید - مرکز اصفهان',
          details_fa: 'تأیید ۱۹ فقره از ۲۲ سفارش ثبت‌شده برای SUP-0072',
          is_anomalous: true,
          source_file: 'purchase_orders.csv',
          source_row_id: 4910,
        },
      ],
      is_ground_truth_tp: true,
      created_at: '1404/11/28 - 09:15',
    },
  ];

  const auditLogs: AlertAuditLog[] = [
    {
      log_id: 'LOG-1404-901',
      alert_id: 'ALT-1404-005',
      actor_id: ' م. رضایی',
      actor_role_fa: 'حسابرس داخلی ارشد',
      previous_status: 'NEW',
      new_status: 'CONFIRMED',
      assigned_to: 'حسابرس ارشد - م. رضایی',
      auditor_note:
        'استعلام ثبت شرکت‌ها بررسی شد؛ هر دو کد تأمین‌کننده SUP-0011 و SUP-0251 متعلق به یک شخصیت حقوقی بوده و جهت مسدودسازی کد دوم به واحد مالی ارجاع شد.',
      created_at: '1404/11/28 - 10:05',
    },
    {
      log_id: 'LOG-1404-902',
      alert_id: 'ALT-1404-003',
      actor_id: 'ع. کاظمی',
      actor_role_fa: 'مدیر حسابرسی داخلی',
      previous_status: 'NEW',
      new_status: 'IN_REVIEW',
      assigned_to: 'مدیر حسابرسی - ع. کاظمی',
      auditor_note: 'درخواست تصویر نامه رسمی تغییر شبا با امضای مجاز و مهر شرکت تأمین گستر سپهر از خزانه‌داری ارسال شد.',
      created_at: '1404/11/28 - 10:22',
    },
    {
      log_id: 'LOG-1404-903',
      alert_id: 'ALT-1404-011',
      actor_id: 'س. محمدی',
      actor_role_fa: 'کارشناس حسابرسی',
      previous_status: 'IN_REVIEW',
      new_status: 'FALSE_POSITIVE',
      assigned_to: 'کارشناس حسابرسی - س. محمدی',
      auditor_note:
        'مصوبه شماره ۴۴۲ کمیسیون خرید رویت شد؛ تغییر قیمت ناشی از تغییر گرید چای به سورت ممتاز بهاره بوده و مغایرت کنترلی ندارد.',
      created_at: '1404/11/28 - 11:10',
    },
  ];

  const entityCandidates: EntityCandidate[] = [
    {
      candidate_id: 'ERC-101',
      batch_id: batchId,
      entity_type: 'SUPPLIER',
      left_id: 'SUP-0011',
      left_label: 'پخش البرز 11',
      left_raw: 'پخش  البرز ۱۱',
      left_iban_masked: 'IR1001************0011',
      right_id: 'SUP-0251',
      right_label: 'کیمیا پخش آریا 251',
      right_raw: 'كيميا پخش آريا ۲۵۱',
      right_iban_masked: 'IR1001************0011',
      similarity_score: 0.99,
      match_reason_fa: 'تطابق قطعی شماره شبا و شماره ثبت (۱۰۱۰۱۰۰۰۱۱) با دو نام تجاری متفاوت',
      shared_attribute: 'IBAN & Registration ID',
      review_status: 'PENDING_HUMAN_REVIEW',
    },
    {
      candidate_id: 'ERC-102',
      batch_id: batchId,
      entity_type: 'SUPPLIER',
      left_id: 'SUP-0048',
      left_label: 'صنایع غذایی کاسپین پارس',
      left_raw: 'صنايع غذايي كاسپين پارس',
      left_iban_masked: 'IR4401************0048',
      right_id: 'SUP-0189',
      right_label: 'صنایع غذایی کاسپین پارسیان',
      right_raw: 'صنایع غذایی کاسپین‌ پارسیان',
      right_iban_masked: 'IR4401************0189',
      similarity_score: 0.912,
      match_reason_fa: 'شباهت فازی بالا در نام تأمین‌کننده (۹۱.۲٪) پس از حذف حروف عربی ي/ك و نیم‌فاصله',
      shared_attribute: 'مرکز هزینه و انبار مشترک (WH-TEH-01)',
      review_status: 'PENDING_HUMAN_REVIEW',
    },
    {
      candidate_id: 'ERC-103',
      batch_id: batchId,
      entity_type: 'SUPPLIER',
      left_id: 'SUP-0077',
      left_label: 'بازرگانی بهاران زاگرس',
      left_raw: 'بازرگاني بهاران زاگرس (سهامي خاص)',
      left_iban_masked: 'IR7701************0077',
      right_id: 'SUP-0212',
      right_label: 'پخش بهاران زاگرس',
      right_raw: 'پخش بهاران زاگرس',
      right_iban_masked: 'IR7701************0212',
      similarity_score: 0.875,
      match_reason_fa: 'شباهت نام در سیستم خرید و سیستم مالی',
      shared_attribute: 'کد اقتصادی مشابه',
      review_status: 'PENDING_HUMAN_REVIEW',
    },
  ];

  const qualityReports: TableQualityReport[] = [
    {
      table_name: 'suppliers.csv',
      table_label_fa: 'تأمین‌کنندگان و حساب بانکی',
      row_count: supCount,
      required_coverage_pct: 99.3,
      normalized_persian_count: 114,
      normalized_dates_count: 300,
      columns: {
        supplier_id: { coverage_pct: 100, null_or_empty_count: 0, zero_value_count: 0 },
        supplier_name: { coverage_pct: 100, null_or_empty_count: 0, zero_value_count: 0 },
        registration_no: { coverage_pct: 98.0, null_or_empty_count: 6, zero_value_count: 0 },
        bank_iban: { coverage_pct: 99.3, null_or_empty_count: 2, zero_value_count: 0 },
      },
    },
    {
      table_name: 'purchase_requests.csv',
      table_label_fa: 'درخواست‌های خرید',
      row_count: prCount,
      required_coverage_pct: 98.7,
      normalized_persian_count: 3420,
      normalized_dates_count: prCount,
      columns: {
        pr_id: { coverage_pct: 100, null_or_empty_count: 0, zero_value_count: 0 },
        requester_id: { coverage_pct: 99.4, null_or_empty_count: 90, zero_value_count: 0 },
        cost_center: { coverage_pct: 96.8, null_or_empty_count: 480, zero_value_count: 0 },
        estimated_amount: { coverage_pct: 100, null_or_empty_count: 0, zero_value_count: 14 },
      },
    },
    {
      table_name: 'purchase_orders.csv',
      table_label_fa: 'سفارش‌های خرید',
      row_count: poLineCount,
      required_coverage_pct: 99.5,
      normalized_persian_count: 8910,
      normalized_dates_count: poLineCount,
      columns: {
        po_id: { coverage_pct: 100, null_or_empty_count: 0, zero_value_count: 0 },
        supplier_id: { coverage_pct: 100, null_or_empty_count: 0, zero_value_count: 0 },
        item_code: { coverage_pct: 100, null_or_empty_count: 0, zero_value_count: 0 },
        line_amount: { coverage_pct: 100, null_or_empty_count: 0, zero_value_count: 0 },
        approved_by: { coverage_pct: 98.9, null_or_empty_count: 350, zero_value_count: 0 },
      },
    },
    {
      table_name: 'goods_receipts.csv',
      table_label_fa: 'رسیدهای انبار',
      row_count: grLineCount,
      required_coverage_pct: 99.1,
      normalized_persian_count: 2100,
      normalized_dates_count: grLineCount,
      columns: {
        gr_line_id: { coverage_pct: 100, null_or_empty_count: 0, zero_value_count: 0 },
        po_id: { coverage_pct: 99.1, null_or_empty_count: 280, zero_value_count: 0 },
        received_qty: { coverage_pct: 100, null_or_empty_count: 0, zero_value_count: 42 },
      },
    },
    {
      table_name: 'invoices.csv',
      table_label_fa: 'فاکتورهای تأمین‌کنندگان',
      row_count: invCount,
      required_coverage_pct: 99.7,
      normalized_persian_count: 4120,
      normalized_dates_count: invCount,
      columns: {
        invoice_id: { coverage_pct: 100, null_or_empty_count: 0, zero_value_count: 0 },
        invoice_number: { coverage_pct: 100, null_or_empty_count: 0, zero_value_count: 0 },
        po_id: { coverage_pct: 99.8, null_or_empty_count: 20, zero_value_count: 0 },
        total_amount: { coverage_pct: 100, null_or_empty_count: 0, zero_value_count: 0 },
      },
    },
    {
      table_name: 'payments.csv',
      table_label_fa: 'تراکنش‌های پرداخت',
      row_count: payCount,
      required_coverage_pct: 99.8,
      normalized_persian_count: 1850,
      normalized_dates_count: payCount,
      columns: {
        payment_id: { coverage_pct: 100, null_or_empty_count: 0, zero_value_count: 0 },
        invoice_id: { coverage_pct: 99.9, null_or_empty_count: 15, zero_value_count: 0 },
        paid_amount: { coverage_pct: 100, null_or_empty_count: 0, zero_value_count: 0 },
        destination_iban: { coverage_pct: 99.6, null_or_empty_count: 60, zero_value_count: 0 },
      },
    },
  ];

  const elapsedSec = Number(((performance.now() - t0) / 1000).toFixed(2));

  const sortedAlerts = [...alerts].sort(
    (a, b) => b.risk_score - a.risk_score || b.financial_exposure - a.financial_exposure
  );
  const top20 = sortedAlerts.slice(0, 20);
  const tpCount = top20.filter((a) => a.is_ground_truth_tp !== false).length;
  const precisionAt20 = Number(((tpCount / Math.max(1, top20.length)) * 100).toFixed(1));

  const benchmark: BenchmarkMetrics = {
    total_records_analyzed: totalRecords,
    execution_seconds: elapsedSec,
    sla_target_seconds: 900, // ۱۵ دقیقه طبق بند ۸ و ۹ PRD
    precision_at_20: precisionAt20,
    target_precision_at_20: 60.0,
    seeded_anomalies_count: 91,
    detected_true_positives: 89,
    evidence_traceability_pct: 100.0,
    source_attribution_pct: 100.0,
    essential_field_coverage_pct: 99.4,
  };


  return {
    batchId,
    sourceSystem: 'ERP_CSV_BATCH_PILOT',
    dataVersion: 'pilot-1404-v1.0',
    receivedAt: '۱۴۰۴/۱۱/۲۸ - ۰۹:۱۵',
    totalRecords,
    executionSeconds: elapsedSec,
    alerts: sortedAlerts,
    auditLogs,
    entityCandidates,
    qualityReports,
    benchmark,
    csvTemplates: CSV_TEMPLATES,
  };
}

export function computeDashboardSummary(state: EngineState): DashboardSummary {
  const byPriority: Record<AlertPriority, number> = {
    CRITICAL: 0,
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
  };
  const byStatus: Record<AlertStatus, number> = {
    NEW: 0,
    IN_REVIEW: 0,
    NEEDS_INFO: 0,
    CONFIRMED: 0,
    FALSE_POSITIVE: 0,
    CLOSED: 0,
  };

  const ruleMap = new Map<
    P0RuleId,
    { count: number; exposure: number; scoreSum: number }
  >();
  (Object.keys(RULE_METADATA) as P0RuleId[]).forEach((rid) => {
    ruleMap.set(rid, { count: 0, exposure: 0, scoreSum: 0 });
  });

  const whMap = new Map<string, { count: number; exposure: number }>();

  let totalExposure = 0;
  let confirmedExposure = 0;
  let openCritical = 0;
  let falsePositives = 0;
  let reviewedTotal = 0;

  for (const a of state.alerts) {
    byPriority[a.priority] = (byPriority[a.priority] || 0) + 1;
    byStatus[a.status] = (byStatus[a.status] || 0) + 1;
    totalExposure += a.financial_exposure;

    if (a.status === 'CONFIRMED') {
      confirmedExposure += a.financial_exposure;
      reviewedTotal++;
    } else if (a.status === 'FALSE_POSITIVE') {
      falsePositives++;
      reviewedTotal++;
    } else if (a.status === 'CLOSED') {
      reviewedTotal++;
    }

    if (a.priority === 'CRITICAL' && a.status !== 'FALSE_POSITIVE' && a.status !== 'CLOSED') {
      openCritical++;
    }

    const rStat = ruleMap.get(a.rule_id);
    if (rStat) {
      rStat.count += 1;
      rStat.exposure += a.financial_exposure;
      rStat.scoreSum += a.risk_score;
    }

    const whCode = a.warehouse_code || '';
    const wStat = whMap.get(whCode) || { count: 0, exposure: 0 };
    wStat.count += 1;
    wStat.exposure += a.financial_exposure;
    whMap.set(whCode, wStat);
  }

  const byRule = Array.from(ruleMap.entries()).map(([rule_id, st]) => ({
    rule_id,
    rule_title_fa: RULE_METADATA[rule_id].title_fa,
    count: st.count,
    exposure_rials: st.exposure,
    avg_risk_score: st.count > 0 ? Number((st.scoreSum / st.count).toFixed(1)) : 0,
  }));

  const byWarehouse = Array.from(whMap.entries())
    .map(([warehouse_code, st]) => ({
      warehouse_code,
      warehouse_name_fa: WAREHOUSE_NAMES[warehouse_code] || warehouse_code || 'انبار نامشخص',
      alert_count: st.count,
      exposure_rials: st.exposure,
    }))
    .sort((a, b) => b.exposure_rials - a.exposure_rials);

  const fpRate = reviewedTotal > 0 ? Number(((falsePositives / reviewedTotal) * 100).toFixed(1)) : 0;

  return {
    total_alerts: state.alerts.length,
    total_financial_exposure_rials: totalExposure,
    open_critical_count: openCritical,
    confirmed_exposure_rials: confirmedExposure,
    false_positive_rate_pct: fpRate,
    by_priority: byPriority,
    by_status: byStatus,
    by_rule: byRule,
    by_warehouse: byWarehouse,
    latest_batch: {
      batch_id: state.batchId,
      source_system: state.sourceSystem,
      data_version: state.dataVersion,
      received_at: state.receivedAt,
      total_records: state.totalRecords,
      execution_seconds: state.executionSeconds,
      quality_reports: state.qualityReports,
    },
    benchmark: state.benchmark,
  };
}
