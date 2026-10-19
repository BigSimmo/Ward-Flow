-- An index for each of the 13 foreign keys that had none, as the Supabase advisor asked (audit,
-- 19 October 2026). A delete or key change on the referenced row then checks these tables by
-- index instead of reading them whole. Indexes only: no table, row, grant or policy changes.
CREATE INDEX access_requests_workspace_mode ON ward_flow.access_requests(workspace_id, data_mode);
CREATE INDEX audit_workspace_mode ON ward_flow.audit(workspace_id, data_mode);
CREATE INDEX break_glass_membership ON ward_flow.break_glass(membership_id);
CREATE INDEX break_glass_workspace_mode ON ward_flow.break_glass(workspace_id, data_mode);
CREATE INDEX commands_workspace_mode ON ward_flow.commands(workspace_id, data_mode);
CREATE INDEX memberships_workspace_mode ON ward_flow.memberships(workspace_id, data_mode);
CREATE INDEX push_baselines_workspace_mode ON ward_flow.push_baselines(workspace_id, data_mode);
CREATE INDEX push_subscriptions_membership ON ward_flow.push_subscriptions(membership_id);
CREATE INDEX push_subscriptions_workspace_mode ON ward_flow.push_subscriptions(workspace_id, data_mode);
CREATE INDEX record_access_membership ON ward_flow.record_access(membership_id);
CREATE INDEX record_access_workspace_mode ON ward_flow.record_access(workspace_id, data_mode);
CREATE INDEX session_sign_outs_workspace_mode ON ward_flow.session_sign_outs(workspace_id, data_mode);
CREATE INDEX workspace_records_workspace_mode ON ward_flow.workspace_records(workspace_id, data_mode);
INSERT INTO ward_flow.migrations(version) VALUES(12);
