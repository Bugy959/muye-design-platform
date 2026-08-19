-- 木叶义齿设计平台 —— SQLite 表结构
-- 数组/对象字段（牙位、文件列表、照片）以 JSON 文本存储，未来迁 MySQL 可继续用 JSON 列

CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS clients (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  phone           TEXT NOT NULL,
  kind            TEXT NOT NULL CHECK (kind IN ('hospital','factory')),
  points          INTEGER NOT NULL DEFAULT 0,
  client_group_id TEXT,
  created_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS designers (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  phone      TEXT NOT NULL,
  id_card    TEXT NOT NULL,
  cert_no    TEXT,
  group_id   TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS groups (
  id        TEXT PRIMARY KEY,
  name      TEXT NOT NULL,
  leader_id TEXT,
  note      TEXT
);

CREATE TABLE IF NOT EXISTS client_groups (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  note       TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS assignments (
  id                TEXT PRIMARY KEY,
  client_group_id   TEXT NOT NULL,
  designer_group_id TEXT NOT NULL,
  created_at        TEXT NOT NULL,
  UNIQUE (client_group_id, designer_group_id)
);

CREATE TABLE IF NOT EXISTS orders (
  id            TEXT PRIMARY KEY,
  no            TEXT NOT NULL UNIQUE,
  client_id     TEXT NOT NULL REFERENCES clients(id),
  patient       TEXT,
  designer_id   TEXT REFERENCES designers(id),
  type          TEXT NOT NULL,
  urgent        INTEGER NOT NULL DEFAULT 0,
  teeth         TEXT NOT NULL DEFAULT '[]',   -- JSON 数组
  custom        INTEGER NOT NULL DEFAULT 0,
  custom_count  INTEGER,
  arch          TEXT,
  requirement   TEXT NOT NULL DEFAULT '',
  scan_files    TEXT NOT NULL DEFAULT '[]',   -- JSON 数组 [{name,dataUrl?}]
  images        TEXT NOT NULL DEFAULT '[]',   -- JSON 数组
  design_files  TEXT NOT NULL DEFAULT '[]',   -- JSON 数组
  status        TEXT NOT NULL CHECK (status IN ('pending','designing','completed','rework','returned','unassigned','cancelled')),
  points        INTEGER NOT NULL,
  is_rework     INTEGER NOT NULL DEFAULT 0,
  rework_count  INTEGER NOT NULL DEFAULT 0,
  rework_reason TEXT,
  return_reason TEXT,
  returned_at   TEXT,
  cancelled_at  TEXT,
  created_at    TEXT NOT NULL,
  accepted_at   TEXT,
  completed_at  TEXT
);
CREATE INDEX IF NOT EXISTS idx_orders_client   ON orders(client_id);
CREATE INDEX IF NOT EXISTS idx_orders_designer ON orders(designer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status   ON orders(status);

CREATE TABLE IF NOT EXISTS point_txns (
  id         TEXT PRIMARY KEY,
  client_id  TEXT NOT NULL REFERENCES clients(id),
  delta      INTEGER NOT NULL,
  balance    INTEGER NOT NULL,
  reason     TEXT NOT NULL,
  order_id   TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_txns_client ON point_txns(client_id);

CREATE TABLE IF NOT EXISTS notices (
  id         TEXT PRIMARY KEY,
  client_id  TEXT NOT NULL,
  order_id   TEXT NOT NULL,
  text       TEXT NOT NULL,
  is_read    INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rework_requests (
  id         TEXT PRIMARY KEY,
  order_id   TEXT NOT NULL REFERENCES orders(id),
  client_id  TEXT NOT NULL,
  reason     TEXT NOT NULL,
  images     TEXT NOT NULL DEFAULT '[]',
  status     TEXT NOT NULL CHECK (status IN ('pending','approved','rejected')),
  created_at TEXT NOT NULL,
  reviewed_at TEXT
);

CREATE TABLE IF NOT EXISTS accounts (
  id           TEXT PRIMARY KEY,
  username     TEXT NOT NULL UNIQUE,
  pass_hash    TEXT NOT NULL,           -- scrypt: salt:hash（hex）
  role         TEXT NOT NULL CHECK (role IN ('client','designer','admin')),
  client_id    TEXT,
  designer_id  TEXT,
  created_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token       TEXT PRIMARY KEY,
  account_id  TEXT NOT NULL REFERENCES accounts(id),
  role        TEXT NOT NULL,
  client_id   TEXT,
  designer_id TEXT,
  username    TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  expires_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS design_params (
  id            TEXT PRIMARY KEY,   -- = client_id
  inner_crown   REAL NOT NULL DEFAULT 0.02,
  occlusal_cut  REAL NOT NULL DEFAULT 0.1,
  proximal_cut  REAL NOT NULL DEFAULT -0.02
);
