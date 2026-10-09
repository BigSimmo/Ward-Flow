-- Ward Flow feature 3, shared live state (9 Oct 2026). Synthetic data only.
-- Applied by store.ts (migrate) on first use, inside one transaction under an advisory lock.
-- Every statement is idempotent, so applying it twice changes nothing.

-- One world per stored-state version and calendar day. A browser on a later day starts a new one,
-- like the local rule that refuses yesterday's saved session.
CREATE TABLE IF NOT EXISTS ward_flow_shared_worlds (
  world_id text PRIMARY KEY,
  state_version integer NOT NULL CHECK (state_version > 0),
  day_zero_ms bigint NOT NULL,
  started_at_ms bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  classification text NOT NULL DEFAULT 'synthetic' CHECK (classification = 'synthetic'),
  UNIQUE (state_version, day_zero_ms)
);

-- Append-only log of the events the reducer accepted. (world_id, seq) is the compare-and-set:
-- an append at a sequence another writer already took fails, and the writer reports a conflict.
-- This is the fact log the metrics catalogue derives from: type, role, board time, and the ids
-- and codes inside the event. Refused events are never stored.
CREATE TABLE IF NOT EXISTS ward_flow_shared_events (
  world_id text NOT NULL REFERENCES ward_flow_shared_worlds (world_id),
  seq bigint NOT NULL CHECK (seq > 0),
  event_id text NOT NULL,
  event_type text NOT NULL,
  role text NOT NULL,
  board_at double precision NOT NULL,
  typed_text boolean NOT NULL,
  event jsonb NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  classification text NOT NULL DEFAULT 'synthetic' CHECK (classification = 'synthetic'),
  PRIMARY KEY (world_id, seq),
  UNIQUE (world_id, event_id)
);

CREATE INDEX IF NOT EXISTS ward_flow_shared_events_type_idx ON ward_flow_shared_events (event_type, recorded_at);

-- The whole world at a sequence. Seq 0 is the seed; more are written as the log grows, so a
-- server starting cold replays only the events after the latest one.
CREATE TABLE IF NOT EXISTS ward_flow_shared_checkpoints (
  world_id text NOT NULL REFERENCES ward_flow_shared_worlds (world_id),
  seq bigint NOT NULL CHECK (seq >= 0),
  state_version integer NOT NULL,
  state jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  classification text NOT NULL DEFAULT 'synthetic' CHECK (classification = 'synthetic'),
  PRIMARY KEY (world_id, seq)
);
