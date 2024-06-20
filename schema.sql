PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
CREATE TABLE IF NOT EXISTS query_digest_to_cache_tag_mappings (
  cache_tag TEXT NOT NULL,
  query_digest TEXT NOT NULL,
  PRIMARY KEY (cache_tag, query_digest)
);
COMMIT;