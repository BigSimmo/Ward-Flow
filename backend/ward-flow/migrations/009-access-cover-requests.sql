-- Role access, later pass (Josh's go 16 Oct 2026). Cover for a second ward or ED, requests for
-- access from a person with no role, when each role was last used, and phone alerts by role and
-- place. Synthetic data only.
-- Cover is a membership of its own kind: one ward (a nurse in charge's) or one ED (an ED
-- clinician's), given by a coordinator or that ward's or ED's own desk, ending by itself. The
-- backend checks how long it may last against the clinical values module.
ALTER TABLE ward_flow.memberships ADD COLUMN kind text NOT NULL DEFAULT 'role' CHECK (kind IN ('role', 'cover'));
ALTER TABLE ward_flow.memberships ADD COLUMN last_used_at timestamptz;
ALTER TABLE ward_flow.memberships ADD CONSTRAINT memberships_cover_role CHECK (kind = 'role' OR role IN ('ward', 'ed'));
-- Every role held now starts its "not used" count today, so none switches off the moment this runs.
UPDATE ward_flow.memberships SET last_used_at = now() WHERE revoked_at IS NULL;
-- A signed-in person with no role asks for one. One open request each; an access admin answers it.
CREATE TABLE ward_flow.access_requests (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL,
  data_mode text NOT NULL DEFAULT 'prototype' CHECK (data_mode = 'prototype'),
  actor_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('coordinator', 'bed_manager', 'ward', 'ed', 'community', 'officer', 'executive', 'admin')),
  scope jsonb NOT NULL CHECK (jsonb_typeof(scope) = 'object' AND octet_length(scope::text) <= 4096),
  requested_at timestamptz NOT NULL DEFAULT now(),
  decision text CHECK (decision IN ('approved', 'declined')),
  decided_by uuid CHECK (decided_by <> actor_id),
  decided_at timestamptz,
  CHECK ((decision IS NULL) = (decided_by IS NULL) AND (decision IS NULL) = (decided_at IS NULL)),
  FOREIGN KEY (workspace_id, data_mode) REFERENCES ward_flow.workspaces(id, data_mode)
);
CREATE UNIQUE INDEX access_requests_one_open ON ward_flow.access_requests(workspace_id, actor_id) WHERE decision IS NULL;
-- A device turned on from a desk held by membership hears that desk's own act-now rows only.
-- Empty for the WARD_COORDINATOR_USER_IDS bootstrap accounts, which hear the whole network.
ALTER TABLE ward_flow.push_subscriptions ADD COLUMN membership_id uuid REFERENCES ward_flow.memberships(id);
-- The same runtime-only row security as migration 6.
ALTER TABLE ward_flow.access_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY runtime_only ON ward_flow.access_requests USING (current_user = 'wardflow_backend') WITH CHECK (current_user = 'wardflow_backend');
INSERT INTO ward_flow.migrations(version) VALUES(9);
