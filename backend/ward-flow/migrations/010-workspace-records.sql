-- Each referral, bed (ward), movement and every other list or map entry of a shared workspace is
-- saved as its own row, with the workspace revision at which its content last changed. A save then
-- writes only the rows it changed, and is refused only when someone else changed one of the same
-- records first, not when anything anywhere in the workspace changed. Synthetic data only.
-- The layout rule is the one in records.mjs (records.test.mjs checks the two agree):
--   a list of objects that each have a unique text id: one row per entry, keyed by that id (item);
--   any other list: one row per position (index); a map: one row per key (entry).
-- The workspace row keeps the small fields and {"$records": "<kind>"} in place of each list or map,
-- plus "$revisions": the revision at which each small field last changed.
-- Existing workspaces are moved across here, in migrate()'s single transaction: if any row cannot
-- be written, nothing changes. infra/rollback-010-workspace-records.sql puts them back.
CREATE TABLE ward_flow.workspace_records (
  workspace_id uuid NOT NULL,
  data_mode text NOT NULL DEFAULT 'prototype' CHECK (data_mode = 'prototype'),
  collection text NOT NULL CHECK (collection ~ '^[A-Za-z][A-Za-z0-9]{0,63}$'),
  record_id text NOT NULL CHECK (length(record_id) >= 1 AND length(record_id) <= 200),
  kind text NOT NULL CHECK (kind IN ('item', 'index', 'entry')),
  ordinal integer NOT NULL CHECK (ordinal >= 0),
  revision bigint NOT NULL CHECK (revision > 0),
  body jsonb NOT NULL CHECK (octet_length(body::text) <= 1048576),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, collection, record_id),
  CHECK (kind <> 'item' OR (jsonb_typeof(body) = 'object' AND body->>'id' = record_id)),
  FOREIGN KEY (workspace_id, data_mode) REFERENCES ward_flow.workspaces(id, data_mode)
);
DO $$
DECLARE
  w record;
  field record;
  field_kind text;
  next_payload jsonb;
BEGIN
  FOR w IN SELECT id, revision, payload, updated_at FROM ward_flow.workspaces FOR UPDATE LOOP
    next_payload := w.payload;
    FOR field IN SELECT key, value FROM jsonb_each(w.payload->'state') LOOP
      IF jsonb_typeof(field.value) = 'array' THEN
        field_kind := CASE
          WHEN NOT EXISTS (
            SELECT 1 FROM jsonb_array_elements(field.value) e
            WHERE jsonb_typeof(e) <> 'object' OR jsonb_typeof(e->'id') IS DISTINCT FROM 'string'
          ) AND (SELECT count(DISTINCT e->>'id') FROM jsonb_array_elements(field.value) e) = jsonb_array_length(field.value)
          THEN 'item' ELSE 'index' END;
        INSERT INTO ward_flow.workspace_records(workspace_id, collection, record_id, kind, ordinal, revision, body, updated_at)
        SELECT w.id, field.key, CASE WHEN field_kind = 'item' THEN e.value->>'id' ELSE (e.ordinality - 1)::text END,
          field_kind, e.ordinality - 1, w.revision, e.value, w.updated_at
        FROM jsonb_array_elements(field.value) WITH ORDINALITY AS e(value, ordinality);
      ELSIF jsonb_typeof(field.value) = 'object' THEN
        field_kind := 'entry';
        INSERT INTO ward_flow.workspace_records(workspace_id, collection, record_id, kind, ordinal, revision, body, updated_at)
        SELECT w.id, field.key, e.key, field_kind, 0, w.revision, e.value, w.updated_at FROM jsonb_each(field.value) AS e;
      ELSE
        CONTINUE;
      END IF;
      next_payload := jsonb_set(next_payload, ARRAY['state', field.key], jsonb_build_object('$records', field_kind));
    END LOOP;
    -- Every small field left on the workspace row counts as changed at the current revision.
    next_payload := next_payload || jsonb_build_object('$revisions', (
      SELECT coalesce(jsonb_object_agg(f.key, w.revision), '{}'::jsonb) FROM jsonb_each(next_payload->'state') AS f
      WHERE jsonb_typeof(f.value) <> 'object' OR NOT (f.value ? '$records')));
    UPDATE ward_flow.workspaces SET payload = next_payload WHERE id = w.id;
  END LOOP;
END $$;
-- The same runtime-only row security as migration 6.
ALTER TABLE ward_flow.workspace_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY runtime_only ON ward_flow.workspace_records USING (current_user = 'wardflow_backend') WITH CHECK (current_user = 'wardflow_backend');
INSERT INTO ward_flow.migrations(version) VALUES(10);
