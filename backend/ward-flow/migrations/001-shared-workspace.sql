CREATE SCHEMA IF NOT EXISTS ward_flow;
REVOKE ALL ON SCHEMA ward_flow FROM PUBLIC;
CREATE TABLE ward_flow.migrations (
  version integer PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE ward_flow.workspaces (
  id uuid PRIMARY KEY,
  revision bigint NOT NULL CHECK (revision > 0),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (octet_length(payload::text) <= 8388608)
);
CREATE TABLE ward_flow.commands (
  workspace_id uuid NOT NULL REFERENCES ward_flow.workspaces(id),
  actor_id uuid NOT NULL,
  command_id uuid NOT NULL,
  fingerprint text NOT NULL,
  status integer NOT NULL,
  result jsonb NOT NULL,
  committed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, actor_id, command_id)
);
CREATE TABLE ward_flow.audit (
  sequence bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES ward_flow.workspaces(id),
  actor_id uuid NOT NULL,
  actor_role text NOT NULL DEFAULT 'coordinator' CHECK (actor_role='coordinator'),
  command_id uuid,
  action text NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('accepted','denied','stale')),
  prior_revision bigint NOT NULL,
  revision bigint NOT NULL,
  changes jsonb NOT NULL,
  committed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_workspace_sequence ON ward_flow.audit(workspace_id, sequence DESC);
CREATE FUNCTION ward_flow.protect_audit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Ward Flow audit records are append-only';
END $$;
CREATE TRIGGER protect_audit BEFORE UPDATE OR DELETE OR TRUNCATE ON ward_flow.audit
FOR EACH STATEMENT EXECUTE FUNCTION ward_flow.protect_audit();
INSERT INTO ward_flow.migrations(version) VALUES(1);
