-- Phone push for new act-now items. A subscription is a browser push endpoint and its public
-- encryption keys, owned by one signed-in coordinator. It holds no patient information.
CREATE TABLE ward_flow.push_subscriptions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  workspace_id uuid NOT NULL,
  data_mode text NOT NULL DEFAULT 'prototype' CHECK (data_mode = 'prototype'),
  actor_id uuid NOT NULL,
  endpoint text NOT NULL UNIQUE CHECK (endpoint LIKE 'https://%' AND length(endpoint) <= 2048),
  p256dh text NOT NULL CHECK (length(p256dh) <= 128),
  auth text NOT NULL CHECK (length(auth) <= 64),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_success_at timestamptz,
  revoked_at timestamptz,
  FOREIGN KEY (workspace_id, data_mode) REFERENCES ward_flow.workspaces(id, data_mode)
);
CREATE INDEX push_subscriptions_active ON ward_flow.push_subscriptions(workspace_id) WHERE revoked_at IS NULL;
-- The act-now rows already announced, so each new red item is pushed once while it stays active.
CREATE TABLE ward_flow.push_baselines (
  workspace_id uuid PRIMARY KEY,
  data_mode text NOT NULL DEFAULT 'prototype' CHECK (data_mode = 'prototype'),
  item_ids jsonb NOT NULL CHECK (jsonb_typeof(item_ids) = 'array'),
  evaluated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (workspace_id, data_mode) REFERENCES ward_flow.workspaces(id, data_mode)
);
-- The outbox: one row per device and newly announced act-now row, written in the same
-- transaction that announces it, so an alert is never marked announced without a record of who
-- still has to receive it. Only rows for items still red are kept.
CREATE TABLE ward_flow.push_deliveries (
  subscription_id bigint NOT NULL REFERENCES ward_flow.push_subscriptions(id) ON DELETE CASCADE,
  item_id text NOT NULL CHECK (length(item_id) <= 200),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_attempt_at timestamptz,
  PRIMARY KEY (subscription_id, item_id)
);
CREATE INDEX push_deliveries_pending ON ward_flow.push_deliveries(subscription_id) WHERE status = 'pending';
INSERT INTO ward_flow.migrations(version) VALUES(3);
