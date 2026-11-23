import { ButtonHTMLAttributes, ReactNode, useId } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ChevronLeft } from 'lucide-react';
import { AlertPriority, AlertStatus, RiskAlert } from './types';
import { formatRials, PRIORITY_LABELS, STATUS_LABELS, WAREHOUSE_NAMES } from './engine/p2pEngine';

export const EASE = [0.32, 0.72, 0, 1] as const;

export function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(' ');
}

/** A pane of liquid glass (see .glass-pane in index.css). */
export function Panel({
  children,
  className,
  inner,
}: {
  children: ReactNode;
  className?: string;
  inner?: string;
}) {
  return <div className={cx('glass-pane', className, inner)}>{children}</div>;
}

export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ duration: 0.9, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'quiet';
  icon?: ReactNode;
};

/** Pill button; a trailing icon sits in its own circle and leans forward on hover. */
export function Button({ variant = 'primary', icon, children, className, type, ...rest }: ButtonProps) {
  const look = {
    primary: 'liquid-ink hover:brightness-110',
    ghost: 'glass-tile text-ink hover:bg-white/75',
    quiet: 'text-ink hover:bg-white/55',
  }[variant];
  return (
    <button
      type={type ?? 'button'}
      className={cx(
        'group inline-flex min-h-11 cursor-pointer select-none items-center gap-3 rounded-full text-[15px] font-semibold whitespace-nowrap transition-all duration-500 ease-spring active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50',
        icon ? 'ps-5 pe-1.5' : 'px-5',
        look,
        className
      )}
      {...rest}
    >
      <span>{children}</span>
      {icon && (
        <span
          className={cx(
            'flex h-8 w-8 items-center justify-center rounded-full transition-transform duration-500 ease-spring group-hover:-translate-x-0.5 group-hover:scale-105',
            variant === 'primary'
              ? 'bg-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]'
              : 'bg-white/70 shadow-[inset_0_1px_0_#fff,0_2px_6px_-3px_rgba(15,33,56,0.35)]'
          )}
        >
          {icon}
        </span>
      )}
    </button>
  );
}

type Tone = 'neutral' | 'level' | 'flag' | 'amber';
const TONES: Record<Tone, string> = {
  neutral: 'bg-white/60 text-ink shadow-[inset_0_0_0_1px_rgba(255,255,255,0.9)]',
  level: 'bg-level/[0.12] text-level shadow-[inset_0_0_0_1px_rgba(19,138,107,0.12)]',
  flag: 'bg-flag/[0.1] text-flag shadow-[inset_0_0_0_1px_rgba(207,59,51,0.14)]',
  amber: 'bg-amber/[0.1] text-amber shadow-[inset_0_0_0_1px_rgba(154,98,16,0.14)]',
};

export function Chip({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-[13px] font-semibold whitespace-nowrap',
        TONES[tone]
      )}
    >
      {children}
    </span>
  );
}

const PRIORITY_TONE: Record<AlertPriority, Tone> = {
  CRITICAL: 'flag',
  HIGH: 'amber',
  MEDIUM: 'neutral',
  LOW: 'neutral',
};
const STATUS_TONE: Record<AlertStatus, Tone> = {
  NEW: 'neutral',
  IN_REVIEW: 'amber',
  NEEDS_INFO: 'amber',
  CONFIRMED: 'flag',
  FALSE_POSITIVE: 'neutral',
  CLOSED: 'level',
};

export function PriorityChip({ priority }: { priority: AlertPriority }) {
  return <Chip tone={PRIORITY_TONE[priority]}>{PRIORITY_LABELS[priority]}</Chip>;
}
export function StatusChip({ status }: { status: AlertStatus }) {
  return <Chip tone={STATUS_TONE[status]}>{STATUS_LABELS[status]}</Chip>;
}

function severity(score: number) {
  if (score >= 85) return { top: '#fdeeed', bottom: '#f3bcb6', edge: '#cf3b33' };
  if (score >= 60) return { top: '#fdf5e6', bottom: '#f0d49e', edge: '#9a6210' };
  return { top: '#eaf8f2', bottom: '#a9dfca', edge: '#138a6b' };
}

/**
 * The spirit level. The bubble sits between the two marks when all is in order
 * and drifts away from them as the risk score rises.
 */
