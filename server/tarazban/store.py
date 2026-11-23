"""
Storage on the company's own server: one SQLite file.

- uploads:   each file received, and the mapping used to read it
- mappings:  column mappings people confirmed, by column signature
- records:   every row in the standard model; a row already received is not stored twice
- alerts:    findings of the detectors, with the facts and features behind each
- decisions: the auditor's decision log; each entry keeps the alert's features and detector
             version as they were, so it can later train and test models
- quality:   the data-quality report of each file
"""
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

DEFAULT_DB = Path(__file__).resolve().parent.parent / 'data' / 'tarazban.db'

SCHEMA = """
CREATE TABLE IF NOT EXISTS uploads (
  id INTEGER PRIMARY KEY,
  file_name TEXT NOT NULL,
  content TEXT,
  headers TEXT NOT NULL,
  kind TEXT,
  mapping TEXT,
  status TEXT NOT NULL,
  rows INTEGER,
  new_rows INTEGER,
  alerts_added INTEGER,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS mappings (
  signature TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  mapping TEXT NOT NULL,
  headers TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS records (
  id INTEGER PRIMARY KEY,
  kind TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  upload_id INTEGER NOT NULL,
  file_name TEXT NOT NULL,
  row_no INTEGER NOT NULL,
  data TEXT NOT NULL,
  UNIQUE (kind, fingerprint)
);
CREATE TABLE IF NOT EXISTS alerts (
  id INTEGER PRIMARY KEY,
  alert_key TEXT NOT NULL UNIQUE,
  detector TEXT NOT NULL,
  version TEXT NOT NULL,
  upload_id INTEGER NOT NULL,
  entity TEXT NOT NULL,
  supplier_id TEXT,
  supplier_name TEXT,
  warehouse_code TEXT,
  risk REAL NOT NULL,
  confidence REAL NOT NULL,
  exposure REAL NOT NULL,
  facts TEXT NOT NULL,
  features TEXT NOT NULL,
  steps TEXT NOT NULL,
  record_ids TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'NEW',
  assigned_to TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS decisions (
  id INTEGER PRIMARY KEY,
  alert_id INTEGER NOT NULL REFERENCES alerts (id),
  previous_status TEXT,
  status TEXT NOT NULL,
  actor TEXT NOT NULL,
  role TEXT NOT NULL,
  assigned_to TEXT,
  note TEXT NOT NULL,
  detector TEXT NOT NULL,
  version TEXT NOT NULL,
  risk REAL NOT NULL,
  features TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS quality (
  file_name TEXT PRIMARY KEY,
  report TEXT NOT NULL
);
"""


def db_path() -> Path:
    return Path(os.environ.get('TARAZBAN_DB') or DEFAULT_DB)


def connect(path: Path | str | None = None) -> sqlite3.Connection:
    path = Path(path or db_path())
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA journal_mode = WAL')
    conn.execute('PRAGMA foreign_keys = ON')
    conn.executescript(SCHEMA)
    return conn


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec='seconds')
