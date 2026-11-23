import { ArrowLeft } from 'lucide-react';
import { Button, Chip, Panel, Reveal, Vial } from '../ui';

// The order is the product's: data arrives, Tarazban learns and checks, the auditor decides.
const STEPS = [
  {
    title: 'داده می‌رسد',
    body: 'خروجی نرم‌افزار حسابداری، یعنی فاکتورها و سفارش‌های خرید، روی سرور خود شرکت به ترازبان داده می‌شود. ترازبان فقط می‌خواند و چیزی را در حسابداری تغییر نمی‌دهد.',
  },
  {
    title: 'رفتار عادی را یاد می‌گیرد و همه را بررسی می‌کند',
    body: 'از سابقهٔ هر تأمین‌کننده یاد می‌گیرد چه مبلغ‌هایی همیشگی است و فاکتورهایش معمولاً چقدر است. بعد همهٔ سطرها را، نه نمونه، با قاعده‌های حسابرسی و یک مدل یادگیری ماشین بررسی می‌کند.',
  },
  {
    title: 'حسابرس تصمیم می‌گیرد',
    body: 'هر هشدار دلیلش را به زبان ساده و سندهایش را تا نام فایل و شمارهٔ سطر نشان می‌دهد. تصمیم حسابرس با جزئیات هشدار ثبت می‌شود تا ترازبان در مرحلهٔ بعد از همین تصمیم‌ها یاد بگیرد.',
  },
];

const ON_REAL_FILES = [
  'فاکتور تکراری',
  'فاکتور بدون سفارش خرید',
  'شکستن سفارش زیر سقف تأیید',
  'انحراف قیمت خرید',
  'مبلغ غیرعادی برای تأمین‌کننده',
  'ترکیب نادر با یادگیری ماشین',
];

const SAMPLE_ONLY = ['تغییر حساب بانکی تأمین‌کننده', 'تطبیق با رسید انبار', 'انحراف از سطح اختیار تأیید'];

const FA = '۰۱۲۳۴۵۶۷۸۹';

export default function Guide({
  onCase,
  onOverview,
  repoUrl,
}: {
  onCase: () => void;
  onOverview: () => void;
  repoUrl: string;
}) {
  return (
    <div className="mx-auto max-w-4xl py-6 md:py-10">
      <Reveal className="flex flex-col items-center text-center">
        <Vial score={0} width={220} settle />
        <h1 className="mt-9 text-[30px] font-extrabold leading-[1.4] md:text-[40px]">
          همهٔ خریدها و پرداخت‌ها، هر روز بررسی‌شده
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-[17px] leading-9 text-muted">
          حسابرسی معمولاً ماه‌ها بعد از پرداخت و روی چند نمونه انجام می‌شود. ترازبان همهٔ سندهای خرید تا پرداخت را
          بررسی می‌کند و هر مورد غیرعادی را با شواهدش، به ترتیب اهمیت، جلوی حسابرس می‌گذارد.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button icon={<ArrowLeft className="h-4 w-4" strokeWidth={1.5} />} onClick={onCase}>
            باز کردن یک پرونده
          </Button>
          <Button variant="ghost" onClick={onOverview}>
            دیدن نمای کلی
          </Button>
        </div>
      </Reveal>

      <section aria-labelledby="how" className="mt-14">
        <Reveal>
          <h2 id="how" className="text-center text-[20px] font-bold">
            چطور کار می‌کند
          </h2>
        </Reveal>
        <ol className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title}>
              <Reveal delay={0.08 * i} className="glass-tile h-full rounded-[22px] px-5 py-5">
                <span
                  aria-hidden="true"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-level/[0.12] text-[16px] font-bold text-level shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]"
                >
                  {FA[i + 1]}
                </span>
                <h3 className="mt-4 text-[16px] font-bold leading-8">{s.title}</h3>
                <p className="mt-1 text-[14px] leading-7 text-muted">{s.body}</p>
              </Reveal>
            </li>
          ))}
        </ol>
      </section>

      <Reveal className="mt-10">
        <Panel inner="px-6 py-6 md:px-8">
          <h2 className="text-[18px] font-bold">در این نسخهٔ نمایشی</h2>
          <p className="mt-2 text-[15px] leading-8 text-muted">
            داده ساختگی است. هشدارهایی که برچسب <span className="font-semibold text-level">ساختهٔ موتور</span> دارند را خود
            موتور ترازبان، هنگام ساخت همین صفحه، روی این داده پیدا کرده است؛ یکی از آن‌ها نشان می‌دهد ترازبان از دو تصمیم
            قبلی حسابرس چه یاد گرفته. بقیهٔ هشدارها دستی نوشته شده‌اند تا همهٔ صفحه‌ها دیده شوند. موتور روی سرور خود شرکت
            اجرا می‌شود و این صفحه به آن وصل نیست، پس فایل خودتان را اینجا نمی‌توانید بررسی کنید.
          </p>
          <div className="mt-5 text-[14px] font-bold">روی فایل واقعی کار می‌کند</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {ON_REAL_FILES.map((t) => (
              <Chip key={t} tone="level">
                {t}
              </Chip>
            ))}
          </div>
          <div className="mt-5 text-[14px] font-bold">فعلاً فقط در دادهٔ نمونه</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {SAMPLE_ONLY.map((t) => (
              <Chip key={t}>{t}</Chip>
            ))}
          </div>
        </Panel>
      </Reveal>

      <Reveal className="mt-10 flex flex-col items-center gap-3 text-center">
        <Button icon={<ArrowLeft className="h-4 w-4" strokeWidth={1.5} />} onClick={onCase}>
          باز کردن یک پرونده
        </Button>
        <a
          href={repoUrl}
          className="inline-flex min-h-11 items-center rounded-full px-4 text-[14px] font-semibold text-level underline-offset-4 hover:underline"
        >
          کد و راهنمای نصب در گیت‌هاب
        </a>
      </Reveal>
    </div>
  );
}
