-- Receipt pruning is global, so lead with the retention timestamp rather than workspace_id.
CREATE INDEX commands_committed_at ON ward_flow.commands(committed_at);
INSERT INTO ward_flow.migrations(version) VALUES(6);
