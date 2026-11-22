export type AlertPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type AlertStatus =
  | 'NEW'
  | 'IN_REVIEW'
  | 'NEEDS_INFO'
  | 'CONFIRMED'
  | 'FALSE_POSITIVE'
  | 'CLOSED';

export type P0RuleId =
  | 'P0_DUPLICATE_INVOICE'
  | 'P0_SPLIT_PO'
  | 'P0_3WAY_MATCH'
  | 'P0_PRICE_DEVIATION'
  | 'P0_SUPPLIER_RISK'
  | 'P0_APPROVAL_DEVIATION';

export interface LinkedCycleRecord {
  stage: 'PR' | 'PO' | 'GR' | 'INVOICE' | 'PAYMENT' | 'SUPPLIER' | 'APPROVER';
  stage_label_fa: string;
  record_id: string;
  date_str: string;
  amount_rials?: number;
  actor_or_party: string;
  details_fa: string;
  is_anomalous?: boolean;
  source_file: string;
  source_row_id: number;
}

export interface RiskAlert {
  alert_id: string;
  batch_id: string;
  rule_id: P0RuleId;
  rule_title_fa: string;
  rule_version: string;
  primary_entity_id: string;
  supplier_id: string | null;
  supplier_name: string | null;
  warehouse_code: string | null;
  department: string | null;
  risk_score: number;
  confidence_score: number;
  financial_exposure: number;
  priority: AlertPriority;
  status: AlertStatus;
  assigned_to: string | null;
  summary_fa: string;
  why_flagged_fa: string[];
  evidence: Record<string, unknown>;
  p2p_chain: LinkedCycleRecord[];
  is_ground_truth_tp?: boolean;
  created_at: string;
}

export interface AlertAuditLog {
  log_id: string;
  alert_id: string;
  actor_id: string;
  actor_role_fa: string;
  previous_status: AlertStatus | null;
  new_status: AlertStatus;
  assigned_to: string | null;
  auditor_note: string;
  created_at: string;
}

export interface ColumnQualityMetric {
  coverage_pct: number;
  null_or_empty_count: number;
  zero_value_count: number;
}

export interface TableQualityReport {
  table_name: string;
  table_label_fa: string;
  row_count: number;
  required_coverage_pct: number;
  normalized_persian_count: number;
  normalized_dates_count: number;
  columns: Record<string, ColumnQualityMetric>;
}

export interface EntityCandidate {
  candidate_id: string;
  batch_id: string;
  entity_type: 'SUPPLIER';
  left_id: string;
  left_label: string;
  left_raw: string;
  left_iban_masked: string;
  right_id: string;
  right_label: string;
  right_raw: string;
  right_iban_masked: string;
  similarity_score: number;
  match_reason_fa: string;
  shared_attribute: string | null;
  review_status: 'PENDING_HUMAN_REVIEW' | 'MERGED_CONFIRMED' | 'SEPARATE_ENTITIES';
  reviewed_by?: string;
  reviewed_at?: string;
}

export interface BenchmarkMetrics {
  total_records_analyzed: number;
  execution_seconds: number;
  sla_target_seconds: number;
  precision_at_20: number;
  target_precision_at_20: number;
  seeded_anomalies_count: number;
  detected_true_positives: number;
  evidence_traceability_pct: number;
  source_attribution_pct: number;
  essential_field_coverage_pct: number;
}

export interface DashboardSummary {
  total_alerts: number;
  total_financial_exposure_rials: number;
  open_critical_count: number;
  confirmed_exposure_rials: number;
  false_positive_rate_pct: number;
  by_priority: Record<AlertPriority, number>;
  by_status: Record<AlertStatus, number>;
  by_rule: Array<{
    rule_id: P0RuleId;
    rule_title_fa: string;
    count: number;
    exposure_rials: number;
    avg_risk_score: number;
  }>;
  by_warehouse: Array<{
    warehouse_code: string;
    warehouse_name_fa: string;
    alert_count: number;
    exposure_rials: number;
  }>;
  latest_batch: {
    batch_id: string;
    source_system: string;
    data_version: string;
    received_at: string;
    total_records: number;
    execution_seconds: number;
    quality_reports: TableQualityReport[];
  };
  benchmark: BenchmarkMetrics;
}
