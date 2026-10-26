-- Closed records older than 30 days leave the live workspace for this table (Josh, 25 Oct 2026):
-- movements that arrived or did not proceed, the referrals only they carried, and alerts stood
-- down or expired. The live workspace has an 8 MB limit and every desk reads it whole. History
-- still shows these: the browser reads them from here and puts them back beside the live records,
-- through the same place rule as the live workspace. Synthetic data only.
-- A row is written once, when its record leaves the workspace, and never changed. A demonstration
-- reset starts a new world generation; rows of an earlier generation are no longer shown.
CREATE TABLE ward_flow.archived_records (
  workspace_id uuid NOT NULL,
  data_mode text NOT NULL DEFAULT 'prototype' CHECK (data_mode = 'prototype'),
  world_generation bigint NOT NULL CHECK (world_generation >= 0),
  collection text NOT NULL CHECK (collection IN ('movements', 'referrals', 'broadcastAlerts')),
  record_id text NOT NULL CHECK (length(record_id) >= 1 AND length(record_id) <= 200),
  closed_at integer NOT NULL,
  body jsonb NOT NULL CHECK (jsonb_typeof(body) = 'object' AND body->>'id' = record_id AND octet_length(body::text) <= 1048576),
  archived_revision bigint NOT NULL CHECK (archived_revision > 0),
  archived_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, world_generation, collection, record_id),
  FOREIGN KEY (workspace_id, data_mode) REFERENCES ward_flow.workspaces(id, data_mode)
);
-- The foreign key's index, as migration 12 gives every other table.
CREATE INDEX archived_records_workspace_mode ON ward_flow.archived_records(workspace_id, data_mode);
-- The same runtime-only row security as migration 6.
ALTER TABLE ward_flow.archived_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY runtime_only ON ward_flow.archived_records USING (current_user = 'wardflow_backend') WITH CHECK (current_user = 'wardflow_backend');
INSERT INTO ward_flow.migrations(version) VALUES(14);
