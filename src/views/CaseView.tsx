import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, FileText } from 'lucide-react';
import { AlertAuditLog, AlertStatus, RiskAlert } from '../types';
import { formatMillionRials, formatRials, STATUS_LABELS, WAREHOUSE_NAMES } from '../engine/p2pEngine';
import { Button, cx, Field, inputClass, PriorityChip, Panel, Reveal, SectionTitle, StatusChip, Vial } from '../ui';

export const AUDITORS = [
  { name: 'م. رضایی', role: 'حسابرس ارشد' },
  { name: 'ع. کاظمی', role: 'مدیر حسابرسی' },
  { name: 'س. محمدی', role: 'کارشناس حسابرسی' },
  { name: 'ن. فرهادی', role: 'کنترلر مالی' },
];

const DECISIONS: AlertStatus[] = ['IN_REVIEW', 'NEEDS_INFO', 'CONFIRMED', 'FALSE_POSITIVE', 'CLOSED'];

export default function CaseView({
  alert,
  logs,
  position,
  onBack,
  onPrev,
  onNext,
  onDecide,
}: {
  alert: RiskAlert;
  logs: AlertAuditLog[];
  position: { index: number; count: number } | null;
  onBack: () => void;
  onPrev: (() => void) | null;
  onNext: (() => void) | null;
  onDecide: (d: { status: AlertStatus; assignee: string; note: string }) => void;
}) {
  const [status, setStatus] = useState<AlertStatus>(alert.status === 'NEW' ? 'IN_REVIEW' : alert.status);
  const [assignee, setAssignee] = useState<string>(alert.assigned_to || `${AUDITORS[0].role} - ${AUDITORS[0].name}`);
  const [note, setNote] = useState('');

  useEffect(() => {
    setStatus(alert.status === 'NEW' ? 'IN_REVIEW' : alert.status);
    setAssignee(alert.assigned_to || `${AUDITORS[0].role} - ${AUDITORS[0].name}`);
    setNote('');
  }, [alert.alert_id]);

  const place = alert.warehouse_code ? WAREHOUSE_NAMES[alert.warehouse_code] || alert.warehouse_code : 'نامشخص';
  const assignees = AUDITORS.map((a) => `${a.role} - ${a.name}`);
  if (alert.assigned_to && !assignees.includes(alert.assigned_to)) assignees.unshift(alert.assigned_to);

  return (
    <div className="space-y-8">
      <Reveal className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="quiet" onClick={onBack} className="ps-3">
          <span className="inline-flex items-center gap-2">
            <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
            همهٔ هشدارها
          </span>
        </Button>
        {position && (
          <div className="flex items-center gap-2">
            <span className="num text-[14px] text-muted">
              هشدار {formatRials(position.index + 1)} از {formatRials(position.count)}
            </span>
            <button
              type="button"
              aria-label="هشدار قبلی"
              disabled={!onPrev}
              onClick={() => onPrev?.()}
              className="glass-tile flex h-11 w-11 cursor-pointer items-center justify-center rounded-full transition-all duration-500 ease-spring hover:bg-white/80 active:scale-95 disabled:cursor-default disabled:opacity-40"
            >
              <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
            </button>
            <button
              type="button"
              aria-label="هشدار بعدی"
              disabled={!onNext}
              onClick={() => onNext?.()}
              className="glass-tile flex h-11 w-11 cursor-pointer items-center justify-center rounded-full transition-all duration-500 ease-spring hover:bg-white/80 active:scale-95 disabled:cursor-default disabled:opacity-40"
            >
              <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
            </button>
          </div>
        )}
      </Reveal>

      <Reveal>
        <Panel inner="p-6 md:p-8">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 max-w-3xl">
              <div className="flex flex-wrap gap-2">
                <PriorityChip priority={alert.priority} />
                <StatusChip status={alert.status} />
              </div>
              <h1 className="mt-4 text-[28px] font-extrabold leading-[1.4] md:text-[32px]">{alert.rule_title_fa}</h1>
              <p className="mt-3 text-[16px] leading-8 text-ink/85">{alert.summary_fa}</p>
            </div>
            <div className="flex shrink-0 flex-col items-start gap-2 lg:items-end">
              <Vial score={alert.risk_score} width={200} />
              <div className="num text-[15px] font-semibold text-muted">
                شدت ریسک {alert.risk_score.toLocaleString('fa-IR')} از ۱۰۰
              </div>
            </div>
          </div>
          <dl className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['مبلغ درگیر', `${formatRials(alert.financial_exposure)} ریال`, formatMillionRials(alert.financial_exposure)],
              ['اطمینان', `${alert.confidence_score.toLocaleString('fa-IR')}٪`, alert.confidence_basis_fa ?? 'بر پایهٔ کامل بودن داده'],
              ['تأمین‌کننده', alert.supplier_name || 'نامشخص', place],
              ['مسئول بررسی', alert.assigned_to || 'تعیین نشده', alert.primary_entity_id],
            ].map(([k, v, sub]) => (
              <div key={k} className="glass-tile rounded-2xl px-5 py-4">
                <dt className="text-[13px] text-muted">{k}</dt>
                <dd className="num mt-1 truncate text-[17px] font-bold">{v}</dd>
                <dd className="num truncate text-[13px] text-muted">{sub}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      </Reveal>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-7">
          <Reveal>
            <Panel inner="pb-6">
              <SectionTitle title="چرا این هشدار" />
              <ul className="mt-4 space-y-3 px-6 md:px-8">
                {alert.why_flagged_fa.map((r, i) => (
                  <li key={i} className="flex gap-3 text-[15px] leading-8">
                    <span className="mt-3 h-2 w-2 shrink-0 rounded-full bg-level" />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          </Reveal>

          <Reveal>
            <Panel inner="pb-6">
              <SectionTitle title="زنجیرهٔ سندها" hint="هر سند با نام فایل و شمارهٔ سطر منبعش." />
              <ol className="relative mt-5 px-6 md:px-8">
                {alert.p2p_chain.map((step, i) => {
                  const last = i === alert.p2p_chain.length - 1;
                  return (
                    <li key={i} className="relative flex gap-4 pb-6 last:pb-0">
                      {!last && <span className="absolute right-[19px] top-11 bottom-0 w-px bg-ink/15" aria-hidden="true" />}
                      <span
                        className={cx(
                          'relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ring-1',
                          step.is_anomalous ? 'bg-flag-tint/90 text-flag ring-flag/30' : 'bg-white/80 text-ink ring-white shadow-[0_4px_12px_-6px_rgba(15,33,56,0.35)]'
                        )}
                      >
                        <FileText className="h-4 w-4" strokeWidth={1.5} />
                      </span>
                      <div
                        className={cx(
                          'min-w-0 flex-1 rounded-2xl px-5 py-4',
                          step.is_anomalous ? 'bg-flag/[0.08] shadow-[inset_0_0_0_1px_rgba(207,59,51,0.16),inset_0_1px_0_rgba(255,255,255,0.8)]' : 'glass-tile'
                        )}
                      >
                        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                          <span className="text-[15px] font-bold">{step.stage_label_fa}</span>
                          {typeof step.amount_rials === 'number' && step.amount_rials > 0 && (
                            <span className="num text-[15px] font-bold">{formatRials(step.amount_rials)} ریال</span>
                          )}
                        </div>
                        <div className="num mt-1 text-[14px] leading-7 text-ink/85">{step.details_fa}</div>
                        <div className="num mt-1 text-[13px] text-muted">
                          {step.record_id}، {step.date_str}، {step.actor_or_party}
                        </div>
                        <div className="num mt-1 text-[13px] text-muted">
                          منبع: {step.source_file}، سطر {formatRials(step.source_row_id)}
                          {step.is_anomalous && <span className="mr-2 font-semibold text-flag">محل مغایرت</span>}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </Panel>
          </Reveal>

          <Reveal>
            <Panel>
              <details className="group">
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between px-6 py-4 text-[16px] font-bold md:px-8">
                  جزئیات فنی شواهد
                  <span className="text-[14px] font-medium text-muted group-open:hidden">نمایش</span>
                  <span className="hidden text-[14px] font-medium text-muted group-open:inline">بستن</span>
                </summary>
                <div className="divide-y divide-ink/[0.06] px-6 pb-5 md:px-8">
                  {Object.entries(alert.evidence).map(([k, v]) => (
                    <div key={k} className="flex flex-wrap items-baseline justify-between gap-3 py-2.5 text-[14px]">
                      <span className="text-muted" dir="ltr">{k}</span>
                      <span className="num font-medium">
                        {Array.isArray(v) ? v.join('، ') : typeof v === 'number' ? formatRials(v) : String(v ?? '')}
                      </span>
                    </div>
                  ))}
                </div>
              </details>
            </Panel>
          </Reveal>
        </div>

        <div className="space-y-6 lg:sticky lg:top-28 lg:col-span-5">
          <Reveal delay={0.08}>
            <Panel inner="p-6 md:p-7">
              <h2 className="text-[19px] font-bold">تصمیم شما</h2>
              <form
                className="mt-5 space-y-5"
                onSubmit={(e) => {
                  e.preventDefault();
                  onDecide({ status, assignee, note });
                  setNote('');
                }}
              >
                <fieldset>
                  <legend className="mb-2 text-[14px] font-semibold">وضعیت</legend>
                  <div className="grid grid-cols-2 gap-2">
                    {DECISIONS.map((d) => (
                      <label
                        key={d}
                        className={cx(
                          'flex min-h-11 cursor-pointer items-center gap-2 rounded-2xl px-3 text-[14px] font-semibold ring-1 transition-all duration-500 ease-spring has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-level',
                          status === d ? 'liquid-ink ring-transparent' : 'glass-tile text-ink ring-transparent hover:bg-white/75'
                        )}
                      >
                        <input type="radio" name="decision" value={d} checked={status === d} onChange={() => setStatus(d)} className="sr-only" />
                        <span
                          className={cx(
                            'flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
                            status === d ? 'bg-white/20' : 'ring-1 ring-ink/20'
                          )}
                        >
                          {status === d && <Check className="h-3 w-3" strokeWidth={2} />}
                        </span>
                        {STATUS_LABELS[d]}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <Field label="مسئول بررسی">
                  <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className={inputClass}>
                    {assignees.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="یادداشت">
                  <textarea
                    rows={4}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="سندهایی که دیدید، نامهٔ استعلام، مصوبهٔ کمیسیون معاملات، یا دلیل رد هشدار"
                    className={cx(inputClass, 'py-3 leading-7')}
                  />
                </Field>
                <Button type="submit" className="w-full justify-between" icon={<Check className="h-4 w-4" strokeWidth={1.5} />}>
                  ثبت تصمیم
                </Button>
              </form>
            </Panel>
          </Reveal>

          <Reveal delay={0.12}>
            <Panel inner="pb-5">
              <SectionTitle title="سابقهٔ تصمیم‌ها" />
              {logs.length === 0 ? (
                <p className="px-6 pt-3 text-[14px] text-muted md:px-8">هنوز تصمیمی برای این هشدار ثبت نشده است.</p>
              ) : (
                <ol className="mt-3 space-y-3 px-4 md:px-6">
                  {logs.map((l) => (
                    <li key={l.log_id} className="glass-tile rounded-2xl px-4 py-3">
                      <div className="flex flex-wrap items-baseline justify-between gap-2 text-[13px] text-muted">
                        <span className="font-semibold text-ink">
                          {l.actor_id}، {l.actor_role_fa}
                        </span>
                        <span className="num">{l.created_at}</span>
                      </div>
                      <div className="mt-1 text-[14px]">
                        {l.previous_status ? STATUS_LABELS[l.previous_status] : 'آغاز'}
                        <span className="mx-2 text-muted">←</span>
                        <span className="font-semibold">{STATUS_LABELS[l.new_status]}</span>
                      </div>
                      {l.auditor_note && <p className="mt-1 text-[14px] leading-7 text-ink/85">{l.auditor_note}</p>}
                    </li>
                  ))}
                </ol>
              )}
            </Panel>
          </Reveal>
        </div>
      </div>
    </div>
  );
}
