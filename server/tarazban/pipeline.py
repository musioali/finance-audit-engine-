"""
From a received file to stored alerts:

receive  -> the file is kept; its columns are mapped from a saved mapping, from standard names,
            or else the person is asked once
ingest   -> rows go into the standard model; rows already received are skipped
detect   -> each supplier's normal behaviour is learned again from all rows received so far,
            then every detector runs over those rows, so a re-entry next month is caught against
            this month's invoice and each file sharpens what counts as normal
decide   -> the auditor's decision is logged with the alert's features as they were
learn    -> on every read, the decisions so far set each alert's confidence and its place in the
            list (learning.py): what the auditors confirm rises, what they reject sinks
"""
import hashlib
import json
from collections import Counter, defaultdict

from . import baselines, learning, tables
from . import mapping as mapper
from .detectors import DETECTORS, TITLES, voided
from .explain import basis_words, chain, describe, where
from .schema import KINDS
from .store import now
from .text import day_number, norm_text, parse_amount, read_csv


class BadFile(ValueError):
    """A problem with what was sent; the message is for the person."""


STATUSES = ('NEW', 'IN_REVIEW', 'NEEDS_INFO', 'CONFIRMED', 'FALSE_POSITIVE', 'CLOSED')


def _table(content: str) -> tuple[list[str], list[tuple[int, list[str]]]]:
    """Column names and data rows of a received file, from the rows kept for it until it is read in."""
    try:
        rows = [(n, cells) for n, cells in json.loads(content)['rows']]
    except (ValueError, TypeError, KeyError):  # kept before Excel was read: the CSV text itself
        rows = read_csv(content)
    names, data = tables.tidy(rows)
    if not names or not data:
        raise BadFile('فایل باید دست‌کم یک سطر نام ستون‌ها و یک سطر داده داشته باشد.')
    return [h or f'ستون {i + 1}' for i, h in enumerate(names)], data


def receive(conn, file_name: str, data: bytes) -> dict:
    try:
        rows, sheet = tables.read(data)
    except tables.Unreadable as e:
        raise BadFile(str(e)) from e
    content = json.dumps({'rows': rows}, ensure_ascii=False)
    headers, rows = _table(content)
    if sheet:  # a workbook with several sheets: evidence names the sheet too
        file_name = f'{file_name}، برگهٔ «{sheet}»'
    cur = conn.execute(
        'INSERT INTO uploads (file_name, content, headers, status, created_at) VALUES (?, ?, ?, ?, ?)',
        (file_name, content, json.dumps(headers, ensure_ascii=False), 'pending', now()),
    )
    upload_id = cur.lastrowid
    conn.commit()

    saved = conn.execute('SELECT kind, mapping FROM mappings WHERE signature = ?', (mapper.signature(headers),)).fetchone()
    if saved:
        return ingest(conn, upload_id, saved['kind'], json.loads(saved['mapping']))
    guess = mapper.suggest(headers)
    if guess['standard']:
        return ingest(conn, upload_id, guess['kind'], guess['mappings'][guess['kind']])
    return {
        'status': 'needs_mapping',
        'upload_id': upload_id,
        'file_name': file_name,
        'headers': headers,
        'sample_rows': [cells for _, cells in rows[:3]],
        'kind': guess['kind'],
        'suggestions': guess['mappings'],
        'kinds': [
            {'name': k.name, 'label': k.label,
             'fields': [{'name': f.name, 'label': f.label, 'required': f.required} for f in k.fields]}
            for k in KINDS.values()
        ],
    }


