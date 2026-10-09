import type {
  SharedCheckpoint,
  SharedEventRow,
  SharedStateStore,
  SharedWorldRow,
} from "../../src/components/ward-management/shared/server/store";
import type { SharedEventRecord } from "../../src/components/ward-management/shared/ward-flow-shared-core";

/**
 * An in-memory `SharedStateStore` with the same uniqueness rules as the SQL schema: one world per
 * (version, day), one event per (world, seq) and per (world, event id). Rows are deep-copied in and
 * out, as a database would, so a test cannot pass by sharing an object with the service.
 */
export function createMemorySharedStateStore() {
  const worlds: SharedWorldRow[] = [];
  const events = new Map<string, (SharedEventRow & { recordedAt: number })[]>();
  const checkpoints = new Map<string, SharedCheckpoint[]>();
  const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
  let migrations = 0;

  const store: SharedStateStore = {
    async migrate() {
      migrations += 1;
    },
    async currentWorld(stateVersion) {
      const candidates = worlds.filter((world) => world.stateVersion === stateVersion);
      candidates.sort((a, b) => b.dayZeroMs - a.dayZeroMs);
      return candidates[0] ? copy(candidates[0]) : null;
    },
    async getWorld(worldId) {
      const world = worlds.find((candidate) => candidate.worldId === worldId);
      return world ? copy(world) : null;
    },
    async createWorld(world, seed) {
      const existing = worlds.find(
        (candidate) => candidate.stateVersion === world.stateVersion && candidate.dayZeroMs === world.dayZeroMs,
      );
      if (existing) return copy(existing);
      worlds.push(copy(world));
      events.set(world.worldId, []);
      checkpoints.set(world.worldId, [{ seq: 0, stateVersion: world.stateVersion, state: copy(seed) }]);
      return copy(world);
    },
    async latestCheckpoint(worldId) {
      const list = checkpoints.get(worldId) ?? [];
      const latest = [...list].sort((a, b) => b.seq - a.seq)[0];
      return latest ? copy(latest) : null;
    },
    async eventsAfter(worldId, after, limit) {
      return (events.get(worldId) ?? [])
        .filter((row) => row.seq > after)
        .sort((a, b) => a.seq - b.seq)
        .slice(0, limit)
        .map((row): SharedEventRecord => copy({ seq: row.seq, eventId: row.eventId, event: row.event }));
    },
    async headSeq(worldId) {
      return Math.max(0, ...(events.get(worldId) ?? []).map((row) => row.seq));
    },
    async findEventSeq(worldId, eventId) {
      return (events.get(worldId) ?? []).find((row) => row.eventId === eventId)?.seq ?? null;
    },
    async appendEvent(worldId, row) {
      const list = events.get(worldId);
      if (!list) throw new Error("no such world");
      if (list.some((existing) => existing.eventId === row.eventId)) return "duplicate-event";
      if (list.some((existing) => existing.seq === row.seq)) return "seq-taken";
      list.push({ ...copy(row), recordedAt: Date.now() });
      return "appended";
    },
    async putCheckpoint(worldId, checkpoint) {
      const list = checkpoints.get(worldId) ?? [];
      if (!list.some((existing) => existing.seq === checkpoint.seq)) list.push(copy(checkpoint));
      checkpoints.set(worldId, list);
    },
  };

  return {
    store,
    /** Rows as stored, for assertions about what reached the "database". */
    eventRows: (worldId: string) => copy(events.get(worldId) ?? []),
    checkpointSeqs: (worldId: string) => (checkpoints.get(worldId) ?? []).map((checkpoint) => checkpoint.seq),
    worldCount: () => worlds.length,
    migrationCalls: () => migrations,
    /** Simulates another server instance appending directly, bypassing this service's cache. */
    appendBehindTheServiceBack: (worldId: string, row: SharedEventRow) => store.appendEvent(worldId, row),
  };
}
