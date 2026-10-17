CREATE TABLE IF NOT EXISTS visitors (
  visitor_hash TEXT PRIMARY KEY,
  first_day TEXT NOT NULL
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS daily_visitors (
  day TEXT NOT NULL,
  visitor_hash TEXT NOT NULL,
  PRIMARY KEY (day, visitor_hash)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS visitors_first_day ON visitors(first_day);
