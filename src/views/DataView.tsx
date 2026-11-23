import { useRef, useState } from 'react';
import { Download, FileSpreadsheet, Play, Upload } from 'lucide-react';
import { EntityCandidate, TableQualityReport } from '../types';
import { formatRials } from '../engine/p2pEngine';
import { Button, Chip, cx, Empty, PageHead, Panel, Reveal, SectionTitle } from '../ui';

const TEMPLATES = [
  {
    file: 'invoices.csv',
    title: 'فاکتورهای خرید',
    body: 'شمارهٔ فاکتور، شمارهٔ سفارش، تأمین‌کننده، تاریخ و مبلغ. برای فاکتور تکراری و فاکتور بدون سفارش.',
  },
  {
    file: 'purchase_orders.csv',
    title: 'سفارش‌های خرید',
    body: 'کالا، مقدار، قیمت واحد، تأییدکننده و سقف تأیید. برای شکستن سفارش و انحراف قیمت.',
  },
];

export default function DataView({
  files,
  sample,
  quality,
  candidates,
  onFiles,
  onTemplate,
  onDownload,
  onResolve,
}: {
  files: string[];
  sample: boolean;
  quality: TableQualityReport[];
  candidates: EntityCandidate[];
  onFiles: (files: FileList) => void;
  onTemplate: (name: string) => void;
  onDownload: (name: string) => void;
  onResolve: (id: string, d: 'MERGED_CONFIRMED' | 'SEPARATE_ENTITIES') => void;
}) {
  const input = useRef<HTMLInputElement | null>(null);
  const [over, setOver] = useState(false);

  return (
    <div className="space-y-10">
      <PageHead
        eyebrow="داده"
        title="فایل‌ها، کیفیت داده و تأمین‌کننده‌های مشابه"
        lead="فایل‌ها روی همین رایانه پردازش می‌شوند و به جایی فرستاده نمی‌شوند. ترازبان چیزی را در نرم‌افزار حسابداری تغییر نمی‌دهد."
      />

      <Reveal>
        <Panel inner="p-3">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(false);
              if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files);
            }}
            className={cx(
              'flex flex-col items-center rounded-[18px] border-2 border-dashed px-6 py-12 text-center transition-colors duration-500 ease-spring',
              over ? 'border-level bg-tint/60' : 'border-ink/15 bg-paper'
            )}
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white ring-1 ring-ink/10">
              <Upload className="h-6 w-6 text-ink" strokeWidth={1.5} />
            </span>
            <div className="mt-5 text-[19px] font-bold">فایل CSV فاکتورها یا سفارش‌های خرید را اینجا رها کنید</div>
            <p className="mt-2 max-w-lg text-[15px] leading-8 text-muted">
              ستون‌ها باید مثل قالب‌های پایین باشد. حروف عربی، ارقام فارسی و تاریخ شمسی یکسان‌سازی می‌شوند.
            </p>
            <input
              ref={input}
              type="file"
              accept=".csv,text/csv"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) onFiles(e.target.files);
                e.target.value = '';
              }}
            />
            <div className="mt-6">
              <Button icon={<Upload className="h-4 w-4" strokeWidth={1.5} />} onClick={() => input.current?.click()}>
                انتخاب فایل
              </Button>
            </div>
            {(files.length > 0 || sample) && (
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {sample && <Chip tone="level">دادهٔ نمونه</Chip>}
                {files.map((f) => (
                  <Chip key={f}>{f}</Chip>
                ))}
              </div>
            )}
          </div>
        </Panel>
      </Reveal>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {TEMPLATES.map((t, i) => (
          <Reveal key={t.file} delay={i * 0.08}>
            <Panel className="h-full" inner="flex h-full flex-col p-6 md:p-7">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-tint text-level">
                  <FileSpreadsheet className="h-5 w-5" strokeWidth={1.5} />
                </span>
                <div>
                  <div className="text-[17px] font-bold">{t.title}</div>
                  <div className="text-[13px] text-muted" dir="ltr">
                    {t.file}
                  </div>
                </div>
              </div>
              <p className="mt-4 flex-1 text-[15px] leading-8 text-muted">{t.body}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button variant="ghost" icon={<Download className="h-4 w-4" strokeWidth={1.5} />} onClick={() => onDownload(t.file)}>
                  دانلود قالب
                </Button>
                <Button variant="quiet" onClick={() => onTemplate(t.file)}>
                  <span className="inline-flex items-center gap-2">
                    <Play className="h-4 w-4" strokeWidth={1.5} />
                    اجرای قالب نمونه
                  </span>
                </Button>
              </div>
            </Panel>
          </Reveal>
        ))}
      </div>

      <Reveal>
        <Panel inner="pb-6">
          <SectionTitle
            title="کیفیت داده"
            hint="برای هر فایل: چند سطر، چه سهمی از ستون‌های لازم پر است، و کدام ستون خالی یا صفر دارد."
          />
          {quality.length === 0 ? (
            <p className="px-6 pt-3 text-[15px] text-muted md:px-8">هنوز فایلی بررسی نشده است.</p>
          ) : (
            <div className="mt-4 space-y-3 px-4 md:px-6">
              {quality.map((q) => (
                <div key={q.table_name} className="rounded-2xl bg-paper px-5 py-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <div>
                      <div className="text-[16px] font-bold">{q.table_label_fa}</div>
                      <div className="num text-[13px] text-muted">{formatRials(q.row_count)} سطر</div>
                    </div>
                    <div className="num text-[15px] font-bold text-level">
                      {q.required_coverage_pct.toLocaleString('fa-IR')}٪ ستون‌های لازم پر است
                    </div>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink/[0.06]">
                    <div className="h-full rounded-full bg-level" style={{ width: `${q.required_coverage_pct}%` }} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {Object.entries(q.columns).map(([col, m]) => (
                      <span
                        key={col}
                        className={cx(
                          'num rounded-full px-3 py-0.5 text-[13px]',
                          m.null_or_empty_count > 0 ? 'bg-amber-tint text-amber' : 'bg-white text-muted ring-1 ring-ink/[0.06]'
                        )}
                      >
                        <span dir="ltr">{col}</span>
                        {m.null_or_empty_count > 0 && `: ${formatRials(m.null_or_empty_count)} خالی`}
                        {m.zero_value_count > 0 && `، ${formatRials(m.zero_value_count)} صفر`}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </Reveal>

      <Reveal>
        <Panel inner="pb-6">
          <SectionTitle
            title="تأمین‌کننده‌های مشابه"
            hint="نام‌هایی که شبیه هم‌اند ولی کدشان فرق دارد. تا شما تأیید نکنید، یکی حساب نمی‌شوند."
          />
          {candidates.length === 0 ? (
            <Empty title="موردی برای بررسی نیست" />
          ) : (
            <div className="mt-4 space-y-3 px-4 md:px-6">
              {candidates.map((c) => (
                <div key={c.candidate_id} className="rounded-2xl bg-paper p-4 md:p-5">
                  <div className="grid grid-cols-1 items-center gap-3 md:grid-cols-[1fr_auto_1fr]">
                    {[
                      [c.left_label, c.left_id, c.left_raw, c.left_iban_masked],
                      [c.right_label, c.right_id, c.right_raw, c.right_iban_masked],
                    ].map(([label, id, raw, iban], idx) => (
                      <div key={idx} className={cx('rounded-2xl bg-white px-4 py-3 ring-1 ring-ink/[0.06]', idx === 1 && 'md:order-3')}>
                        <div className="text-[16px] font-bold">{label}</div>
                        <div className="text-[13px] text-muted">«{raw}»</div>
                        <div className="num mt-1 text-[13px] text-muted" dir="ltr">
                          {id}  {iban}
                        </div>
                      </div>
                    ))}
                    <div className="num text-center text-[14px] font-bold text-level md:order-2">
                      {Math.round(c.similarity_score * 100).toLocaleString('fa-IR')}٪ شبیه
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-[14px] leading-7 text-muted">
                      {c.match_reason_fa}
                      {c.shared_attribute && `، مشترک: ${c.shared_attribute}`}
                    </p>
                    {c.review_status === 'PENDING_HUMAN_REVIEW' ? (
                      <div className="flex gap-2">
                        <Button variant="ghost" onClick={() => onResolve(c.candidate_id, 'SEPARATE_ENTITIES')}>
                          جدا هستند
                        </Button>
                        <Button onClick={() => onResolve(c.candidate_id, 'MERGED_CONFIRMED')}>یکی هستند</Button>
                      </div>
                    ) : (
                      <Chip tone="level">{c.review_status === 'MERGED_CONFIRMED' ? 'یکی شدند' : 'جدا ماندند'}</Chip>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </Reveal>
    </div>
  );
}
