-- Shared forecast history (proposal 013, forecast integration, Josh, 27 Oct 2026). The daily
-- forecast snapshots behind the Statistics track record, and the reasons people record for a
-- missed day, kept on the server instead of in each browser, so every device and colleague at the
-- same desk sees one track record. Counts, a demo day, a closed list of reasons and a role only:
-- no patient detail and no typed text. Synthetic data only.
-- Each desk's forecast counts only the records it is shown, so the history is kept per desk:
-- scope_key is the SHA-256 of the desk's role and place, set by the server. The first snapshot of
-- a demo day stands; a later reason for the same day replaces the earlier one. A demonstration
-- reset starts a new world generation; rows of an earlier generation are no longer shown.
CREATE TABLE ward_flow.forecast_snapshots (
  workspace_id uuid NOT NULL,
  data_mode text NOT NULL DEFAULT 'prototype' CHECK (data_mode = 'prototype'),
  world_generation bigint NOT NULL CHECK (world_generation >= 0),
  scope_key text NOT NULL CHECK (scope_key ~ '^[0-9a-f]{64}$'),
  demo_day integer NOT NULL,
  taken_at integer NOT NULL,
  ready_gap_now integer NOT NULL,
  tomorrow_low integer NOT NULL,
  tomorrow_likely integer NOT NULL,
  tomorrow_high integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (tomorrow_low <= tomorrow_likely AND tomorrow_likely <= tomorrow_high),
  PRIMARY KEY (workspace_id, world_generation, scope_key, demo_day),
  FOREIGN KEY (workspace_id, data_mode) REFERENCES ward_flow.workspaces(id, data_mode)
);
CREATE TABLE ward_flow.forecast_miss_reasons (
  workspace_id uuid NOT NULL,
  data_mode text NOT NULL DEFAULT 'prototype' CHECK (data_mode = 'prototype'),
  world_generation bigint NOT NULL CHECK (world_generation >= 0),
  scope_key text NOT NULL CHECK (scope_key ~ '^[0-9a-f]{64}$'),
  demo_day integer NOT NULL,
  reason text NOT NULL CHECK (reason IN ('discharge_postponed', 'transfer_cancelled', 'capacity_changed', 'unexpected_admission', 'other')),
  chosen_by text NOT NULL CHECK (chosen_by IN ('coordinator', 'ward', 'ed', 'officer', 'community', 'bed_manager', 'executive')),
  chosen_at integer NOT NULL,
  actor_id uuid NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, world_generation, scope_key, demo_day),
  FOREIGN KEY (workspace_id, data_mode) REFERENCES ward_flow.workspaces(id, data_mode)
);
-- The foreign keys' indexes, as migration 12 gives every other table.
CREATE INDEX forecast_snapshots_workspace_mode ON ward_flow.forecast_snapshots(workspace_id, data_mode);
CREATE INDEX forecast_miss_reasons_workspace_mode ON ward_flow.forecast_miss_reasons(workspace_id, data_mode);
-- The same runtime-only row security as migration 6.
ALTER TABLE ward_flow.forecast_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY runtime_only ON ward_flow.forecast_snapshots USING (current_user = 'wardflow_backend') WITH CHECK (current_user = 'wardflow_backend');
ALTER TABLE ward_flow.forecast_miss_reasons ENABLE ROW LEVEL SECURITY;
CREATE POLICY runtime_only ON ward_flow.forecast_miss_reasons USING (current_user = 'wardflow_backend') WITH CHECK (current_user = 'wardflow_backend');
INSERT INTO ward_flow.migrations(version) VALUES(16);
