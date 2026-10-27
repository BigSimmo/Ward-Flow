-- SUPERSEDED (27 Oct 2026): built as migrations/016-forecast-history.sql, kept per desk and world
-- generation with the miss reasons beside it. Kept here for reference only; nothing reads this file.
-- PROPOSED, NOT APPLIED. Forecasting build (Josh, 23 Oct 2026, decision 4): a shared table for the
-- daily forecast snapshots the Statistics track record compares against what happened. Until it is
-- applied, the app keeps the same snapshots in the browser's demo store.
--
-- This file is deliberately outside migrations/ and is not listed in migrations.mjs, so no deploy
-- or migrate run can apply it. Applying it is a separate step that needs Josh's go: move it to
-- migrations/013-forecast-snapshots.sql, add its entry and SHA-256 to MIGRATIONS, write
-- infra/rollback-013-forecast-snapshots.sql, and run it against the named Ward Flow database.
--
-- Counts only. No patient detail or typed text is ever stored here. Synthetic data only.
CREATE TABLE ward_flow.forecast_snapshots (
  workspace_id uuid NOT NULL,
  data_mode text NOT NULL DEFAULT 'prototype' CHECK (data_mode = 'prototype'),
  demo_day integer NOT NULL CHECK (demo_day >= 0),
  taken_at_minute integer NOT NULL CHECK (taken_at_minute >= 0),
  ready_gap_now integer NOT NULL,
  tomorrow_low integer NOT NULL,
  tomorrow_likely integer NOT NULL,
  tomorrow_high integer NOT NULL,
  CHECK (tomorrow_low <= tomorrow_likely AND tomorrow_likely <= tomorrow_high),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, data_mode, demo_day),
  FOREIGN KEY (workspace_id, data_mode) REFERENCES ward_flow.workspaces(id, data_mode)
);
ALTER TABLE ward_flow.forecast_snapshots ENABLE ROW LEVEL SECURITY;
INSERT INTO ward_flow.migrations(version) VALUES(13);
