import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpLeft,
  CheckCircle2,
  ClipboardCheck,
  Database,
  Download,
  FileSpreadsheet,
  Filter,
  GitCompare,
  Layers,
  Play,
  Search,
  ShieldAlert,
  ShieldCheck,
  Upload,
  UserCheck,
  XCircle,
} from 'lucide-react';
import {
  AlertAuditLog,
  AlertPriority,
  AlertStatus,
  EntityCandidate,
  P0RuleId,
  RiskAlert,
} from './types';
import {
  analyzeUploadedCsvContent,
  computeDashboardSummary,
  EngineState,
  formatMillionRials,
  formatRials,
  generateSyntheticEngineState,
  PRIORITY_LABELS,
  RULE_METADATA,
  STATUS_LABELS,
  WAREHOUSE_NAMES,
} from './engine/p2pEngine';

type WorkspaceTab = 'dashboard' | 'inbox' | 'workbench' | 'ingestion';

const AUDITORS_LIST = [
  'حسابرس ارشد - م. رضایی',
  'مدیر حسابرسی - ع. کاظمی',
  'کارشناس حسابرسی - س. محمدی',
  'کنترلر مالی - ن. فرهادی',
];

export default function App() {
  const [engineState, setEngineState] = useState<EngineState>(() =>
    generateSyntheticEngineState(15000)
  );
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('dashboard');
  const [selectedAlertId, setSelectedAlertId] = useState<string>('ALT-1404-001');

  // فیلترهای صندوق هشدار (Risk Inbox)
  const [priorityFilter, setPriorityFilter] = useState<AlertPriority | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<AlertStatus | 'ALL'>('ALL');
  const [ruleFilter, setRuleFilter] = useState<P0RuleId | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // فرم ثبت تصمیم حسابرس در Investigation Workbench
  const [reviewStatus, setReviewStatus] = useState<AlertStatus>('IN_REVIEW');
  const [reviewAssignee, setReviewAssignee] = useState<string>(AUDITORS_LIST[0]);
  const [reviewNote, setReviewNote] = useState<string>('');
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);
  const [isRunningBatch, setIsRunningBatch] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const summary = useMemo(() => computeDashboardSummary(engineState), [engineState]);

  const filteredAlerts = useMemo(() => {
    return engineState.alerts.filter((a) => {
      if (priorityFilter !== 'ALL' && a.priority !== priorityFilter) return false;
      if (statusFilter !== 'ALL' && a.status !== statusFilter) return false;
      if (ruleFilter !== 'ALL' && a.rule_id !== ruleFilter) return false;
      if (searchQuery.trim() !== '') {
        const q = searchQuery.trim().toLowerCase();
        const hay = [
          a.alert_id,
          a.primary_entity_id,
          a.supplier_id || '',
          a.supplier_name || '',
          a.summary_fa,
          a.rule_title_fa,
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [engineState.alerts, priorityFilter, statusFilter, ruleFilter, searchQuery]);

  const selectedAlert: RiskAlert = useMemo(() => {
    return (
      engineState.alerts.find((a) => a.alert_id === selectedAlertId) ||
      engineState.alerts[0]
    );
  }, [engineState.alerts, selectedAlertId]);

  const selectedAlertLogs: AlertAuditLog[] = useMemo(() => {
    if (!selectedAlert) return [];
    return engineState.auditLogs.filter((l) => l.alert_id === selectedAlert.alert_id);
  }, [engineState.auditLogs, selectedAlert]);

  const handleOpenAlertInWorkbench = (alert: RiskAlert) => {
    setSelectedAlertId(alert.alert_id);
    setReviewStatus(alert.status);
    setReviewAssignee(alert.assigned_to || AUDITORS_LIST[0]);
    setReviewNote('');
    setActiveTab('workbench');
  };

  const handleRunSyntheticBatch = () => {
    setIsRunningBatch(true);
    setTimeout(() => {
      const nextState = generateSyntheticEngineState(15000);
      setEngineState(nextState);
      setSelectedAlertId(nextState.alerts[0].alert_id);
      setIsRunningBatch(false);
      setFeedbackBanner(
        `بسته داده پایلوت (${formatRials(nextState.totalRecords)} رکورد P2P) در ${nextState.executionSeconds.toLocaleString('fa-IR')} ثانیه با موفقیت تحلیل و امتیازدهی شد.`
      );
    }, 180);
  };

  const handleSubmitAuditorDecision = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAlert) return;

    const prevStatus = selectedAlert.status;
    const newLog: AlertAuditLog = {
      log_id: `LOG-${Date.now().toString().slice(-5)}`,
      alert_id: selectedAlert.alert_id,
      actor_id: reviewAssignee.split('-')[1]?.trim() || reviewAssignee,
      actor_role_fa: reviewAssignee.split('-')[0]?.trim() || 'حسابرس داخلی',
      previous_status: prevStatus,
      new_status: reviewStatus,
      assigned_to: reviewAssignee,
      auditor_note:
        reviewNote.trim() ||
        `تغییر وضعیت از «${STATUS_LABELS[prevStatus]}» به «${STATUS_LABELS[reviewStatus]}» پس از بررسی شواهد.`,
      created_at: '۱۴۰۴/۱۱/۲۸ - ثبت آنی حسابرس',
    };

    setEngineState((prev) => ({
      ...prev,
      alerts: prev.alerts.map((a) =>
        a.alert_id === selectedAlert.alert_id
          ? { ...a, status: reviewStatus, assigned_to: reviewAssignee }
          : a
      ),
      auditLogs: [newLog, ...prev.auditLogs],
    }));

    setReviewNote('');
    setFeedbackBanner(
      `تصمیم حسابرس برای هشدار ${selectedAlert.alert_id} در سیاهه ممیزی (Audit Trail) ثبت شد.`
    );
  };

  const handleEntityResolutionAction = (
    candidateId: string,
    decision: 'MERGED_CONFIRMED' | 'SEPARATE_ENTITIES'
  ) => {
    setEngineState((prev) => ({
      ...prev,
      entityCandidates: prev.entityCandidates.map((c) =>
        c.candidate_id === candidateId
          ? {
              ...c,
              review_status: decision,
              reviewed_by: 'حسابرس ارشد - م. رضایی',
              reviewed_at: '۱۴۰۴/۱۱/۲۸',
            }
          : c
      ),
    }));
    setFeedbackBanner(
      decision === 'MERGED_CONFIRMED'
        ? `ارتباط دو کد تأمین‌کننده تأیید و در گراف تطبیق موجودیت‌ها (Entity Resolution) یکپارچه شد.`
        : `دو تأمین‌کننده به عنوان شخصیت‌های حقوقی مجزا علامت‌گذاری شدند.`
    );
  };

  const handleCsvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = String(evt.target?.result || '');
        const { updatedState, addedAlertsCount, rowsParsed } =
          analyzeUploadedCsvContent(file.name, text, engineState);
        setEngineState(updatedState);
        if (updatedState.alerts.length > 0) {
          setSelectedAlertId(updatedState.alerts[0].alert_id);
        }
        setFeedbackBanner(
          `فایل ${file.name} (${formatRials(rowsParsed)} سطر) استانداردسازی و تحلیل شد؛ ${formatRials(addedAlertsCount)} هشدار جدید کشف گردید.`
        );
        setActiveTab('inbox');
      } catch (err) {
        setFeedbackBanner(
          err instanceof Error ? err.message : 'خطا در ساختار فایل CSV ورودی'
        );
      }
    };
    reader.readAsText(file, 'utf-8');
    e.target.value = '';
  };

  const handleRunSampleCsvTemplate = (templateName: string) => {
    const csvText = engineState.csvTemplates[templateName];
    if (!csvText) return;
    const { updatedState, addedAlertsCount, rowsParsed } =
      analyzeUploadedCsvContent(templateName, csvText, engineState);
    setEngineState(updatedState);
    setSelectedAlertId(updatedState.alerts[0].alert_id);
    setFeedbackBanner(
      `نمونه فایل ${templateName} (${formatRials(rowsParsed)} رکورد) با موفقیت پردازش شد و ${formatRials(addedAlertsCount)} هشدار ریسک جدید به صندوق اضافه گردید.`
    );
    setActiveTab('inbox');
  };

  const handleDownloadCsvTemplate = (templateName: string) => {
    const content = engineState.csvTemplates[templateName];
    if (!content) return;
    const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = templateName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportAlertsCsv = () => {
    const headers = [
      'alert_id',
      'rule_id',
      'rule_version',
      'primary_entity_id',
      'supplier_id',
      'risk_score',
      'confidence_score',
      'financial_exposure_rials',
      'priority',
      'status',
      'assigned_to',
    ];
    const rows = filteredAlerts.map((a) =>
      [
        a.alert_id,
        a.rule_id,
        a.rule_version,
        a.primary_entity_id,
        a.supplier_id || '',
        a.risk_score,
        a.confidence_score,
        a.financial_exposure,
        a.priority,
        a.status,
        a.assigned_to || '',
      ].join(',')
    );
    const csv = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `p2p_risk_alerts_${engineState.batchId}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const renderPriorityText = (priority: AlertPriority) => {
    if (priority === 'CRITICAL') {
      return (
        <span className="inline-flex items-center gap-1.5 font-semibold text-red-700 whitespace-nowrap">
          <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
          <span>{PRIORITY_LABELS[priority]}</span>
        </span>
      );
    }
    if (priority === 'HIGH') {
      return (
        <span className="inline-flex items-center gap-1.5 font-semibold text-amber-700 whitespace-nowrap">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>{PRIORITY_LABELS[priority]}</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 font-medium text-slate-700 whitespace-nowrap">
        <span>{PRIORITY_LABELS[priority]}</span>
      </span>
    );
  };

  const renderStatusText = (status: AlertStatus) => {
    if (status === 'CONFIRMED') {
      return (
        <span className="inline-flex items-center gap-1 text-red-700 font-medium whitespace-nowrap">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span>{STATUS_LABELS[status]}</span>
        </span>
      );
    }
    if (status === 'FALSE_POSITIVE') {
      return (
        <span className="inline-flex items-center gap-1 text-slate-500 font-medium whitespace-nowrap">
          <XCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{STATUS_LABELS[status]}</span>
        </span>
      );
    }
    if (status === 'IN_REVIEW' || status === 'NEEDS_INFO') {
      return (
        <span className="inline-flex items-center gap-1 text-amber-700 font-medium whitespace-nowrap">
          <span>{STATUS_LABELS[status]}</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-blue-700 font-medium whitespace-nowrap">
        <span>{STATUS_LABELS[status]}</span>
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Top Bar Contract: 3 Zones separated by gap-8 */}
      <header className="sticky top-0 z-20 bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between gap-8">
        {/* Zone 1: Single text element brand wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('dashboard');
          }}
          className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
        >
          پایش هوشمند ریسک مالی چرخه خرید تا پرداخت
        </a>

        {/* Zone 2: 4 clean single-line navigation links */}
        <nav className="flex items-center gap-7 text-sm font-medium text-slate-600 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'dashboard'
                ? 'border-blue-700 text-slate-900 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            داشبورد مدیریتی
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('inbox')}
            className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'inbox'
                ? 'border-blue-700 text-slate-900 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            صندوق هشدارها ({formatRials(engineState.alerts.length)})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('workbench')}
            className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'workbench'
                ? 'border-blue-700 text-slate-900 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            میز کار حسابرسی
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ingestion')}
            className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'ingestion'
                ? 'border-blue-700 text-slate-900 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            تطبیق موجودیت‌ها و کیفیت داده
          </button>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={handleRunSyntheticBatch}
            disabled={isRunningBatch}
            className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-2 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 shrink-0" />
            <span>
              {isRunningBatch
                ? 'در حال تحلیل پایپلاین...'
                : 'بازاجرای پایپلاین پایلوت (۱۰۳ هزار رکورد)'}
            </span>
          </button>
        </div>
      </header>

      {/* Sub-header context metadata bar (Unboxed Zero-Pill Metadata) */}
      <div className="bg-slate-100/80 border-b border-slate-200 px-6 py-2.5 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-600">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-slate-800">دامنه MVP: چرخه خرید تا پرداخت (Procure-to-Pay)</span>
          <span aria-hidden="true">·</span>
          <span>دسترسی: فقط خواندنی (Read-Only بدون تغییر در ERP)</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono-num">نسخه بسته داده: {summary.latest_batch.batch_id}</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono-num">
            رکوردهای تحلیل‌شده: {formatRials(summary.latest_batch.total_records)} رکورد در{' '}
            {summary.latest_batch.execution_seconds.toLocaleString('fa-IR')} ثانیه
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span>شاخص Precision@20 پایلوت:</span>
          <span className="font-mono-num font-semibold text-emerald-700">
            {summary.benchmark.precision_at_20.toLocaleString('fa-IR')}٪ (هدف PRD: حداقل ۶۰٪)
          </span>
          <span aria-hidden="true">·</span>
          <span>ردیابی شواهد: ۱۰۰٪</span>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedbackBanner && (
        <div className="bg-blue-50 border-b border-blue-200 px-6 py-2.5 flex items-center justify-between text-xs text-blue-950">
          <div className="flex items-center gap-2 font-medium">
            <ShieldCheck className="w-4 h-4 text-blue-700 shrink-0" />
            <span>{feedbackBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackBanner(null)}
            className="text-blue-700 hover:underline font-medium whitespace-nowrap cursor-pointer"
          >
            بستن پیام
          </button>
        </div>
      )}

      {/* Main Content Container */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-6 py-8">
        {/* =====================================================================
            VIEW 1: RISK DASHBOARD (داشبورد مدیریتی ریسک)
           ===================================================================== */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">
                  داشبورد مدیریتی پایش مستمر ریسک (Risk Dashboard)
                </h1>
                <p className="text-sm text-slate-600 mt-1">
                  نمای تجمیعی مواجهه مالی، تفکیک قواعد ۶گانه P0 و وضعیت رسیدگی حسابرسی داخلی در مراکز پخش
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('ingestion')}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-2 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>بارگذاری فایل CSV جدید</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('inbox')}
                  className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-2 cursor-pointer"
                >
                  <span>مشاهده صندوق هشدارهای اولویت‌دار</span>
                  <ArrowUpLeft className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* 4-Column Executive KPI Strip (Single-Elevation Depth) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="text-xs text-slate-500 font-medium">
                  کل مبلغ مالی درگیر (Financial Exposure)
                </div>
                <div className="text-2xl font-bold text-slate-900 mt-2 font-mono-num">
                  {formatMillionRials(summary.total_financial_exposure_rials)}
                </div>
                <div className="text-xs text-slate-500 mt-2 flex items-center gap-1.5 font-mono-num">
                  <span>{formatRials(summary.total_financial_exposure_rials)} ریال</span>
                  <span aria-hidden="true">·</span>
                  <span>در {formatRials(summary.total_alerts)} پرونده هشدار</span>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="text-xs text-slate-500 font-medium">
                  هشدارهای بحرانی نیازمند اقدام فوری (P1)
                </div>
                <div className="text-2xl font-bold text-red-700 mt-2 font-mono-num">
                  {formatRials(summary.open_critical_count)} مورد باز
                </div>
                <div className="text-xs text-slate-500 mt-2 flex items-center gap-1.5">
                  <span>بحرانی کل: {formatRials(summary.by_priority.CRITICAL)}</span>
                  <span aria-hidden="true">·</span>
                  <span>اولویت بالا: {formatRials(summary.by_priority.HIGH)}</span>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="text-xs text-slate-500 font-medium">
                  مبلغ ناهنجاری‌های تأییدشده توسط حسابرس
                </div>
                <div className="text-2xl font-bold text-emerald-700 mt-2 font-mono-num">
                  {formatMillionRials(summary.confirmed_exposure_rials)}
                </div>
                <div className="text-xs text-slate-500 mt-2 flex items-center gap-1.5">
                  <span>تأییدشده: {formatRials(summary.by_status.CONFIRMED)} پرونده</span>
                  <span aria-hidden="true">·</span>
                  <span>نرخ هشدار کاذب: {summary.false_positive_rate_pct.toLocaleString('fa-IR')}٪</span>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="text-xs text-slate-500 font-medium">
                  عملکرد موتور و کیفیت داده پایلوت
                </div>
                <div className="text-2xl font-bold text-slate-900 mt-2 font-mono-num">
                  {summary.benchmark.precision_at_20.toLocaleString('fa-IR')}٪ Precision@20
                </div>
                <div className="text-xs text-slate-500 mt-2 flex items-center gap-1.5 font-mono-num">
                  <span>زمان تحلیل: {summary.benchmark.execution_seconds.toLocaleString('fa-IR')} ثانیه</span>
                  <span aria-hidden="true">·</span>
                  <span>پوشش فیلدها: {summary.benchmark.essential_field_coverage_pct.toLocaleString('fa-IR')}٪</span>
                </div>
              </div>
            </div>

            {/* 2-Column Split: 6 P0 Rules Table + Multi-Warehouse Distribution Risk */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              {/* Left 7 Cols: P0 Anomaly Detection Rules Breakdown */}
              <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-100">
                    <div>
                      <h2 className="text-base font-bold text-slate-900">
                        تفکیک سناریوهای تشخیص ناهنجاری (قابلیت‌های P0 طبق بند ۴.۳ PRD)
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        کلیک روی هر سناریو، صندوق هشدارها را بر اساس همان قاعده فیلتر می‌کند
                      </p>
                    </div>
                    <span className="text-xs text-slate-500 font-mono-num">نسخه قواعد: v1.0.0</span>
                  </div>

                  <div className="divide-y divide-slate-100 mt-2">
                    {summary.by_rule.map((rule) => {
                      const sharePct =
                        summary.total_financial_exposure_rials > 0
                          ? Math.round(
                              (rule.exposure_rials /
                                summary.total_financial_exposure_rials) *
                                100
                            )
                          : 0;
                      return (
                        <div
                          key={rule.rule_id}
                          onClick={() => {
                            setRuleFilter(rule.rule_id);
                            setActiveTab('inbox');
                          }}
                          className="py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50 px-2 rounded-lg transition-colors cursor-pointer"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-slate-900">
                                {rule.rule_title_fa}
                              </span>
                              <span className="text-xs text-slate-400" aria-hidden="true">
                                ·
                              </span>
                              <span className="text-xs text-slate-500 font-mono-num">
                                {rule.rule_id}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5 truncate">
                              {RULE_METADATA[rule.rule_id].description_fa}
                            </p>
                            <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
                              <div
                                className="bg-blue-700 h-full rounded-full"
                                style={{ width: `${Math.max(6, sharePct)}%` }}
                              />
                            </div>
                          </div>

                          <div className="text-left shrink-0 font-mono-num">
                            <div className="text-sm font-bold text-slate-900">
                              {formatMillionRials(rule.exposure_rials)}
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5">
                              {formatRials(rule.count)} هشدار · میانگین ریسک:{' '}
                              {rule.avg_risk_score.toLocaleString('fa-IR')}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between">
                  <span>
                    توضیح PRD (بند ۴.۴): امتیاز ریسک شاخص شدت سیگنال و مواجهه مالی است و احتمال آماری وقوع تقلب محسوب نمی‌شود.
                  </span>
                </div>
              </section>

              {/* Right 5 Cols: Multi-Warehouse & Audit Workflow Status */}
              <div className="lg:col-span-5 flex flex-col gap-6">
                <section className="bg-white border border-slate-200 rounded-xl p-6">
                  <div className="pb-4 border-b border-slate-100">
                    <h2 className="text-base font-bold text-slate-900">
                      توزیع ریسک در انبارها و شعب پخش
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      مواجهه مالی شناسایی‌شده به تفکیک مراکز توزیع کشور
                    </p>
                  </div>
                  <div className="divide-y divide-slate-100 mt-2">
                    {summary.by_warehouse.map((w) => (
                      <div
                        key={w.warehouse_code}
                        className="py-3 flex items-center justify-between gap-4 text-sm"
                      >
                        <div>
                          <div className="font-medium text-slate-900">
                            {w.warehouse_name_fa}
                          </div>
                          <div className="text-xs text-slate-500 font-mono-num">
                            کد مرکز: {w.warehouse_code} · {formatRials(w.alert_count)} پرونده
                          </div>
                        </div>
                        <div className="font-mono-num font-semibold text-slate-900 text-left">
                          {formatMillionRials(w.exposure_rials)}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="bg-white border border-slate-200 rounded-xl p-6 flex-1">
                  <div className="pb-4 border-b border-slate-100">
                    <h2 className="text-base font-bold text-slate-900">
                      وضعیت گردش کار پرونده‌های حسابرسی (بند ۴.۵ PRD)
                    </h2>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    {(Object.keys(STATUS_LABELS) as AlertStatus[]).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => {
                          setStatusFilter(st);
                          setActiveTab('inbox');
                        }}
                        className="p-3 border border-slate-200 rounded-lg text-right hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        <div className="text-xs text-slate-500">{STATUS_LABELS[st]}</div>
                        <div className="text-lg font-bold text-slate-900 font-mono-num mt-1">
                          {formatRials(summary.by_status[st] || 0)} پرونده
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              </div>
            </div>

            {/* Top Priority Alerts Preview Table */}
            <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    مهم‌ترین هشدارهای نیازمند بررسی فوری مدیر مالی و حسابرس
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    مرتب‌شده بر اساس امتیاز ریسک (Risk Score) و مبلغ مالی درگیر (Financial Exposure)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('inbox')}
                  className="text-xs font-semibold text-blue-700 hover:underline whitespace-nowrap cursor-pointer"
                >
                  مشاهده تمام {formatRials(engineState.alerts.length)} هشدار ←
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                    <tr>
                      <th className="py-3 px-4 font-semibold">شناسه و موجودیت</th>
                      <th className="py-3 px-4 font-semibold">قاعده تشخیص (P0)</th>
                      <th className="py-3 px-4 font-semibold">تأمین‌کننده / مرکز پخش</th>
                      <th className="py-3 px-4 font-semibold">امتیاز ریسک</th>
                      <th className="py-3 px-4 font-semibold">اطمینان شواهد</th>
                      <th className="py-3 px-4 font-semibold">مبلغ درگیر (ریال)</th>
                      <th className="py-3 px-4 font-semibold">اولویت و وضعیت</th>
                      <th className="py-3 px-4 font-semibold text-left">عملیات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {engineState.alerts.slice(0, 6).map((alert) => (
                      <tr
                        key={alert.alert_id}
                        onClick={() => handleOpenAlertInWorkbench(alert)}
                        className="hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        <td className="py-3.5 px-4 font-mono-num">
                          <div className="font-semibold text-slate-900">{alert.primary_entity_id}</div>
                          <div className="text-xs text-slate-500">{alert.alert_id}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-medium text-slate-900">{alert.rule_title_fa}</div>
                          <div className="text-xs text-slate-500 max-w-md truncate">
                            {alert.summary_fa}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="text-slate-900">{alert.supplier_name || '—'}</div>
                          <div className="text-xs text-slate-500">
                            {alert.warehouse_code ? WAREHOUSE_NAMES[alert.warehouse_code] : '—'}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-mono-num font-bold text-slate-900">
                          {alert.risk_score.toLocaleString('fa-IR')} / ۱۰۰
                        </td>
                        <td className="py-3.5 px-4 font-mono-num text-slate-700">
                          {alert.confidence_score.toLocaleString('fa-IR')}٪
                        </td>
                        <td className="py-3.5 px-4 font-mono-num font-semibold text-slate-900">
                          {formatRials(alert.financial_exposure)}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex flex-col gap-1 text-xs">
                            {renderPriorityText(alert.priority)}
                            {renderStatusText(alert.status)}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-left">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenAlertInWorkbench(alert);
                            }}
                            className="px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 rounded-md transition-colors whitespace-nowrap cursor-pointer"
                          >
                            بررسی پرونده
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {/* =====================================================================
            VIEW 2: RISK INBOX (صندوق هشدارهای اولویت‌بندی‌شده)
           ===================================================================== */}
        {activeTab === 'inbox' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">
                  صندوق هشدارهای ریسک (Risk Inbox)
                </h1>
                <p className="text-sm text-slate-600 mt-1">
                  فهرست اولویت‌بندی‌شده ناهنجاری‌های چرخه خرید تا پرداخت به همراه ۴ شاخص مستقل امتیازدهی
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleExportAlertsCsv}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-2 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>خروجی CSV هشدارها</span>
                </button>
              </div>
            </div>

            {/* Interactive Filter Toolbar */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                {/* Search Box */}
                <div className="relative flex-1 min-w-[260px]">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="جستجو بر اساس شماره فاکتور، سفارش (PO)، نام تأمین‌کننده یا کد کاربر..."
                    className="w-full pr-9 pl-4 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                  />
                </div>

                {/* Segmented Priority Filter Controls */}
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                  {(['ALL', 'CRITICAL', 'HIGH', 'MEDIUM'] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPriorityFilter(p)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        priorityFilter === p
                          ? 'bg-white text-slate-900 shadow-xs font-semibold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {p === 'ALL' ? 'همه اولویت‌ها' : PRIORITY_LABELS[p]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-slate-100">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1.5 text-xs text-slate-600">
                    <Filter className="w-3.5 h-3.5" />
                    <span>قاعده P0:</span>
                  </div>
                  <select
                    value={ruleFilter}
                    onChange={(e) => setRuleFilter(e.target.value as P0RuleId | 'ALL')}
                    className="text-xs border border-slate-300 rounded-lg px-3 py-1.5 bg-white text-slate-800 focus:outline-none focus:border-blue-600"
                  >
                    <option value="ALL">همه قواعد ۶گانه P0</option>
                    {(Object.keys(RULE_METADATA) as P0RuleId[]).map((rid) => (
                      <option key={rid} value={rid}>
                        {RULE_METADATA[rid].title_fa} ({rid})
                      </option>
                    ))}
                  </select>

                  <span className="text-xs text-slate-600 mr-2">وضعیت پرونده:</span>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as AlertStatus | 'ALL')}
                    className="text-xs border border-slate-300 rounded-lg px-3 py-1.5 bg-white text-slate-800 focus:outline-none focus:border-blue-600"
                  >
                    <option value="ALL">همه وضعیت‌ها</option>
                    {(Object.keys(STATUS_LABELS) as AlertStatus[]).map((st) => (
                      <option key={st} value={st}>
                        {STATUS_LABELS[st]}
                      </option>
                    ))}
                  </select>
                </div>

                {(priorityFilter !== 'ALL' ||
                  statusFilter !== 'ALL' ||
                  ruleFilter !== 'ALL' ||
                  searchQuery !== '') && (
                  <button
                    type="button"
                    onClick={() => {
                      setPriorityFilter('ALL');
                      setStatusFilter('ALL');
                      setRuleFilter('ALL');
                      setSearchQuery('');
                    }}
                    className="text-xs text-blue-700 hover:underline font-medium whitespace-nowrap cursor-pointer"
                  >
                    پاک‌سازی فیلترها ({formatRials(filteredAlerts.length)} نتیجه)
                  </button>
                )}
              </div>
            </div>

            {/* High-Density Alerts Table */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              {filteredAlerts.length === 0 ? (
                <div className="p-12 text-center space-y-3">
                  <div className="text-sm font-semibold text-slate-800">
                    هیچ هشداری با فیلترهای انتخاب‌شده یافت نشد
                  </div>
                  <p className="text-xs text-slate-500">
                    فیلترهای اولویت، وضعیت یا عبارت جستجو را تغییر دهید تا سایر پرونده‌های ریسک نمایش داده شوند.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setPriorityFilter('ALL');
                      setStatusFilter('ALL');
                      setRuleFilter('ALL');
                      setSearchQuery('');
                    }}
                    className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors cursor-pointer"
                  >
                    نمایش تمام هشدارها
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                      <tr>
                        <th className="py-3 px-4 font-semibold">پرونده / موجودیت درگیر</th>
                        <th className="py-3 px-4 font-semibold">سناریوی تشخیص و شرح شواهد</th>
                        <th className="py-3 px-4 font-semibold">تأمین‌کننده و انبار</th>
                        <th className="py-3 px-4 font-semibold">Risk Score</th>
                        <th className="py-3 px-4 font-semibold">Confidence</th>
                        <th className="py-3 px-4 font-semibold">Financial Exposure</th>
                        <th className="py-3 px-4 font-semibold">Priority & Status</th>
                        <th className="py-3 px-4 font-semibold text-left">میز کار</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {filteredAlerts.map((alert) => (
                        <tr
                          key={alert.alert_id}
                          onClick={() => handleOpenAlertInWorkbench(alert)}
                          className="hover:bg-slate-50 transition-colors cursor-pointer"
                        >
                          <td className="py-3.5 px-4 font-mono-num whitespace-nowrap">
                            <div className="font-bold text-slate-900">{alert.primary_entity_id}</div>
                            <div className="text-xs text-slate-500">
                              {alert.alert_id} · v{alert.rule_version}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 max-w-md">
                            <div className="font-semibold text-slate-900">{alert.rule_title_fa}</div>
                            <p className="text-xs text-slate-600 mt-0.5 line-clamp-2 leading-relaxed">
                              {alert.summary_fa}
                            </p>
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="font-medium text-slate-900">
                              {alert.supplier_name || '—'}
                            </div>
                            <div className="text-xs text-slate-500">
                              {alert.supplier_id} ·{' '}
                              {alert.warehouse_code
                                ? WAREHOUSE_NAMES[alert.warehouse_code]
                                : 'ستاد مرکزی'}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 font-mono-num whitespace-nowrap">
                            <span className="font-bold text-slate-900">
                              {alert.risk_score.toLocaleString('fa-IR')}
                            </span>
                            <span className="text-xs text-slate-400"> / ۱۰۰</span>
                          </td>
                          <td className="py-3.5 px-4 font-mono-num whitespace-nowrap text-slate-700">
                            {alert.confidence_score.toLocaleString('fa-IR')}٪
                          </td>
                          <td className="py-3.5 px-4 font-mono-num whitespace-nowrap font-bold text-slate-900">
                            {formatRials(alert.financial_exposure)} ریال
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="flex flex-col gap-1 text-xs">
                              {renderPriorityText(alert.priority)}
                              {renderStatusText(alert.status)}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-left whitespace-nowrap">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenAlertInWorkbench(alert);
                              }}
                              className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800 transition-colors cursor-pointer"
                            >
                              بررسی شواهد
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* =====================================================================
            VIEW 3: INVESTIGATION WORKBENCH (میز کار حسابرسی و بررسی شواهد)
           ===================================================================== */}
        {activeTab === 'workbench' && selectedAlert && (
          <div className="space-y-6">
            {/* Header & Alert Selector Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 bg-white border border-slate-200 rounded-xl p-5">
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="font-mono-num font-semibold text-slate-800">
                    پرونده: {selectedAlert.alert_id}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono-num">بسته داده: {selectedAlert.batch_id}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono-num">
                    قاعده: {selectedAlert.rule_id} (نسخه {selectedAlert.rule_version})
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>واحد: {selectedAlert.department || 'بازرگانی'}</span>
                </div>
                <h1 className="text-xl font-bold text-slate-900 mt-1.5">
                  {selectedAlert.rule_title_fa} — موجودیت: {selectedAlert.primary_entity_id}
                </h1>
              </div>

              <div className="flex items-center gap-3">
                <label className="text-xs text-slate-600 whitespace-nowrap">
                  تغییر سریع پرونده:
                </label>
                <select
                  value={selectedAlert.alert_id}
                  onChange={(e) => {
                    const found = engineState.alerts.find((a) => a.alert_id === e.target.value);
                    if (found) handleOpenAlertInWorkbench(found);
                  }}
                  className="text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-900 font-medium focus:outline-none focus:border-blue-600"
                >
                  {engineState.alerts.map((a) => (
                    <option key={a.alert_id} value={a.alert_id}>
                      {a.alert_id} — {a.rule_title_fa} ({a.primary_entity_id})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 4 Independent Scoring Outputs Strip (PRD Section 4.4) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="text-xs text-slate-500">۱. شدت ریسک (Risk Score)</div>
                <div className="text-2xl font-bold text-slate-900 font-mono-num mt-1">
                  {selectedAlert.risk_score.toLocaleString('fa-IR')} / ۱۰۰
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  ترکیب شدت سیگنال، تکرار و مواجهه مالی
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="text-xs text-slate-500">۲. اطمینان تشخیص (Confidence Score)</div>
                <div className="text-2xl font-bold text-slate-900 font-mono-num mt-1">
                  {selectedAlert.confidence_score.toLocaleString('fa-IR')}٪
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  بر اساس کامل‌بودن داده و کیفیت تطبیق موجودیت
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="text-xs text-slate-500">۳. مبلغ مالی درگیر (Financial Exposure)</div>
                <div className="text-2xl font-bold text-slate-900 font-mono-num mt-1">
                  {formatRials(selectedAlert.financial_exposure)} ریال
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  معادل {formatMillionRials(selectedAlert.financial_exposure)}
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="text-xs text-slate-500">۴. اولویت و وضعیت رسیدگی (Priority)</div>
                <div className="mt-1.5 flex items-center gap-3 text-sm">
                  {renderPriorityText(selectedAlert.priority)}
                  <span className="text-slate-300">|</span>
                  {renderStatusText(selectedAlert.status)}
                </div>
                <div className="text-xs text-slate-500 mt-1.5">
                  مسئول فعلی: {selectedAlert.assigned_to || 'تعیین‌نشده'}
                </div>
              </div>
            </div>

            {/* Main 12-Col Workbench Layout: Left 7 Cols Evidence & P2P Chain, Right 5 Cols Auditor Action & Audit Trail */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-7 space-y-6">
                {/* Explainable Reasons & Summary */}
                <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                  <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
                    <h2 className="text-base font-bold text-slate-900">
                      شرح هشدار و دلایل تشخیص (تولیدشده با قالب‌های مبتنی بر شواهد - بدون LLM)
                    </h2>
                  </div>
                  <p className="text-sm text-slate-800 leading-relaxed font-medium bg-slate-50 p-4 rounded-lg border border-slate-200">
                    {selectedAlert.summary_fa}
                  </p>
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-slate-700">
                      سیگنال‌ها و شواهد استخراج‌شده توسط موتور قواعد:
                    </div>
                    <ul className="space-y-2 text-xs text-slate-700 leading-relaxed">
                      {selectedAlert.why_flagged_fa.map((reason, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="font-mono-num font-bold text-blue-700 shrink-0">
                            ۰{idx + 1}.
                          </span>
                          <span>{reason}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </section>

                {/* Linked P2P Cycle Chain (چرخه خرید تا پرداخت مرتبط) */}
                <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                  <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-bold text-slate-900">
                        زنجیره اسناد مرتبط در چرخه خرید تا پرداخت (P2P Document Lineage)
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        ردیابی ۱۰۰٪ رکوردها تا نام فایل CSV ورودی و شماره سطر منبع (source_row_id)
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {selectedAlert.p2p_chain.map((step, idx) => (
                      <div
                        key={idx}
                        className={`p-4 rounded-lg border ${
                          step.is_anomalous
                            ? 'bg-red-50/50 border-red-200'
                            : 'bg-slate-50/70 border-slate-200'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900">
                              {step.stage_label_fa}
                            </span>
                            <span className="text-slate-400">·</span>
                            <span className="text-xs font-mono-num font-semibold text-blue-800">
                              شناسه: {step.record_id}
                            </span>
                            {step.is_anomalous && (
                              <span className="text-xs font-semibold text-red-700">
                                (محل بروز مغایرت)
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 font-mono-num">
                            تاریخ: {step.date_str} · منبع: {step.source_file} (سطر{' '}
                            {formatRials(step.source_row_id)})
                          </div>
                        </div>

                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-700">
                          <div>
                            <span className="text-slate-500">طرف حساب / اقدام‌کننده: </span>
                            <span className="font-medium">{step.actor_or_party}</span>
                            <span className="mx-2 text-slate-300">|</span>
                            <span>{step.details_fa}</span>
                          </div>
                          {typeof step.amount_rials === 'number' && step.amount_rials > 0 && (
                            <div className="font-mono-num font-bold text-slate-900">
                              {formatRials(step.amount_rials)} ریال
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Structured Raw Evidence JSON / Key-Value Table */}
                <section className="bg-white border border-slate-200 rounded-xl p-6">
                  <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
                    <h2 className="text-base font-bold text-slate-900">
                      ساختار فنی شواهد ثبت‌شده (Traceable Evidence Payload)
                    </h2>
                    <span className="text-xs text-slate-500">اطلاعات بانکی ماسک‌شده طبق بند ۸ PRD</span>
                  </div>
                  <div className="mt-3 divide-y divide-slate-100 text-xs">
                    {Object.entries(selectedAlert.evidence).map(([key, val]) => (
                      <div key={key} className="py-2.5 flex items-center justify-between gap-4">
                        <span className="font-mono-num text-slate-500">{key}</span>
                        <span className="font-mono-num font-medium text-slate-900 text-left">
                          {Array.isArray(val)
                            ? val.join(' ، ')
                            : typeof val === 'number'
                            ? formatRials(val)
                            : String(val ?? 'NULL')}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              {/* Right 5 Cols: Auditor Decision Form + Immutable Audit Trail */}
              <div className="lg:col-span-5 space-y-6">
                <section className="bg-white border border-slate-200 rounded-xl p-6">
                  <div className="pb-4 border-b border-slate-100 flex items-center gap-2">
                    <ClipboardCheck className="w-5 h-5 text-blue-700" />
                    <h2 className="text-base font-bold text-slate-900">
                      ثبت تصمیم و مستندات حسابرس (بند ۴.۵ PRD)
                    </h2>
                  </div>

                  <form onSubmit={handleSubmitAuditorDecision} className="space-y-4 mt-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        تغییر وضعیت پرونده هشدار:
                      </label>
                      <select
                        value={reviewStatus}
                        onChange={(e) => setReviewStatus(e.target.value as AlertStatus)}
                        className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2.5 bg-white text-slate-900 font-medium focus:outline-none focus:border-blue-600"
                      >
                        {(Object.keys(STATUS_LABELS) as AlertStatus[]).map((st) => (
                          <option key={st} value={st}>
                            {STATUS_LABELS[st]} ({st})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        مسئول رسیدگی (Assigned Auditor):
                      </label>
                      <select
                        value={reviewAssignee}
                        onChange={(e) => setReviewAssignee(e.target.value)}
                        className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2.5 bg-white text-slate-900 font-medium focus:outline-none focus:border-blue-600"
                      >
                        {AUDITORS_LIST.map((aud) => (
                          <option key={aud} value={aud}>
                            {aud}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        یادداشت و مستندات حسابرسی (ثبت در سیاهه تغییرناپذیر):
                      </label>
                      <textarea
                        rows={4}
                        value={reviewNote}
                        onChange={(e) => setReviewNote(e.target.value)}
                        placeholder="شرح بررسی اسناد مثبته، شماره نامه استعلام، مصوبه کمیسیون معاملات یا علت رد/تأیید هشدار..."
                        className="w-full text-xs border border-slate-300 rounded-lg p-3 bg-white text-slate-900 focus:outline-none focus:border-blue-600 leading-relaxed"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors cursor-pointer"
                    >
                      ثبت نتیجه بررسی در سیاهه ممیزی (Audit Trail)
                    </button>
                  </form>
                </section>

                {/* Immutable Audit Trail History */}
                <section className="bg-white border border-slate-200 rounded-xl p-6">
                  <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
                    <h2 className="text-base font-bold text-slate-900">
                      سیاهه ممیزی و تاریخچه تصمیمات (Audit Trail)
                    </h2>
                    <span className="text-xs text-slate-500 font-mono-num">
                      {formatRials(selectedAlertLogs.length)} رویداد ثبت‌شده
                    </span>
                  </div>

                  {selectedAlertLogs.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-500">
                      هنوز یادداشت یا تغییر وضعیتی برای این پرونده ثبت نشده است.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 mt-2">
                      {selectedAlertLogs.map((log) => (
                        <div key={log.log_id} className="py-3.5 space-y-1.5 text-xs">
                          <div className="flex items-center justify-between text-slate-500">
                            <span className="font-semibold text-slate-900">
                              {log.actor_id} ({log.actor_role_fa})
                            </span>
                            <span className="font-mono-num">{log.created_at}</span>
                          </div>
                          <div className="text-slate-600">
                            تغییر وضعیت از{' '}
                            <span className="font-semibold text-slate-800">
                              {log.previous_status ? STATUS_LABELS[log.previous_status] : 'اولیه'}
                            </span>{' '}
                            به{' '}
                            <span className="font-semibold text-blue-700">
                              {STATUS_LABELS[log.new_status]}
                            </span>
                          </div>
                          <p className="text-slate-700 bg-slate-50 p-2.5 rounded border border-slate-200 leading-relaxed">
                            {log.auditor_note}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
            VIEW 4: ENTITY RESOLUTION & DATA INGESTION (تطبیق موجودیت‌ها و کیفیت داده)
           ===================================================================== */}
        {activeTab === 'ingestion' && (
          <div className="space-y-8">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                دریافت داده، گزارش کیفیت و تطبیق موجودیت‌ها (Entity Resolution)
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                بارگذاری فایل‌های CSV استاندارد، بررسی پوشش فیلدها (تفکیک Null از صفر) و تعیین تکلیف تأمین‌کنندگان مشابه
              </p>
            </div>

            {/* Section 1: Direct CSV Upload & Sample Test Runner */}
            <section className="bg-white border border-slate-200 rounded-xl p-6">
              <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    ۱. بارگذاری و تحلیل مستقیم فایل CSV (لایه دریافت و استانداردسازی - بند ۴.۱ PRD)
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    فایل CSV فاکتورها یا سفارش‌های خرید را بارگذاری کنید تا نرمال‌سازی حروف عربی/فارسی، تاریخ شمسی و قواعد P0 روی آن اجرا شود
                  </p>
                </div>
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleCsvFileUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors inline-flex items-center gap-2 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>انتخاب و بارگذاری فایل CSV از سیستم</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div className="p-4 rounded-lg border border-slate-200 bg-slate-50/60 flex flex-col justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                      <FileSpreadsheet className="w-4 h-4 text-blue-700" />
                      <span>قالب استاندارد فاکتورها (invoices.csv)</span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      شامل سناریوی فاکتور مشابه (پسوند -A با اعداد فارسی) و فاکتور بدون سفارش خرید معتبر (3-Way Match).
                    </p>
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => handleRunSampleCsvTemplate('invoices.csv')}
                      className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      تست فوری این فایل روی موتور
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownloadCsvTemplate('invoices.csv')}
                      className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      دانلود فایل نمونه CSV
                    </button>
                  </div>
                </div>

                <div className="p-4 rounded-lg border border-slate-200 bg-slate-50/60 flex flex-col justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                      <FileSpreadsheet className="w-4 h-4 text-blue-700" />
                      <span>قالب استاندارد سفارش‌های خرید (purchase_orders.csv)</span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      شامل سناریوی شکستن سفارش خرید زیر سقف ۱۵۰ میلیون ریال (Split PO) و انحراف قیمت خرید روغن سرخ‌کردنی.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => handleRunSampleCsvTemplate('purchase_orders.csv')}
                      className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      تست فوری این فایل روی موتور
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownloadCsvTemplate('purchase_orders.csv')}
                      className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      دانلود فایل نمونه CSV
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* Section 2: Human-in-the-Loop Entity Resolution (بند ۴.۲ PRD) */}
            <section className="bg-white border border-slate-200 rounded-xl p-6">
              <div className="pb-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <GitCompare className="w-5 h-5 text-blue-700" />
                    <h2 className="text-base font-bold text-slate-900">
                      ۲. میز تطبیق موجودیت‌ها (Entity Resolution — موارد مبهم نیازمند بررسی انسانی)
                    </h2>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    طبق بند ۴.۲ PRD، در موارد شباهت فازی نام تأمین‌کننده بین سیستم خرید و مالی، سامانه ارتباط را قطعی تلقی نکرده و برای تأیید حسابرس علامت‌گذاری می‌کند
                  </p>
                </div>
              </div>

              <div className="divide-y divide-slate-200 mt-2">
                {engineState.entityCandidates.map((cand: EntityCandidate) => (
                  <div
                    key={cand.candidate_id}
                    className="py-4 flex flex-wrap items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5 flex-1 min-w-[280px]">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-bold text-slate-900">
                          {cand.left_label} ({cand.left_id})
                        </span>
                        <span className="text-slate-400">⟷</span>
                        <span className="font-bold text-slate-900">
                          {cand.right_label} ({cand.right_id})
                        </span>
                        <span className="text-slate-400">·</span>
                        <span className="text-xs font-mono-num font-semibold text-blue-700">
                          شباهت: {(cand.similarity_score * 100).toLocaleString('fa-IR')}٪
                        </span>
                      </div>

                      <div className="text-xs text-slate-600">
                        <span>علت علامت‌گذاری: {cand.match_reason_fa}</span>
                        {cand.shared_attribute && (
                          <>
                            <span className="mx-1.5">·</span>
                            <span className="font-medium text-slate-800">
                              مشخصه مشترک: {cand.shared_attribute}
                            </span>
                          </>
                        )}
                      </div>

                      <div className="text-xs text-slate-500 font-mono-num">
                        <span>نام خام اول: «{cand.left_raw}» ({cand.left_iban_masked})</span>
                        <span className="mx-2">|</span>
                        <span>نام خام دوم: «{cand.right_raw}» ({cand.right_iban_masked})</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {cand.review_status === 'PENDING_HUMAN_REVIEW' ? (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              handleEntityResolutionAction(
                                cand.candidate_id,
                                'MERGED_CONFIRMED'
                              )
                            }
                            className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-700 rounded-md hover:bg-blue-800 transition-colors cursor-pointer"
                          >
                            تأیید ارتباط (ذی‌نفع واحد)
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleEntityResolutionAction(
                                cand.candidate_id,
                                'SEPARATE_ENTITIES'
                              )
                            }
                            className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors cursor-pointer"
                          >
                            موجودیت‌های مجزا
                          </button>
                        </>
                      ) : (
                        <div className="text-xs font-medium text-emerald-700 flex items-center gap-1.5">
                          <UserCheck className="w-4 h-4" />
                          <span>
                            {cand.review_status === 'MERGED_CONFIRMED'
                              ? 'تأیید و یکپارچه‌شده توسط حسابرس'
                              : 'رد ارتباط (شخصیت حقوقی مجزا)'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Section 3: Data Quality & Coverage Report (بند ۴.۱ و ۶.۲ PRD) */}
            <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Database className="w-5 h-5 text-blue-700" />
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      ۳. گزارش کیفیت، پوشش فیلدها و استانداردسازی داده (Data Quality Report)
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      تفکیک دقیق مقادیر ناقص (Null/Empty) از مقدار عدد صفر (Zero Value) و آمار نرمال‌سازی حروف و تاریخ شمسی
                    </p>
                  </div>
                </div>
                <span className="text-xs font-mono-num text-emerald-700 font-semibold">
                  پوشش فیلدهای ضروری: {summary.benchmark.essential_field_coverage_pct.toLocaleString('fa-IR')}٪ (هدف PRD: حداقل ۹۰٪)
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                    <tr>
                      <th className="py-3 px-4 font-semibold">فایل / جدول استاندارد</th>
                      <th className="py-3 px-4 font-semibold">تعداد رکورد</th>
                      <th className="py-3 px-4 font-semibold">پوشش فیلدهای ضروری</th>
                      <th className="py-3 px-4 font-semibold">اصلاح حروف/ارقام فارسی</th>
                      <th className="py-3 px-4 font-semibold">استانداردسازی تاریخ شمسی</th>
                      <th className="py-3 px-4 font-semibold">تفکیک Null از مقدار صفر در ستون‌ها</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {engineState.qualityReports.map((qr) => (
                      <tr key={qr.table_name} className="hover:bg-slate-50">
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900">{qr.table_label_fa}</div>
                          <div className="text-xs text-slate-500 font-mono-num">{qr.table_name}</div>
                        </td>
                        <td className="py-3.5 px-4 font-mono-num font-semibold text-slate-900">
                          {formatRials(qr.row_count)}
                        </td>
                        <td className="py-3.5 px-4 font-mono-num font-bold text-emerald-700">
                          {qr.required_coverage_pct.toLocaleString('fa-IR')}٪
                        </td>
                        <td className="py-3.5 px-4 font-mono-num text-slate-700">
                          {formatRials(qr.normalized_persian_count)} مورد
                        </td>
                        <td className="py-3.5 px-4 font-mono-num text-slate-700">
                          {formatRials(qr.normalized_dates_count)} تاریخ
                        </td>
                        <td className="py-3.5 px-4 text-xs text-slate-600 font-mono-num">
                          <div className="flex flex-wrap items-center gap-3">
                            {Object.entries(qr.columns).map(([colName, metric]) => (
                              <span key={colName}>
                                {colName}: (خالی={formatRials(metric.null_or_empty_count)}، صفر=
                                {formatRials(metric.zero_value_count)})
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </main>

      {/* Quiet Footer */}
      <footer className="bg-white border-t border-slate-200 px-6 py-4 mt-12 text-xs text-slate-500">
        <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-slate-400" />
            <span>
              موتور هوشمند پایش مستمر ریسک در چرخه خرید تا پرداخت شرکت‌های پخش (MVP نسخه ۱.۰)
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span>معماری: Modular Monolith · Read-Only</span>
            <span aria-hidden="true">·</span>
            <span>ماسک اطلاعات بانکی (IBAN Masking) فعال</span>
            <span aria-hidden="true">·</span>
            <span>سیاهه ممیزی (Audit Trail) فعال</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
