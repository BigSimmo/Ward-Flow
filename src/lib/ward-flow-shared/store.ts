import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import type { WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { SharedEventRecord } from "@/components/ward-management/shared/ward-flow-shared-core";

/**
 * Storage boundary for the shared world (feature 3). The service holds the rules; a store only
 * reads and writes rows. `createPgSharedStateStore` is the Postgres store; tests inject an
 * in-memory one or run this one on `pg-mem`.
 */

export type SharedWorldRow = {
  worldId: string;
  stateVersion: number;
  dayZeroMs: number;
  startedAtMs: number;
};

export type SharedCheckpoint = { seq: number; stateVersion: number; state: WardFlowState };

export type SharedEventRow = {
  seq: number;
  eventId: string;
  event: WardFlowEvent;
  typedText: boolean;
};

export type SharedAppendOutcome = "appended" | "seq-taken" | "duplicate-event";

export interface SharedStateStore {
  /** Applies the schema. Idempotent; safe to call from several server instances at once. */
  migrate(): Promise<void>;
  /** The latest world for this stored-state version (by day), or null. */
  currentWorld(stateVersion: number): Promise<SharedWorldRow | null>;
  getWorld(worldId: string): Promise<SharedWorldRow | null>;
  /** Creates the world with the seed as checkpoint 0. If another writer already created the world
   *  for the same version and day, returns that one instead. */
  createWorld(world: SharedWorldRow, seed: WardFlowState): Promise<SharedWorldRow>;
  latestCheckpoint(worldId: string): Promise<SharedCheckpoint | null>;
  eventsAfter(worldId: string, after: number, limit: number): Promise<SharedEventRecord[]>;
  headSeq(worldId: string): Promise<number>;
  findEventSeq(worldId: string, eventId: string): Promise<number | null>;
  /** Inserts at exactly `row.seq`. Never overwrites: a taken sequence or event id is reported. */
  appendEvent(worldId: string, row: SharedEventRow): Promise<SharedAppendOutcome>;
  putCheckpoint(worldId: string, checkpoint: SharedCheckpoint): Promise<void>;
}

/** The subset of `pg`'s Pool this store uses, so `pg-mem`'s adapter fits too. */
type QueryResultLike = { rows: Record<string, unknown>[] };
type ClientLike = {
  query(text: string, values?: unknown[]): Promise<QueryResultLike>;
  release(): void;
};
export type PoolLike = {
  query(text: string, values?: unknown[]): Promise<QueryResultLike>;
  connect(): Promise<ClientLike>;
};

export type SharedMigration = { name: string; sql: string };

/** Arbitrary constant that names this schema's advisory lock. */
const MIGRATION_LOCK_KEY = 782_322;

function toNumber(value: unknown): number {
  const result = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(result)) throw new Error("Unexpected non-numeric column");
  return result;
}

function toJson<T>(value: unknown): T {
  return (typeof value === "string" ? JSON.parse(value) : value) as T;
}

function worldFromRow(row: Record<string, unknown>): SharedWorldRow {
  return {
    worldId: String(row.world_id),
    stateVersion: toNumber(row.state_version),
    dayZeroMs: toNumber(row.day_zero_ms),
    startedAtMs: toNumber(row.started_at_ms),
  };
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === "23505";
}

