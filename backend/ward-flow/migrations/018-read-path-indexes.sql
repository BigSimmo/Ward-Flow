-- Three indexes for reads that otherwise walk a whole table as the logs grow (save and index
-- review, 11 November 2026). Indexes only: no table, row, grant or policy changes, and nothing
-- behaves differently before or after. Plain CREATE INDEX, because migrate.mjs runs every file in
-- one transaction, where CREATE INDEX CONCURRENTLY is not allowed.
-- Break glass: the EXISTS check behind each opening (workspace-access.mjs) finds its own audit row
-- by workspace and actor among BREAK_GLASS rows only.
CREATE INDEX audit_break_glass_actor ON ward_flow.audit(workspace_id, actor_id) WHERE action = 'BREAK_GLASS';
-- Access history: the access rows only, newest first, so the list never pages through every save.
CREATE INDEX audit_access_sequence ON ward_flow.audit(workspace_id, sequence DESC) WHERE action LIKE 'ACCESS\_%';
-- Record access list: the review window (viewed_at > cutoff) as one range, then newest first.
CREATE INDEX record_access_workspace_viewed ON ward_flow.record_access(workspace_id, viewed_at DESC);
INSERT INTO ward_flow.migrations(version) VALUES(18);