def ingest(conn, upload_id: int, kind_name: str, mapping: dict, confirmed: bool = False) -> dict:
    up = conn.execute('SELECT * FROM uploads WHERE id = ?', (upload_id,)).fetchone()
    if not up:
        raise BadFile('این فایل پیدا نشد. دوباره بارگذاری کنید.')
    if up['status'] == 'done':
        raise BadFile('این فایل قبلاً بررسی شده است.')
    headers, rows = _table(up['content'])
    try:
        mapping = mapper.check(kind_name, mapping, headers)
    except ValueError as e:
        raise BadFile(str(e)) from e
    kind = KINDS[kind_name]
    columns = {f: headers.index(c) for f, c in mapping.items()}

    # A row's fingerprint is its content plus how many identical rows came before it in the file:
    # the same export received twice adds nothing, while two identical rows in one file stay two.
    records, repeats = [], Counter()
    for line, cells in rows:
        data = {f: (cells[i].strip() if i < len(cells) else '') for f, i in columns.items()}
        content = json.dumps(data, sort_keys=True, ensure_ascii=False)
        fingerprint = hashlib.sha1(f'{content}#{repeats[content]}'.encode()).hexdigest()
        repeats[content] += 1
        records.append((kind.name, fingerprint, upload_id, up['file_name'], line, json.dumps(data, ensure_ascii=False)))
    before = conn.total_changes
    conn.executemany(
        'INSERT OR IGNORE INTO records (kind, fingerprint, upload_id, file_name, row_no, data) VALUES (?, ?, ?, ?, ?, ?)',
        records,
    )
    new_rows = conn.total_changes - before

    report = quality_report(up['file_name'], kind, mapping, [json.loads(r[5]) for r in records])
    conn.execute('INSERT OR REPLACE INTO quality (file_name, report) VALUES (?, ?)', (up['file_name'], json.dumps(report, ensure_ascii=False)))
    if confirmed:
        conn.execute(
            'INSERT OR REPLACE INTO mappings (signature, kind, mapping, headers, created_at) VALUES (?, ?, ?, ?, ?)',
            (mapper.signature(headers), kind.name, json.dumps(mapping, ensure_ascii=False), json.dumps(headers, ensure_ascii=False), now()),
        )
    added = detect(conn, upload_id) if new_rows else 0
    conn.execute(
        "UPDATE uploads SET status = 'done', content = NULL, kind = ?, mapping = ?, rows = ?, new_rows = ?, alerts_added = ? WHERE id = ?",
        (kind.name, json.dumps(mapping, ensure_ascii=False), len(records), new_rows, added, upload_id),
    )
    conn.commit()
    return {'status': 'done', 'file_name': up['file_name'], 'kind': kind.name, 'rows': len(records), 'new_rows': new_rows, 'alerts_added': added}


def load_records(conn, kind: str | None = None) -> list[dict]:
    sql = 'SELECT id, kind, file_name, row_no, data FROM records' + (' WHERE kind = ?' if kind else '') + ' ORDER BY id'
    out = []
    for r in conn.execute(sql, (kind,) if kind else ()):
        rec = json.loads(r['data'])
        rec.update(_id=r['id'], _kind=r['kind'], _file=r['file_name'], _row=r['row_no'])
        out.append(rec)
    return out


