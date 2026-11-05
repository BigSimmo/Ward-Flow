-- Help remembered by account (Josh, 4 Nov 2026, "Yes to all recommendations" on the eight
-- suggestions, item 3). Each signed-in account's Help memory, kept on the server so a new phone, PC
-- or browser does not show every tour and tip again: the desks whose tour is done, the page tips
-- already seen, whether tips are turned off, and the What's new lines already read. Desk role ids,
-- static Help topic ids and What's new entry ids only, each checked against a closed shape: no
-- patient detail, no paths and no typed text. Synthetic data only.
CREATE TABLE ward_flow.account_preferences (
  workspace_id uuid NOT NULL,
  data_mode text NOT NULL DEFAULT 'prototype' CHECK (data_mode = 'prototype'),
  actor_id uuid NOT NULL,
  tours_seen text[] NOT NULL CHECK (
    cardinality(tours_seen) <= 16
    AND tours_seen <@ ARRAY['coordinator', 'ward', 'ed', 'officer', 'community', 'bed_manager', 'executive', 'admin']::text[]
  ),
  tips_seen text[] NOT NULL CHECK (
    cardinality(tips_seen) <= 200
    AND array_to_string(tips_seen, ',') ~ '^([a-z_]{2,20}:[a-z][a-z-]{0,39}(,|$))*$'
  ),
  tips_off boolean,
  whats_new_seen text[] NOT NULL CHECK (
    cardinality(whats_new_seen) <= 200
    AND array_to_string(whats_new_seen, ',') ~ '^([0-9]{4}-[0-9]{2}-[0-9]{2}-[a-z0-9-]{1,80}(,|$))*$'
  ),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, actor_id),
  FOREIGN KEY (workspace_id, data_mode) REFERENCES ward_flow.workspaces(id, data_mode)
);
-- The foreign key's index, as migration 12 gives every other table.
CREATE INDEX account_preferences_workspace_mode ON ward_flow.account_preferences(workspace_id, data_mode);
-- The same runtime-only row security as migration 6.
ALTER TABLE ward_flow.account_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY runtime_only ON ward_flow.account_preferences USING (current_user = 'wardflow_backend') WITH CHECK (current_user = 'wardflow_backend');
INSERT INTO ward_flow.migrations(version) VALUES(17);
