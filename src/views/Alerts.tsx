import { Download, Search } from 'lucide-react';
import { AlertPriority, AlertStatus, P0RuleId, RiskAlert } from '../types';
import { formatRials, PRIORITY_LABELS, RULE_METADATA, STATUS_LABELS } from '../engine/p2pEngine';
import { AlertRow, Button, cx, Empty, inputClass, PageHead, Panel, Reveal } from '../ui';

export type Filters = {
  priority: AlertPriority | 'ALL';
  status: AlertStatus | 'ALL';
  rule: P0RuleId | 'ALL';
  q: string;
};
export const NO_FILTERS: Filters = { priority: 'ALL', status: 'ALL', rule: 'ALL', q: '' };

export default function Alerts({
  alerts,
  total,
  filters,
  setFilters,
  onOpen,
  onExport,
}: {
  alerts: RiskAlert[];
  total: number;
  filters: Filters;
  setFilters: (f: Filters) => void;
  onOpen: (a: RiskAlert) => void;
  onExport: () => void;
}) {
  const filtered =
    filters.priority !== 'ALL' || filters.status !== 'ALL' || filters.rule !== 'ALL' || filters.q.trim() !== '';

  return (
    <div className="space-y-8">
      <PageHead
        eyebrow="هشدارها"
        title="هشدارها، به ترتیب اهمیت"
        lead="هر هشدار را باز کنید تا دلیل‌ها، زنجیرهٔ سندها و جای ثبت تصمیم را ببینید."
        actions={
          <Button variant="ghost" icon={<Download className="h-4 w-4" strokeWidth={1.5} />} onClick={onExport}>
            خروجی CSV
          </Button>
        }
      />

      <Reveal>
        <Panel inner="p-4 md:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" strokeWidth={1.5} />
              <input
                type="search"
                value={filters.q}
                onChange={(e) => setFilters({ ...filters, q: e.target.value })}
                placeholder="جست‌وجوی شمارهٔ فاکتور، سفارش، تأمین‌کننده یا کاربر"
                aria-label="جست‌وجو در هشدارها"
                className={cx(inputClass, 'rounded-full pr-11')}
              />
            </div>
            <div className="flex flex-wrap items-center gap-1 rounded-full bg-paper p-1 ring-1 ring-ink/[0.06]" role="group" aria-label="اولویت">
              {(['ALL', 'CRITICAL', 'HIGH', 'MEDIUM'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  aria-pressed={filters.priority === p}
                  onClick={() => setFilters({ ...filters, priority: p })}
                  className={cx(
                    'min-h-11 cursor-pointer rounded-full px-4 text-[14px] font-semibold transition-all duration-500 ease-spring',
                    filters.priority === p ? 'bg-white text-ink shadow-[0_6px_16px_-10px_rgba(15,33,56,0.5)]' : 'text-muted hover:text-ink'
                  )}
                >
                  {p === 'ALL' ? 'همه' : PRIORITY_LABELS[p]}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center">
            <select
              aria-label="قاعده"
              value={filters.rule}
              onChange={(e) => setFilters({ ...filters, rule: e.target.value as P0RuleId | 'ALL' })}
              className={cx(inputClass, 'rounded-full md:max-w-xs')}
            >
              <option value="ALL">همهٔ قاعده‌ها</option>
              {(Object.keys(RULE_METADATA) as P0RuleId[]).map((r) => (
                <option key={r} value={r}>
                  {RULE_METADATA[r].title_fa}
                </option>
              ))}
            </select>
            <select
              aria-label="وضعیت"
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value as AlertStatus | 'ALL' })}
              className={cx(inputClass, 'rounded-full md:max-w-xs')}
            >
              <option value="ALL">همهٔ وضعیت‌ها</option>
              {(Object.keys(STATUS_LABELS) as AlertStatus[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
            <div className="num flex items-center gap-3 text-[14px] text-muted md:mr-auto">
              <span>
                {formatRials(alerts.length)} از {formatRials(total)} هشدار
              </span>
              {filtered && (
                <Button variant="quiet" onClick={() => setFilters(NO_FILTERS)}>
                  پاک کردن فیلترها
                </Button>
              )}
            </div>
          </div>
        </Panel>
      </Reveal>

      <Reveal>
        <Panel inner="py-2">
          {alerts.length === 0 ? (
            <Empty
              title="هشداری با این فیلترها نیست"
              action={
                <Button variant="ghost" onClick={() => setFilters(NO_FILTERS)}>
                  نمایش همهٔ هشدارها
                </Button>
              }
            >
              فیلتر اولویت، قاعده یا وضعیت را تغییر دهید.
            </Empty>
          ) : (
            <div className="divide-y divide-ink/[0.06] px-2 md:px-4">
              {alerts.map((a) => (
                <AlertRow key={a.alert_id} alert={a} onOpen={onOpen} />
              ))}
            </div>
          )}
        </Panel>
      </Reveal>
    </div>
  );
}
