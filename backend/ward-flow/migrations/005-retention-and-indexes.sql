-- Composite partial index for active coordinator push subscriptions by workspace and actor,
-- and chronological index on command idempotency receipts by workspace and commit timestamp.
CREATE INDEX commands_workspace_committed ON ward_flow.commands(workspace_id, committed_at DESC);
CREATE INDEX push_subscriptions_actor_active ON ward_flow.push_subscriptions(workspace_id, actor_id) WHERE revoked_at IS NULL;
INSERT INTO ward_flow.migrations(version) VALUES(5);