export function Vial({ score, width = 96, settle = false }: { score: number; width?: number; settle?: boolean }) {
  const reduce = useReducedMotion();
  const clamped = Math.min(100, Math.max(0, score));
  const travel = 33; // centre 50, inner wall 6, bubble rx 11
  const offset = -(clamped / 100) * travel;
  const { top, bottom, edge } = severity(clamped);
  const id = useId().replace(/:/g, '');
  const label = `شدت ریسک ${clamped.toLocaleString('fa-IR')} از ۱۰۰`;
  return (
    <svg viewBox="0 0 100 34" width={width} height={(width * 34) / 100} role="img" aria-label={label}>
      <defs>
        <linearGradient id={`${id}l`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={top} />
          <stop offset="1" stopColor={bottom} />
        </linearGradient>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.95" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.35" />
          <stop offset="1" stopColor="#fff" stopOpacity="0.7" />
        </linearGradient>
        <radialGradient id={`${id}b`} cx="0.38" cy="0.32" r="0.75">
          <stop offset="0" stopColor="#fff" />
          <stop offset="0.6" stopColor="#fff" stopOpacity="0.9" />
          <stop offset="1" stopColor={top} />
        </radialGradient>
      </defs>
      <rect x="1.5" y="3" width="97" height="28" rx="14" fill={`url(#${id}g)`} stroke="#0f2138" strokeOpacity="0.85" strokeWidth="2" />
      <rect x="6" y="7.5" width="88" height="19" rx="9.5" fill={`url(#${id}l)`} />
      <rect x="10" y="8.6" width="80" height="3.2" rx="1.6" fill="#fff" opacity="0.7" />
      <line x1="43" y1="6" x2="43" y2="28" stroke="#0f2138" strokeOpacity="0.8" strokeWidth="1.3" />
      <line x1="57" y1="6" x2="57" y2="28" stroke="#0f2138" strokeOpacity="0.8" strokeWidth="1.3" />
      <motion.g
        initial={reduce ? false : { x: settle ? -travel : 0 }}
        animate={{ x: offset }}
        transition={settle ? { type: 'spring', stiffness: 40, damping: 9, delay: 0.3 } : { duration: 0.9, ease: EASE }}
      >
        <ellipse cx="50" cy="17" rx="11" ry="7.5" fill={`url(#${id}b)`} stroke={edge} strokeWidth="1.8" />
        <ellipse cx="46" cy="14.2" rx="4" ry="1.6" fill="#fff" />
      </motion.g>
    </svg>
  );
}

export function BrandMark({ size = 30 }: { size?: number }) {
  return (
    <svg viewBox="0 0 64 24" width={size * 1.6} height={size * 0.6} aria-hidden="true">
      <rect x="1.5" y="3" width="61" height="18" rx="9" fill="#cdeee1" stroke="#0f2138" strokeWidth="2.5" />
      <rect x="6" y="5.6" width="52" height="2.6" rx="1.3" fill="#fff" opacity="0.8" />
      <line x1="26" y1="5" x2="26" y2="19" stroke="#0f2138" strokeWidth="1.5" />
      <line x1="38" y1="5" x2="38" y2="19" stroke="#0f2138" strokeWidth="1.5" />
      <ellipse cx="32" cy="12" rx="5" ry="4" fill="#fff" stroke="#0f2138" strokeWidth="1.5" />
    </svg>
  );
}

export function PageHead({
  eyebrow,
  title,
  lead,
  actions,
}: {
  eyebrow: string;
  title: ReactNode;
  lead?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <Reveal className="flex flex-wrap items-end justify-between gap-6">
      <div className="max-w-3xl">
        <span className="glass-tile inline-flex rounded-full px-3 py-0.5 text-[13px] font-semibold text-muted">
          {eyebrow}
        </span>
        <h1 className="mt-4 text-[30px] font-extrabold leading-[1.35] text-ink md:text-[34px]">{title}</h1>
        {lead && <p className="mt-3 text-[16px] leading-8 text-muted">{lead}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
    </Reveal>
  );
}

export function SectionTitle({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 px-6 pt-6 md:px-8 md:pt-7">
      <div>
        <h2 className="text-[19px] font-bold text-ink">{title}</h2>
        {hint && <p className="mt-1 text-[14px] leading-7 text-muted">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

export function AlertRow({ alert, onOpen }: { alert: RiskAlert; onOpen: (a: RiskAlert) => void }) {
  const place = alert.warehouse_code ? WAREHOUSE_NAMES[alert.warehouse_code] || alert.warehouse_code : '';
  return (
    <button
      type="button"
      onClick={() => onOpen(alert)}
      className="group grid w-full cursor-pointer grid-cols-1 items-center gap-x-6 gap-y-3 rounded-[18px] px-4 py-4 text-right transition-colors duration-500 ease-spring hover:bg-white/55 md:grid-cols-[104px_minmax(0,1fr)_190px_170px_24px]"
    >
      <div className="flex flex-col items-start gap-1">
        <Vial score={alert.risk_score} width={92} />
        <span className="num text-[13px] font-semibold text-muted">
          {alert.risk_score.toLocaleString('fa-IR')} از ۱۰۰
        </span>
      </div>
      <div className="min-w-0">
        <div className="text-[16px] font-bold text-ink">{alert.rule_title_fa}</div>
        <p className="mt-1 line-clamp-2 text-[14px] leading-7 text-muted">{alert.summary_fa}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <PriorityChip priority={alert.priority} />
          <StatusChip status={alert.status} />
          {alert.source_fa && <Chip tone="level">{alert.source_fa}</Chip>}
        </div>
      </div>
      <div className="min-w-0 text-[14px] leading-7">
        <div className="truncate font-semibold text-ink">{alert.supplier_name || 'بدون تأمین‌کننده'}</div>
        <div className="truncate text-muted">{place}</div>
      </div>
      <div className="num text-[16px] font-bold text-ink md:text-left">
        {formatRials(alert.financial_exposure)} <span className="text-[13px] font-medium text-muted">ریال</span>
      </div>
      <ChevronLeft
        className="hidden h-5 w-5 text-muted transition-transform duration-500 ease-spring group-hover:-translate-x-1 md:block"
        strokeWidth={1.5}
      />
    </button>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[14px] font-semibold text-ink">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  'glass-well w-full min-h-11 rounded-2xl px-4 text-[15px] text-ink transition-all duration-500 ease-spring placeholder:text-muted/80 focus:bg-white/75 focus:outline-none focus:ring-2 focus:ring-level/50';

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <Vial score={0} width={120} />
      <div className="mt-6 text-[18px] font-bold text-ink">{title}</div>
      {children && <p className="mt-2 max-w-md text-[15px] leading-8 text-muted">{children}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

