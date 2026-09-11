CREATE TABLE IF NOT EXISTS clicks (
  id TEXT PRIMARY KEY,
  ref TEXT,
  dest TEXT,
  timestamp TEXT,
  postal TEXT,
  city TEXT,
  country TEXT,
  converted INTEGER DEFAULT 0
);