def detect(conn, upload_id: int) -> int:
    """Runs every detector over all rows received so far and stores what is new. Returns how many alerts were added."""
    rows = {k: [r for r in load_records(conn, k) if not voided(r)] for k in KINDS}
    profiles = baselines.learn(rows)
    primary = [d for d in DETECTORS if not getattr(d, 'supplementary', False)]
    extra = [d for d in DETECTORS if getattr(d, 'supplementary', False)]
    findings = [f for d in primary for f in d.run(rows[d.kind], profiles)]
    covered = {i for f in findings for i in f.records}
    for d in extra:
        findings.extend(f for f in d.run(rows[d.kind], profiles, covered) if not covered & set(f.records))
    versions = {d.id: d.version for d in DETECTORS}

    known, by_record, by_key = {}, defaultdict(set), {}
    for r in conn.execute('SELECT id, alert_key, detector, record_ids FROM alerts'):
        known[r['id']] = (r['detector'], set(json.loads(r['record_ids'])))
        by_key[r['alert_key']] = r['id']
        for i in known[r['id']][1]:
            by_record[i].add(r['id'])
    added, stamp = 0, now()
    for f in findings:
        ids = set(f.records)
        key = f'{f.detector}:' + '-'.join(str(i) for i in sorted(ids))
        values = (
            key, versions[f.detector], f.entity, f.supplier_id, f.supplier_name, f.warehouse,
            round(min(99, max(0, f.risk)), 1), round(f.confidence), f.exposure,
            json.dumps(f.facts, ensure_ascii=False), json.dumps(f.features),
            json.dumps([s.__dict__ for s in f.steps], ensure_ascii=False), json.dumps(sorted(ids)), stamp,
        )
        # the same finding again, or a known one that grew (a third split order arrived): update it in place,
        # so its status and decisions stay with it
        sharing = set().union(*(by_record[i] for i in ids if i in by_record))
        alert_id = by_key.get(key) or next(
            (a for a in sorted(sharing) if known[a][0] == f.detector and known[a][1] < ids), None)
        if alert_id:
            conn.execute(
                'UPDATE alerts SET alert_key = ?, version = ?, entity = ?, supplier_id = ?, supplier_name = ?, warehouse_code = ?, '
                'risk = ?, confidence = ?, exposure = ?, facts = ?, features = ?, steps = ?, record_ids = ?, updated_at = ? WHERE id = ?',
                (*values, alert_id),
            )
        else:
            alert_id = conn.execute(
                'INSERT INTO alerts (alert_key, version, entity, supplier_id, supplier_name, warehouse_code, risk, confidence, exposure, '
                'facts, features, steps, record_ids, updated_at, detector, upload_id, created_at) '
                'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                (*values, f.detector, upload_id, stamp),
            ).lastrowid
            added += 1
        by_key[key] = alert_id
        known[alert_id] = (f.detector, ids)
        for i in ids:
            by_record[i].add(alert_id)
    return added


def quality_report(file_name: str, kind, mapping: dict, rows: list[dict]) -> dict:
    columns, normalized, valid_dates = {}, 0, 0
    for field_name, column in mapping.items():
        ftype = kind.field(field_name).type
        empty = zero = invalid = 0
        for r in rows:
            v = r.get(field_name, '')
            if not v:
                empty += 1
                continue
            if not v.isascii() and norm_text(v) != v:
                normalized += 1
            if ftype == 'amount':
                n = parse_amount(v)
                if n is None:
                    invalid += 1
                elif n == 0:
                    zero += 1
            elif ftype == 'date':
                if day_number(v) is None:
                    invalid += 1
                else:
                    valid_dates += 1
        columns[field_name] = {
            'column': column,
            'coverage_pct': round((len(rows) - empty - invalid) / max(1, len(rows)) * 100, 1),
            'null_or_empty_count': empty,
            'zero_value_count': zero,
            'invalid_count': invalid,
        }
    # a supplier name stands in for a missing supplier code
    core = ['supplier_name' if f == 'supplier_id' and f not in columns else f for f in kind.core]
    coverage = [columns[f]['coverage_pct'] if f in columns else 0 for f in core]
    return {
        'table_name': file_name,
        'table_label_fa': f'{kind.label}، {file_name}',
        'row_count': len(rows),
        'required_coverage_pct': round(sum(coverage) / len(coverage), 1),
        'normalized_persian_count': normalized,
        'normalized_dates_count': valid_dates,
        'columns': {c['column']: {k: v for k, v in c.items() if k != 'column'} for c in columns.values()},
    }


def _priority(risk: float) -> str:
    return 'CRITICAL' if risk >= 90 else 'HIGH' if risk >= 80 else 'MEDIUM' if risk >= 65 else 'LOW'


def alert_id_of(n: int) -> str:
    return f'TZ-{n:05d}'


