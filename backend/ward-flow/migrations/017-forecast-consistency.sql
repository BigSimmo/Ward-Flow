-- Forecast reason choices compare a server version, never the browser's clock. Take the same
-- workspace-before-forecast lock order as saves. Advancing the workspace also fences old clients
-- after a rollback/reapply: a preserved choice never returns to an older version (ABA).
LOCK TABLE ward_flow.workspaces IN EXCLUSIVE MODE;
ALTER TABLE ward_flow.forecast_miss_reasons ADD COLUMN revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0);
UPDATE ward_flow.workspaces SET revision = revision + 1, updated_at = clock_timestamp() WHERE data_mode = 'prototype';
UPDATE ward_flow.forecast_miss_reasons r SET revision = w.revision FROM ward_flow.workspaces w WHERE r.workspace_id = w.id;
INSERT INTO ward_flow.migrations(version) VALUES(17);
