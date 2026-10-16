-- Row-level security on every Ward Flow table. Only the backend runtime login sees or writes rows.
-- The tables' owner (the migration administrator) bypasses RLS because it is not forced, so later
-- migrations and receipt pruning are unchanged. Grants still decide what the runtime role may do.
-- A browser role given a grant by mistake would still see and write no rows.
-- The policy names the role by text, not TO wardflow_backend, because on a new database the
-- runtime role is created after the migrations run (infra/*-runtime-role.sql).
ALTER TABLE ward_flow.migrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY runtime_only ON ward_flow.migrations USING (current_user = 'wardflow_backend') WITH CHECK (current_user = 'wardflow_backend');
ALTER TABLE ward_flow.workspaces ENABLE ROW LEVEL SECURITY;
CREATE POLICY runtime_only ON ward_flow.workspaces USING (current_user = 'wardflow_backend') WITH CHECK (current_user = 'wardflow_backend');
ALTER TABLE ward_flow.commands ENABLE ROW LEVEL SECURITY;
CREATE POLICY runtime_only ON ward_flow.commands USING (current_user = 'wardflow_backend') WITH CHECK (current_user = 'wardflow_backend');
ALTER TABLE ward_flow.audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY runtime_only ON ward_flow.audit USING (current_user = 'wardflow_backend') WITH CHECK (current_user = 'wardflow_backend');
ALTER TABLE ward_flow.push_baselines ENABLE ROW LEVEL SECURITY;
CREATE POLICY runtime_only ON ward_flow.push_baselines USING (current_user = 'wardflow_backend') WITH CHECK (current_user = 'wardflow_backend');
ALTER TABLE ward_flow.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY runtime_only ON ward_flow.push_subscriptions USING (current_user = 'wardflow_backend') WITH CHECK (current_user = 'wardflow_backend');
ALTER TABLE ward_flow.push_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY runtime_only ON ward_flow.push_deliveries USING (current_user = 'wardflow_backend') WITH CHECK (current_user = 'wardflow_backend');
INSERT INTO ward_flow.migrations(version) VALUES(6);
