-- Role access (role access plan, server half). Who holds which role at which place, and every
-- record opened outside a person's care (break glass). Synthetic data only.
-- A membership always ends: expires_at is required. Nobody grants themselves a role, and a
-- coordinator or access admin role works only once a second person has approved it.
CREATE TABLE ward_flow.memberships (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL,
  data_mode text NOT NULL DEFAULT 'prototype' CHECK (data_mode = 'prototype'),
  actor_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('coordinator', 'bed_manager', 'ward', 'ed', 'community', 'officer', 'executive', 'admin')),
  scope jsonb NOT NULL CHECK (jsonb_typeof(scope) = 'object' AND octet_length(scope::text) <= 4096),
  granted_by uuid NOT NULL CHECK (granted_by <> actor_id),
  granted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL CHECK (expires_at > granted_at),
  approved_by uuid CHECK (approved_by <> granted_by AND approved_by <> actor_id),
  approved_at timestamptz,
  revoked_by uuid,
  revoked_at timestamptz,
  CHECK ((approved_by IS NULL) = (approved_at IS NULL)),
  CHECK ((revoked_by IS NULL) = (revoked_at IS NULL)),
  FOREIGN KEY (workspace_id, data_mode) REFERENCES ward_flow.workspaces(id, data_mode)
);
CREATE INDEX memberships_actor_active ON ward_flow.memberships(workspace_id, actor_id) WHERE revoked_at IS NULL;
-- One row per record opened outside the person's care: who, which patient, why and until when.
-- The runtime role may only add rows, so this is also the "who looked" record.
CREATE TABLE ward_flow.break_glass (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  workspace_id uuid NOT NULL,
  data_mode text NOT NULL DEFAULT 'prototype' CHECK (data_mode = 'prototype'),
  actor_id uuid NOT NULL,
  membership_id uuid NOT NULL REFERENCES ward_flow.memberships(id),
  patient_id text NOT NULL CHECK (length(patient_id) <= 100),
  reason text NOT NULL CHECK (reason IN ('handover', 'bed-search', 'transport-safety', 'other')),
  opened_at timestamptz NOT NULL DEFAULT now(),
  until timestamptz NOT NULL CHECK (until > opened_at),
  FOREIGN KEY (workspace_id, data_mode) REFERENCES ward_flow.workspaces(id, data_mode)
);
CREATE INDEX break_glass_actor ON ward_flow.break_glass(workspace_id, actor_id, until DESC);
-- Every audit row names the sender's role and place, not a fixed coordinator.
ALTER TABLE ward_flow.audit DROP CONSTRAINT audit_actor_role_check;
ALTER TABLE ward_flow.audit ADD CONSTRAINT audit_actor_role_check
  CHECK (actor_role IN ('coordinator', 'bed_manager', 'ward', 'ed', 'community', 'officer', 'executive', 'admin'));
ALTER TABLE ward_flow.audit ADD COLUMN actor_scope jsonb CHECK (actor_scope IS NULL OR jsonb_typeof(actor_scope) = 'object');
-- The same runtime-only row security as migration 6.
ALTER TABLE ward_flow.memberships ENABLE ROW LEVEL SECURITY;
CREATE POLICY runtime_only ON ward_flow.memberships USING (current_user = 'wardflow_backend') WITH CHECK (current_user = 'wardflow_backend');
ALTER TABLE ward_flow.break_glass ENABLE ROW LEVEL SECURITY;
CREATE POLICY runtime_only ON ward_flow.break_glass USING (current_user = 'wardflow_backend') WITH CHECK (current_user = 'wardflow_backend');
INSERT INTO ward_flow.migrations(version) VALUES(8);