async function inTransaction<T>(pool: PoolLike, work: (client: ClientLike) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

const WORLD_COLUMNS = "world_id, state_version, day_zero_ms, started_at_ms";

export function createPgSharedStateStore(pool: PoolLike, migrations: readonly SharedMigration[]): SharedStateStore {
  const store: SharedStateStore = {
    async migrate() {
      await inTransaction(pool, async (client) => {
        await client.query("SELECT pg_advisory_xact_lock($1)", [MIGRATION_LOCK_KEY]);
        await client.query(
          "CREATE TABLE IF NOT EXISTS ward_flow_shared_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
        );
        for (const migration of migrations) {
          const applied = await client.query("SELECT name FROM ward_flow_shared_migrations WHERE name = $1", [
            migration.name,
          ]);
          if (applied.rows.length > 0) continue;
          await client.query(migration.sql);
          await client.query("INSERT INTO ward_flow_shared_migrations (name) VALUES ($1)", [migration.name]);
        }
      });
    },

    async currentWorld(stateVersion) {
      const result = await pool.query(
        `SELECT ${WORLD_COLUMNS} FROM ward_flow_shared_worlds WHERE state_version = $1 ORDER BY day_zero_ms DESC LIMIT 1`,
        [stateVersion],
      );
      return result.rows[0] ? worldFromRow(result.rows[0]) : null;
    },

    async getWorld(worldId) {
      const result = await pool.query(`SELECT ${WORLD_COLUMNS} FROM ward_flow_shared_worlds WHERE world_id = $1`, [
        worldId,
      ]);
      return result.rows[0] ? worldFromRow(result.rows[0]) : null;
    },

    async createWorld(world, seed) {
      try {
        await inTransaction(pool, async (client) => {
          await client.query(`INSERT INTO ward_flow_shared_worlds (${WORLD_COLUMNS}) VALUES ($1, $2, $3, $4)`, [
            world.worldId,
            world.stateVersion,
            world.dayZeroMs,
            world.startedAtMs,
          ]);
          await client.query(
            "INSERT INTO ward_flow_shared_checkpoints (world_id, seq, state_version, state) VALUES ($1, 0, $2, $3::jsonb)",
            [world.worldId, world.stateVersion, JSON.stringify(seed)],
          );
        });
        return world;
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        // Another instance created this day's world first: join that one.
        const existing = await pool.query(
          `SELECT ${WORLD_COLUMNS} FROM ward_flow_shared_worlds WHERE state_version = $1 AND day_zero_ms = $2`,
          [world.stateVersion, world.dayZeroMs],
        );
        if (!existing.rows[0]) throw error;
        return worldFromRow(existing.rows[0]);
      }
    },

    async latestCheckpoint(worldId) {
      const result = await pool.query(
        "SELECT seq, state_version, state FROM ward_flow_shared_checkpoints WHERE world_id = $1 ORDER BY seq DESC LIMIT 1",
        [worldId],
      );
      const row = result.rows[0];
      if (!row) return null;
      return {
        seq: toNumber(row.seq),
        stateVersion: toNumber(row.state_version),
        state: toJson<WardFlowState>(row.state),
      };
    },

    async eventsAfter(worldId, after, limit) {
      const result = await pool.query(
        "SELECT seq, event_id, event FROM ward_flow_shared_events WHERE world_id = $1 AND seq > $2 ORDER BY seq ASC LIMIT $3",
        [worldId, after, limit],
      );
      return result.rows.map((row) => ({
        seq: toNumber(row.seq),
        eventId: String(row.event_id),
        event: toJson<WardFlowEvent>(row.event),
      }));
    },

    async headSeq(worldId) {
      const result = await pool.query(
        "SELECT COALESCE(MAX(seq), 0) AS head FROM ward_flow_shared_events WHERE world_id = $1",
        [worldId],
      );
      return toNumber(result.rows[0]?.head ?? 0);
    },

    async findEventSeq(worldId, eventId) {
      const result = await pool.query("SELECT seq FROM ward_flow_shared_events WHERE world_id = $1 AND event_id = $2", [
        worldId,
        eventId,
      ]);
      return result.rows[0] ? toNumber(result.rows[0].seq) : null;
    },

    async appendEvent(worldId, row) {
      try {
        await pool.query(
          `INSERT INTO ward_flow_shared_events
             (world_id, seq, event_id, event_type, role, board_at, typed_text, event)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
          [
            worldId,
            row.seq,
            row.eventId,
            row.event.type,
            row.event.role,
            row.event.now,
            row.typedText,
            JSON.stringify(row.event),
          ],
        );
        return "appended";
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        // The constraint name is not portable across drivers, so ask which key was taken.
        return (await store.findEventSeq(worldId, row.eventId)) === null ? "seq-taken" : "duplicate-event";
      }
    },

    async putCheckpoint(worldId, checkpoint) {
      await pool.query(
        `INSERT INTO ward_flow_shared_checkpoints (world_id, seq, state_version, state)
         VALUES ($1, $2, $3, $4::jsonb) ON CONFLICT (world_id, seq) DO NOTHING`,
        [worldId, checkpoint.seq, checkpoint.stateVersion, JSON.stringify(checkpoint.state)],
      );
    },
  };
  return store;
}
