import { ArrowLeft } from 'lucide-react';
import { AlertStatus, DashboardSummary, P0RuleId, RiskAlert } from '../types';
import { formatMillionRials, formatRials, STATUS_LABELS } from '../engine/p2pEngine';
import { AlertRow, Button, cx, PageHead, Panel, Reveal, SectionTitle } from '../ui';

const STATUS_ORDER: AlertStatus[] = ['NEW', 'IN_REVIEW', 'NEEDS_INFO', 'CONFIRMED', 'FALSE_POSITIVE', 'CLOSED'];

export default function Overview({
  summary,
  alerts,
  sourceLabel,
  onOpen,
  onRule,
  onStatus,
  onCritical,
  onAll,
}: {
  summary: DashboardSummary;
  alerts: RiskAlert[];
  sourceLabel: string;
  onOpen: (a: RiskAlert) => void;
  onRule: (r: P0RuleId) => void;
  onStatus: (s: AlertStatus) => void;
  onCritical: () => void;
  onAll: () => void;
}) {
  const maxRule = Math.max(1, ...summary.by_rule.map((r) => r.exposure_rials));
  const open = summary.total_alerts - summary.by_status.CLOSED - summary.by_status.FALSE_POSITIVE;

  return (
    <div className="space-y-10">
      <PageHead
        eyebrow="نمای کلی"
        title="وضعیت ریسک خرید تا پرداخت"
        lead={`${formatRials(summary.total_alerts)} هشدار از ${sourceLabel}، به ترتیب اهمیت.`}
        actions={
          <Button icon={<ArrowLeft className="h-4 w-4" strokeWidth={1.5} />} onClick={onAll}>
            همهٔ هشدارها
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <Reveal className="lg:col-span-7 lg:row-span-2">
          <Panel className="h-full" inner="pb-4">
            <SectionTitle title="مبلغ درگیر، به تفکیک قاعده" hint="روی هر قاعده بزنید تا هشدارهای همان قاعده را ببینید." />
            <div className="px-6 pt-5 md:px-8">
              <div className="num text-[36px] font-extrabold leading-tight text-ink">
                {formatMillionRials(summary.total_financial_exposure_rials)}
              </div>
              <div className="mt-1 text-[14px] text-muted">در {formatRials(open)} هشدار باز</div>
            </div>
            <div className="mt-5 px-3 md:px-5">
              {summary.by_rule.map((r) => (
                <button
                  key={r.rule_id}
                  type="button"
                  disabled={r.count === 0}
                  onClick={() => onRule(r.rule_id)}
                  className="group block w-full cursor-pointer rounded-2xl px-3 py-3 text-right transition-colors duration-500 ease-spring hover:bg-white/55 disabled:cursor-default disabled:hover:bg-transparent"
                >
                  <div className="flex items-baseline justify-between gap-4">
                    <span className={cx('text-[15px] font-semibold', r.count ? 'text-ink' : 'text-muted')}>
                      {r.rule_title_fa}
                    </span>
                    <span className="num shrink-0 text-[14px] text-muted">
                      {r.count ? `${formatRials(r.count)} هشدار، ${formatMillionRials(r.exposure_rials)}` : 'بدون هشدار'}
                    </span>
                  </div>
                  <div className="glass-well mt-2 h-2.5 overflow-hidden rounded-full">
                    <div
                      className="h-full rounded-full bg-[linear-gradient(180deg,#2c4c78,#0f2138)] shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] transition-all duration-700 ease-spring group-hover:bg-[linear-gradient(180deg,#22a47f,#138a6b)]"
                      style={{ width: `${r.count ? Math.max(3, (r.exposure_rials / maxRule) * 100) : 0}%` }}
                    />
                  </div>
                </button>
              ))}
            </div>
          </Panel>
        </Reveal>

        <Reveal className="lg:col-span-5" delay={0.08}>
          <Panel className="h-full" inner="flex flex-col justify-between p-6 md:p-8">
            <div>
              <div className="text-[15px] font-semibold text-muted">هشدار بحرانی باز</div>
              <div className="num mt-2 text-[44px] font-extrabold leading-none text-flag">
                {formatRials(summary.open_critical_count)}
              </div>
              <p className="mt-3 text-[14px] leading-7 text-muted">
                این‌ها اول بررسی شوند. هر کدام شواهدش را تا سند و سطر منبع نشان می‌دهد.
              </p>
            </div>
            <div className="mt-6">
              <Button variant="ghost" icon={<ArrowLeft className="h-4 w-4" strokeWidth={1.5} />} onClick={onCritical}>
                بررسی هشدارهای بحرانی
              </Button>
            </div>
          </Panel>
        </Reveal>

        <Reveal className="lg:col-span-5" delay={0.16}>
          <Panel className="h-full" inner="p-6 md:p-8">
            <div className="text-[15px] font-semibold text-muted">تأییدشده توسط حسابرس</div>
            <div className="num mt-2 text-[28px] font-extrabold text-ink">
              {formatMillionRials(summary.confirmed_exposure_rials)}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="glass-tile rounded-2xl px-4 py-3">
                <div className="text-[13px] text-muted">ناهنجاری تأییدشده</div>
                <div className="num text-[20px] font-bold">{formatRials(summary.by_status.CONFIRMED)}</div>
              </div>
              <div className="glass-tile rounded-2xl px-4 py-3">
                <div className="text-[13px] text-muted">هشدار نادرست</div>
                <div className="num text-[20px] font-bold">{formatRials(summary.by_status.FALSE_POSITIVE)}</div>
              </div>
            </div>
          </Panel>
        </Reveal>

        <Reveal className="lg:col-span-7">
          <Panel className="h-full" inner="pb-4">
            <SectionTitle title="به تفکیک انبار و مرکز پخش" />
            <div className="mt-3 px-3 md:px-5">
              {summary.by_warehouse.map((w) => (
                <div key={w.warehouse_code} className="flex items-center justify-between gap-4 rounded-2xl px-3 py-3">
                  <div>
                    <div className="text-[15px] font-semibold">{w.warehouse_name_fa}</div>
                    <div className="num text-[13px] text-muted">{formatRials(w.alert_count)} هشدار</div>
                  </div>
                  <div className="num text-[15px] font-bold">{formatMillionRials(w.exposure_rials)}</div>
                </div>
              ))}
            </div>
          </Panel>
        </Reveal>

        <Reveal className="lg:col-span-5" delay={0.08}>
          <Panel className="h-full" inner="pb-4">
            <SectionTitle title="گردش کار بررسی" />
            <div className="mt-3 grid grid-cols-2 gap-2 px-4 md:px-6">
              {STATUS_ORDER.map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => onStatus(st)}
                  className="glass-tile min-h-11 cursor-pointer rounded-2xl px-4 py-3 text-right transition-all duration-500 ease-spring hover:bg-white/75"
                >
                  <div className="text-[13px] text-muted">{STATUS_LABELS[st]}</div>
                  <div className="num text-[20px] font-bold">{formatRials(summary.by_status[st] || 0)}</div>
                </button>
              ))}
            </div>
          </Panel>
        </Reveal>
      </div>

      <Reveal>
        <Panel inner="pb-3">
          <SectionTitle
            title="مهم‌ترین هشدارها"
            hint="مرتب‌شده بر اساس شدت ریسک و مبلغ درگیر."
            action={
              <Button variant="quiet" onClick={onAll}>
                دیدن همه
              </Button>
            }
          />
          <div className="mt-3 divide-y divide-ink/[0.06] px-2 md:px-4">
            {alerts.slice(0, 5).map((a) => (
              <AlertRow key={a.alert_id} alert={a} onOpen={onOpen} />
            ))}
          </div>
        </Panel>
      </Reveal>
    </div>
  );
}
