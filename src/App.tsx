import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
import { AlertAuditLog, AlertStatus, RiskAlert } from './types';
import { confirmMapping, fetchState, Ingested, NeedsMapping, saveDecision, ServerState, uploadFile } from './api';
import {
  computeDashboardSummary,
  createEmptyEngineState,
  CSV_TEMPLATES,
  EngineState,
  formatRials,
  generateSyntheticEngineState,
  STATUS_LABELS,
} from './engine/p2pEngine';
import { BrandMark, cx, EASE } from './ui';
import Overview from './views/Overview';
import Alerts, { Filters, NO_FILTERS } from './views/Alerts';
import CaseView from './views/CaseView';
import DataView from './views/DataView';
import Welcome from './views/Welcome';
import MappingView from './views/MappingView';

type Route = { page: 'overview' } | { page: 'alerts' } | { page: 'case'; id: string } | { page: 'data' };
type Source = { sample: boolean; files: string[] };

// A link like #/sample or #/sample/case/<id> opens the app with the sample data loaded.
const SAMPLE_LINK = /^#\/?sample(\/|$)/.test(window.location.hash);
if (SAMPLE_LINK) window.history.replaceState(null, '', window.location.hash.replace(/^#\/?sample\/?/, '#/'));

function readRoute(): Route {
  const [page, id] = window.location.hash.replace(/^#\/?/, '').split('/');
  if (page === 'alerts') return { page: 'alerts' };
  if (page === 'data') return { page: 'data' };
  if (page === 'case' && id) return { page: 'case', id: decodeURIComponent(id) };
  return { page: 'overview' };
}

function hashOf(r: Route) {
  return r.page === 'case' ? `#/case/${encodeURIComponent(r.id)}` : `#/${r.page}`;
}

function nowJalali() {
  const d = new Date();
  return `${d.toLocaleDateString('fa-IR')}، ${d.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}`;
}

function fromServer(s: ServerState): EngineState {
  return {
    ...createEmptyEngineState(),
    sourceSystem: 'tarazban-server',
    totalRecords: s.total_records,
    alerts: s.alerts,
    auditLogs: s.audit_logs,
    qualityReports: s.quality_reports,
  };
}

function download(name: string, text: string) {
  const blob = new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const NAV: Array<[Route['page'], string]> = [
  ['overview', 'نمای کلی'],
  ['alerts', 'هشدارها'],
  ['data', 'داده'],
];

export default function App() {
  const [engine, setEngine] = useState<EngineState>(() =>
    SAMPLE_LINK ? generateSyntheticEngineState(15000) : createEmptyEngineState()
  );
  const [source, setSource] = useState<Source>({ sample: SAMPLE_LINK, files: [] });
  const [route, setRoute] = useState<Route>(readRoute);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [toast, setToast] = useState<string | null>(null);
  const [pending, setPending] = useState<NeedsMapping[]>([]);

  // Everything received earlier is kept on the server: open with it.
  useEffect(() => {
    if (SAMPLE_LINK) return;
    fetchState()
      .then((s) => {
        if (!s.files.length) return;
        setEngine(fromServer(s));
        setSource((cur) => (cur.sample ? cur : { sample: false, files: s.files }));
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const onHash = () => {
      setRoute(readRoute());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  const go = useCallback((r: Route) => {
    window.location.hash = hashOf(r);
  }, []);

  const hasData = source.sample || source.files.length > 0;
  const summary = useMemo(() => computeDashboardSummary(engine), [engine]);

  const filtered = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    return engine.alerts.filter((a) => {
      if (filters.priority !== 'ALL' && a.priority !== filters.priority) return false;
      if (filters.status !== 'ALL' && a.status !== filters.status) return false;
      if (filters.rule !== 'ALL' && a.rule_id !== filters.rule) return false;
      if (!q) return true;
      return [a.alert_id, a.primary_entity_id, a.supplier_id, a.supplier_name, a.summary_fa, a.rule_title_fa]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [engine.alerts, filters]);

  const sourceLabel = source.sample
    ? 'دادهٔ نمونه'
    : source.files.length === 1
    ? source.files[0]
    : `${formatRials(source.files.length)} فایل`;

  const loadSample = () => {
    setEngine(generateSyntheticEngineState(15000));
    setSource({ sample: true, files: [] });
    setFilters(NO_FILTERS);
    go({ page: 'overview' });
  };

  const refresh = async () => {
    const s = await fetchState();
    setEngine(fromServer(s));
    setSource({ sample: false, files: s.files });
    setFilters(NO_FILTERS);
  };

  const report = (done: Ingested[]) => {
    const rows = done.reduce((n, d) => n + d.rows, 0);
    const fresh = done.reduce((n, d) => n + d.new_rows, 0);
    const added = done.reduce((n, d) => n + d.alerts_added, 0);
    setToast(
      fresh === 0
        ? 'این داده قبلاً دریافت شده بود؛ سطر تازه‌ای نداشت.'
        : `${formatRials(rows)} سطر بررسی شد${fresh < rows ? ` (${formatRials(rows - fresh)} سطر از قبل رسیده بود)` : ''} و ${formatRials(added)} هشدار تازه پیدا شد.`
    );
  };

  // Files go to the engine one by one; those with unfamiliar columns wait for the person to map them.
  const send = async (items: Array<{ blob: Blob; name: string }>) => {
    const done: Ingested[] = [];
    const ask: NeedsMapping[] = [];
    for (const it of items) {
      try {
        const r = await uploadFile(it.blob, it.name);
        if (r.status === 'done') done.push(r);
        else ask.push(r);
      } catch (err) {
        setToast(`${it.name}: ${err instanceof Error ? err.message : 'فایل خوانده نشد.'}`);
      }
    }
    if (done.length) {
      await refresh().catch(() => undefined);
      report(done);
    }
    if (ask.length) setPending((p) => [...p, ...ask]);
    else if (done.length) go({ page: 'alerts' });
  };

  const onFiles = (list: FileList) => send(Array.from(list).map((f) => ({ blob: f, name: f.name })));

  const onMapped = async (item: NeedsMapping, kind: string, mapping: Record<string, string>) => {
    try {
      const r = await confirmMapping(item.upload_id, kind, mapping);
      await refresh();
      report([r]);
      const rest = pending.filter((p) => p.upload_id !== item.upload_id);
      setPending(rest);
      if (!rest.length) go({ page: 'alerts' });
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'فایل خوانده نشد.');
    }
  };

  const decide = async (alert: RiskAlert, d: { status: AlertStatus; assignee: string; note: string }) => {
    let log: AlertAuditLog;
    if (source.sample) {
      const [role, name] = d.assignee.split(' - ');
      log = {
        log_id: `LOG-${Date.now()}`,
        alert_id: alert.alert_id,
        actor_id: name?.trim() || d.assignee,
        actor_role_fa: role?.trim() || 'حسابرس',
        previous_status: alert.status,
        new_status: d.status,
        assigned_to: d.assignee,
        auditor_note: d.note.trim(),
        created_at: nowJalali(),
      };
    } else {
      try {
        log = await saveDecision(alert.alert_id, d);
      } catch (err) {
        setToast(err instanceof Error ? err.message : 'تصمیم ثبت نشد.');
        return;
      }
    }
    setEngine((prev) => ({
      ...prev,
      alerts: prev.alerts.map((a) => (a.alert_id === alert.alert_id ? { ...a, status: d.status, assigned_to: d.assignee } : a)),
      auditLogs: [log, ...prev.auditLogs],
    }));
    setToast(`تصمیم ثبت شد: ${STATUS_LABELS[d.status]}`);
  };

  const exportAlerts = () => {
    const head = 'alert_id,rule,entity,supplier,risk_score,confidence,exposure_rials,priority,status,assigned_to';
    const quote = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = filtered.map((a) =>
      [a.alert_id, a.rule_title_fa, a.primary_entity_id, a.supplier_name, a.risk_score, a.confidence_score, a.financial_exposure, a.priority, a.status, a.assigned_to]
        .map(quote)
        .join(',')
    );
    download('tarazban-alerts.csv', [head, ...rows].join('\n'));
  };

  const caseAlert = route.page === 'case' ? engine.alerts.find((a) => a.alert_id === route.id) : undefined;
  const caseIndex = caseAlert ? filtered.findIndex((a) => a.alert_id === caseAlert.alert_id) : -1;
  const open = (a: RiskAlert) => go({ page: 'case', id: a.alert_id });
  const active = route.page === 'case' ? 'alerts' : route.page;

  let view: ReactNode;
  if (pending.length > 0) {
    view = (
      <MappingView
        item={pending[0]}
        waiting={pending.length - 1}
        onConfirm={(kind, mapping) => onMapped(pending[0], kind, mapping)}
        onCancel={() => setPending((p) => p.slice(1))}
      />
    );
  } else if (route.page === 'data') {
    view = (
      <DataView
        files={source.files}
        sample={source.sample}
        quality={engine.qualityReports}
        candidates={engine.entityCandidates}
        onFiles={onFiles}
        onTemplate={(name) => send([{ blob: new Blob([CSV_TEMPLATES[name]], { type: 'text/csv' }), name }])}
        onDownload={(name) => download(name, CSV_TEMPLATES[name])}
        onResolve={(id, decision) => {
          setEngine((prev) => ({
            ...prev,
            entityCandidates: prev.entityCandidates.map((c) =>
              c.candidate_id === id ? { ...c, review_status: decision, reviewed_by: 'شما', reviewed_at: nowJalali() } : c
            ),
          }));
          setToast(decision === 'MERGED_CONFIRMED' ? 'دو تأمین‌کننده یکی شدند.' : 'دو تأمین‌کننده جدا ماندند.');
        }}
      />
    );
  } else if (!hasData) {
    view = <Welcome onFiles={onFiles} onSample={loadSample} onTemplates={() => go({ page: 'data' })} />;
  } else if (route.page === 'case' && caseAlert) {
    view = (
      <CaseView
        alert={caseAlert}
        logs={engine.auditLogs.filter((l) => l.alert_id === caseAlert.alert_id)}
        position={caseIndex >= 0 ? { index: caseIndex, count: filtered.length } : null}
        onBack={() => go({ page: 'alerts' })}
        onPrev={caseIndex > 0 ? () => open(filtered[caseIndex - 1]) : null}
        onNext={caseIndex >= 0 && caseIndex < filtered.length - 1 ? () => open(filtered[caseIndex + 1]) : null}
        onDecide={(d) => decide(caseAlert, d)}
      />
    );
  } else if (route.page === 'alerts' || route.page === 'case') {
    view = (
      <Alerts
        alerts={filtered}
        total={engine.alerts.length}
        filters={filters}
        setFilters={setFilters}
        onOpen={open}
        onExport={exportAlerts}
      />
    );
  } else {
    view = (
      <Overview
        summary={summary}
        alerts={engine.alerts}
        sourceLabel={sourceLabel}
        onOpen={open}
        onRule={(rule) => {
          setFilters({ ...NO_FILTERS, rule });
          go({ page: 'alerts' });
        }}
        onStatus={(status) => {
          setFilters({ ...NO_FILTERS, status });
          go({ page: 'alerts' });
        }}
        onCritical={() => {
          setFilters({ ...NO_FILTERS, priority: 'CRITICAL' });
          go({ page: 'alerts' });
        }}
        onAll={() => {
          setFilters(NO_FILTERS);
          go({ page: 'alerts' });
        }}
      />
    );
  }

  return (
    <div className="min-h-[100dvh] text-ink">
      <div className="tz-backdrop" aria-hidden="true" />
      <header className="sticky top-4 z-30 px-3">
        <nav
          aria-label="بخش‌ها"
          className="mx-auto flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-full [scrollbar-width:none] [&::-webkit-scrollbar]:hidden bg-white/45 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.95),inset_0_-10px_20px_-14px_rgba(15,33,56,0.18),0_0_0_1px_rgba(255,255,255,0.7),0_22px_48px_-26px_rgba(15,33,56,0.5)] backdrop-blur-2xl backdrop-saturate-[1.8]"
        >
          <a href="#/overview" aria-label="ترازبان" className="flex min-h-11 shrink-0 items-center gap-2.5 rounded-full ps-3 pe-3 sm:pe-4">
            <BrandMark size={22} />
            <span className="hidden text-[17px] font-extrabold sm:inline">ترازبان</span>
          </a>
          <span className="h-6 w-px shrink-0 bg-ink/10" aria-hidden="true" />
          <LayoutGroup>
            {NAV.map(([page, label]) => (
              <button
                key={page}
                type="button"
                aria-current={active === page ? 'page' : undefined}
                onClick={() => go({ page } as Route)}
                className={cx(
                  'relative min-h-11 shrink-0 cursor-pointer rounded-full px-4 text-[15px] font-semibold transition-colors duration-500 ease-spring',
                  active === page ? 'text-ink' : 'text-muted hover:text-ink'
                )}
              >
                {active === page && (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-0 rounded-full bg-white/90 shadow-[inset_0_1px_0_#fff,inset_0_-2px_6px_rgba(15,33,56,0.08),0_6px_18px_-8px_rgba(15,33,56,0.45)]"
                    transition={{ type: 'spring', bounce: 0.18, duration: 0.6 }}
                  />
                )}
                <span className="relative">
                  {label}
                  {page === 'alerts' && hasData && (
                    <span className="num ms-2 text-[13px] opacity-70">{formatRials(engine.alerts.length)}</span>
                  )}
                </span>
              </button>
            ))}
          </LayoutGroup>
          {hasData && (
            <div className="hidden items-center gap-1 sm:flex">
              <span className="h-6 w-px shrink-0 bg-ink/10" aria-hidden="true" />
              <button
                type="button"
                onClick={() => go({ page: 'data' })}
                className="min-h-11 max-w-48 shrink-0 cursor-pointer truncate rounded-full bg-level/[0.12] px-4 text-[13px] font-semibold text-level shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] transition-colors duration-500 ease-spring hover:bg-level/[0.18]"
                title="منبع داده"
              >
                {sourceLabel}
              </button>
            </div>
          )}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-[1240px] px-4 pb-24 pt-14 md:px-8 md:pt-16">{view}</main>

      <AnimatePresence>
        {toast && (
          <motion.div
            role="status"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.6, ease: EASE }}
            className="fixed inset-x-0 bottom-6 z-40 mx-auto w-fit max-w-[calc(100%-2rem)] rounded-full bg-ink/75 px-6 py-3 text-[15px] font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_0_0_1px_rgba(255,255,255,0.12),0_18px_40px_-18px_rgba(15,33,56,0.6)] backdrop-blur-xl backdrop-saturate-150"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
