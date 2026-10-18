-- Who opened which patient record, and sign-outs that end a sign-in at once (readiness review
-- items 8 and 9). Synthetic data only.
-- One row each time a desk opens a patient or movement page: who, as which role and place, which
-- patient, which screen and when. Nobody can change or remove a row, the runtime role included.
CREATE TABLE ward_flow.record_access (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  workspace_id uuid NOT NULL,
  data_mode text NOT NULL DEFAULT 'prototype' CHECK (data_mode = 'prototype'),
  actor_id uuid NOT NULL,
  membership_id uuid REFERENCES ward_flow.memberships(id),
  actor_role text NOT NULL CHECK (actor_role IN ('coordinator', 'bed_manager', 'ward', 'ed', 'community', 'officer', 'executive', 'admin')),
  actor_scope jsonb NOT NULL CHECK (jsonb_typeof(actor_scope) = 'object' AND octet_length(actor_scope::text) <= 4096),
  patient_id text NOT NULL CHECK (length(patient_id) >= 1 AND length(patient_id) <= 100),
  surface text NOT NULL CHECK (surface IN ('patient', 'movement')),
  viewed_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (workspace_id, data_mode) REFERENCES ward_flow.workspaces(id, data_mode)
);
CREATE INDEX record_access_patient ON ward_flow.record_access(workspace_id, patient_id, viewed_at DESC);
CREATE INDEX record_access_actor ON ward_flow.record_access(workspace_id, actor_id, viewed_at DESC);
CREATE FUNCTION ward_flow.protect_record_access() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Ward Flow record access entries are append-only';
END $$;
ALTER FUNCTION ward_flow.protect_record_access() SET search_path = pg_catalog, ward_flow;
CREATE TRIGGER protect_record_access BEFORE UPDATE OR DELETE OR TRUNCATE ON ward_flow.record_access
FOR EACH STATEMENT EXECUTE FUNCTION ward_flow.protect_record_access();
-- Break glass rows were only ever added by the runtime role. Now nobody can change or remove them.
CREATE FUNCTION ward_flow.protect_break_glass() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Ward Flow break glass records are append-only';
END $$;
ALTER FUNCTION ward_flow.protect_break_glass() SET search_path = pg_catalog, ward_flow;
CREATE TRIGGER protect_break_glass BEFORE UPDATE OR DELETE OR TRUNCATE ON ward_flow.break_glass
FOR EACH STATEMENT EXECUTE FUNCTION ward_flow.protect_break_glass();
-- A signed-out sign-in, by the sign-in's own session id. Its token is refused from then on, though
-- it has not expired yet. A row is only needed until that token would have expired (`until`).
CREATE TABLE ward_flow.session_sign_outs (
  session_id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL,
  data_mode text NOT NULL DEFAULT 'prototype' CHECK (data_mode = 'prototype'),
  actor_id uuid NOT NULL,
  signed_out_at timestamptz NOT NULL DEFAULT now(),
  until timestamptz NOT NULL CHECK (until > signed_out_at),
  FOREIGN KEY (workspace_id, data_mode) REFERENCES ward_flow.workspaces(id, data_mode)
);
-- The same runtime-only row security as migration 6.
ALTER TABLE ward_flow.record_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY runtime_only ON ward_flow.record_access USING (current_user = 'wardflow_backend') WITH CHECK (current_user = 'wardflow_backend');
ALTER TABLE ward_flow.session_sign_outs ENABLE ROW LEVEL SECURITY;
CREATE POLICY runtime_only ON ward_flow.session_sign_outs USING (current_user = 'wardflow_backend') WITH CHECK (current_user = 'wardflow_backend');
INSERT INTO ward_flow.migrations(version) VALUES(10);
