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

-- Add a ref here to stop the Worker from logging any further clicks or
-- conversions for it. Existing customer redirects still work normally —
-- only the tracking stops. No redeploy needed:
--   wrangler d1 execute tracker-db --command="INSERT INTO blocked_refs (ref) VALUES ('partnerA')"
--   wrangler d1 execute tracker-db --command="DELETE FROM blocked_refs WHERE ref='partnerA'"
CREATE TABLE IF NOT EXISTS blocked_refs (
  ref TEXT PRIMARY KEY
);
