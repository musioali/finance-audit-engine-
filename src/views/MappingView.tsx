import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { NeedsMapping } from '../api';
import { formatRials } from '../engine/p2pEngine';
import { Button, Chip, cx, inputClass, PageHead, Panel, Reveal } from '../ui';

/** Asks once which column of an unfamiliar export is which field. The answer is saved for files with the same columns. */
export default function MappingView({
  item,
  waiting,
  onConfirm,
  onCancel,
}: {
  item: NeedsMapping;
  waiting: number;
  onConfirm: (kind: string, mapping: Record<string, string>) => Promise<void>;
  onCancel: () => void;
}) {
  const [kind, setKind] = useState(item.kind);
  const [maps, setMaps] = useState(item.suggestions);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setKind(item.kind);
    setMaps(item.suggestions);
    setBusy(false);
  }, [item.upload_id]);

  const spec = item.kinds.find((k) => k.name === kind) ?? item.kinds[0];
  const mapping = maps[spec.name] ?? {};
  const missing = spec.fields.filter((f) => f.required && !mapping[f.name]);

  const choose = (field: string, column: string) => {
    const next: Record<string, string> = {};
    for (const [f, c] of Object.entries(mapping)) if (c !== column) next[f] = c;
    if (column) next[field] = column;
    setMaps({ ...maps, [spec.name]: next });
  };

  const samples = (column: string | undefined) => {
    const i = column ? item.headers.indexOf(column) : -1;
    return i < 0 ? [] : item.sample_rows.map((r) => (r[i] ?? '').trim()).filter(Boolean).slice(0, 2);
  };

  return (
    <div className="space-y-8">
      <PageHead
        eyebrow="ستون‌های فایل"
        title="هر ستون این فایل چیست؟"
        lead={`ترازبان ستون‌های «${item.file_name}» را از قبل نمی‌شناسد. یک بار مشخص کنید؛ فایل‌های بعدی با همین ستون‌ها بدون پرسش خوانده می‌شوند.`}
      />

      <Reveal>
        <Panel inner="p-5 md:p-7">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <span className="text-[15px] font-semibold">این فایل</span>
            <div className="glass-well flex w-fit flex-wrap items-center gap-1 rounded-full p-1" role="group" aria-label="نوع فایل">
              {item.kinds.map((k) => (
                <button
                  key={k.name}
                  type="button"
                  aria-pressed={spec.name === k.name}
                  onClick={() => setKind(k.name)}
                  className={cx(
                    'min-h-11 cursor-pointer rounded-full px-4 text-[14px] font-semibold transition-all duration-500 ease-spring',
                    spec.name === k.name
                      ? 'bg-white/90 text-ink shadow-[inset_0_1px_0_#fff,0_6px_16px_-8px_rgba(15,33,56,0.45)]'
                      : 'text-muted hover:text-ink'
                  )}
                >
                  {k.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 divide-y divide-ink/[0.06]">
            {spec.fields.map((f) => {
              const column = mapping[f.name];
              const seen = samples(column);
              return (
                <div key={f.name} className="grid grid-cols-1 items-center gap-2 py-3 md:grid-cols-[200px_minmax(0,1fr)_minmax(0,1fr)] md:gap-4">
                  <div className="flex items-center gap-2 text-[15px] font-semibold">
                    {f.label}
                    {f.required && <Chip tone="amber">لازم</Chip>}
                  </div>
                  <select
                    aria-label={f.label}
                    value={column ?? ''}
                    onChange={(e) => choose(f.name, e.target.value)}
                    className={inputClass}
                  >
                    <option value="">این ستون در فایل نیست</option>
                    {item.headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                  <div className="num truncate text-[13px] text-muted">{seen.length > 0 && `نمونه: ${seen.join('، ')}`}</div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <p className="text-[14px] leading-7 text-muted">
              {missing.length > 0
                ? `برای خواندن فایل، ستون این موارد را انتخاب کنید: ${missing.map((f) => f.label).join('، ')}.`
                : waiting > 0
                ? `بعد از این، ${formatRials(waiting)} فایل دیگر هم منتظر است.`
                : 'ستون‌هایی که انتخاب نکنید کنار گذاشته می‌شوند.'}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="quiet" onClick={onCancel} disabled={busy}>
                انصراف
              </Button>
              <Button
                icon={<Check className="h-4 w-4" strokeWidth={1.5} />}
                disabled={busy || missing.length > 0}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await onConfirm(spec.name, mapping);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? 'در حال بررسی' : 'خواندن فایل'}
              </Button>
            </div>
          </div>
        </Panel>
      </Reveal>
    </div>
  );
}
