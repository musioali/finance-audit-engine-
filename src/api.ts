/**
 * The Tarazban engine runs as a service on the company's own server (server/ in this repository).
 * In development Vite forwards /api to it; in production the service serves this app itself.
 */
import { AlertAuditLog, AlertStatus, RiskAlert, TableQualityReport } from './types';

export type ServerState = {
  files: string[];
  total_records: number;
  alerts: RiskAlert[];
  audit_logs: AlertAuditLog[];
  quality_reports: TableQualityReport[];
};

export type MappingKind = {
  name: string;
  label: string;
  fields: Array<{ name: string; label: string; required: boolean }>;
};

export type NeedsMapping = {
  status: 'needs_mapping';
  upload_id: number;
  file_name: string;
  headers: string[];
  sample_rows: string[][];
  kind: string;
  suggestions: Record<string, Record<string, string>>;
  kinds: MappingKind[];
};

export type Ingested = {
  status: 'done';
  file_name: string;
  kind: string;
  rows: number;
  new_rows: number;
  alerts_added: number;
};

const UNREACHABLE = 'موتور ترازبان در دسترس نیست. سرویس آن باید روی سرور اجرا شده باشد.';

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, init);
  } catch {
    throw new Error(UNREACHABLE);
  }
  const body = await res.json().catch(() => null);
  if (!body) throw new Error(UNREACHABLE);
  if (!res.ok) throw new Error(typeof body.detail === 'string' ? body.detail : 'موتور ترازبان این درخواست را نپذیرفت.');
  return body as T;
}

const json = (data: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data),
});

/** ISO time from the server, shown as a Jalali date and time. */
export function jalaliTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.toLocaleDateString('fa-IR')}، ${d.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}`;
}

export async function fetchState(): Promise<ServerState> {
  const s = await call<ServerState>('/state');
  return {
    ...s,
    alerts: s.alerts.map((a) => ({ ...a, created_at: jalaliTime(a.created_at) })),
    audit_logs: s.audit_logs.map((l) => ({ ...l, created_at: jalaliTime(l.created_at) })),
  };
}

export function uploadFile(file: Blob, name: string) {
  const form = new FormData();
  form.append('file', file, name);
  return call<Ingested | NeedsMapping>('/uploads', { method: 'POST', body: form });
}

export function confirmMapping(uploadId: number, kind: string, mapping: Record<string, string>) {
  return call<Ingested>(`/uploads/${uploadId}/mapping`, json({ kind, mapping }));
}

export async function saveDecision(alertId: string, d: { status: AlertStatus; assignee: string; note: string }) {
  const { log } = await call<{ log: AlertAuditLog }>(`/alerts/${encodeURIComponent(alertId)}/decisions`, json(d));
  return { ...log, created_at: jalaliTime(log.created_at) };
}
