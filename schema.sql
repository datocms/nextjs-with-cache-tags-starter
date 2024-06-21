PRAGMA foreign_keys = OFF;
BEGIN TRANSACTION;

CREATE TABLE IF NOT EXISTS query_cache_tags (
  query_id TEXT NOT NULL,
  cache_tag TEXT NOT NULL,
  PRIMARY KEY (query_id, cache_tag)
);

COMMIT;