def alert_json(row, records: dict[int, dict], learned: learning.Learned) -> dict:
    facts = json.loads(row['facts'])
    steps = json.loads(row['steps'])
    places = [where(records[s['record']]) for s in steps]
    summary, why = describe(row['detector'], facts, places)
    confidence, basis = learned.confidence(row['detector'], learning.supplier_of(row), row['confidence'], json.loads(row['features']))
    basis_short, basis_lines = basis_words(TITLES.get(row['detector'], row['detector']), basis, confidence)
    return {
        'alert_id': alert_id_of(row['id']),
        'batch_id': f'U-{row["upload_id"]}',
        'rule_id': row['detector'],
        'rule_title_fa': TITLES.get(row['detector'], row['detector']),
        'rule_version': row['version'],
        'primary_entity_id': row['entity'],
        'supplier_id': row['supplier_id'],
        'supplier_name': row['supplier_name'],
        'warehouse_code': row['warehouse_code'],
        'department': None,
        'risk_score': row['risk'],
        'confidence_score': confidence,
        'confidence_basis_fa': basis_short,
        'financial_exposure': row['exposure'],
        'priority': _priority(row['risk']),
        'status': row['status'],
        'assigned_to': row['assigned_to'],
        'summary_fa': summary,
        'why_flagged_fa': why + basis_lines,
        'evidence': {**facts, 'source_rows': [where(records[i]) for i in json.loads(row['record_ids'])]},
        'p2p_chain': chain(row['detector'], steps, records, facts),
        'created_at': row['created_at'],
    }


def _log_json(row) -> dict:
    return {
        'log_id': f'D-{row["id"]}',
        'alert_id': alert_id_of(row['alert_id']),
        'actor_id': row['actor'],
        'actor_role_fa': row['role'],
        'previous_status': row['previous_status'],
        'new_status': row['status'],
        'assigned_to': row['assigned_to'],
        'auditor_note': row['note'],
        'created_at': row['created_at'],
    }


def state(conn) -> dict:
    records = {r['_id']: r for r in load_records(conn)}
    learned = learning.learn(conn)
    alerts = [alert_json(a, records, learned) for a in conn.execute('SELECT * FROM alerts ORDER BY id')]
    # most important first: how strong the signal is, times how likely the auditors are to confirm it
    alerts.sort(key=lambda a: (-a['risk_score'] * a['confidence_score'], -a['financial_exposure']))
    return {
        'files': [r['file_name'] for r in conn.execute("SELECT file_name FROM uploads WHERE status = 'done' GROUP BY file_name ORDER BY MIN(id)")],
        'total_records': len(records),
        'alerts': alerts,
        'audit_logs': [_log_json(r) for r in conn.execute('SELECT * FROM decisions ORDER BY id DESC')],
        'quality_reports': [json.loads(r['report']) for r in conn.execute('SELECT report FROM quality ORDER BY rowid DESC')],
    }


def decide(conn, alert_ref: str, status: str, assignee: str, note: str) -> dict:
    if status not in STATUSES:
        raise BadFile('وضعیت شناخته نشد.')
    try:
        n = int(alert_ref.removeprefix('TZ-'))
    except ValueError:
        n = -1
    alert = conn.execute('SELECT * FROM alerts WHERE id = ?', (n,)).fetchone()
    if not alert:
        raise BadFile('این هشدار پیدا نشد.')
    role, _, name = (assignee or '').partition(' - ')
    cur = conn.execute(
        'INSERT INTO decisions (alert_id, previous_status, status, actor, role, assigned_to, note, detector, version, risk, features, created_at) '
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        (n, alert['status'], status, (name or assignee or 'نامشخص').strip(), (role if name else 'حسابرس').strip(),
         assignee or None, (note or '').strip(), alert['detector'], alert['version'], alert['risk'], alert['features'], now()),
    )
    conn.execute('UPDATE alerts SET status = ?, assigned_to = ? WHERE id = ?', (status, assignee or None, n))
    conn.commit()
    return _log_json(conn.execute('SELECT * FROM decisions WHERE id = ?', (cur.lastrowid,)).fetchone())
