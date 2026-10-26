/**
 * Audit PS-01: once migration 14 is live, a desk that already holds History's archive is sent only
 * the records archived since, never the whole archive again each time it grows. A delta that does
 * not check out is never shown; the desk reads the whole archive instead. Synthetic data only.
 */
import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import * as engine from "../backend/ward-flow/engine";
import type { WardFlowState } from "../src/components/ward-management/ward-flow-reducer";
import { foldArchiveReply, type HeldArchive } from "../src/components/ward-management/ward-shared-archive-delta";
import { SharedWorkspaceClient, type SharedView } from "../src/components/ward-management/ward-shared-client";

// The backend's plain JavaScript store, loaded by URL so the root type check does not take in the
// backend's own (separately checked) source.
const backend = (file: string) => import(/* @vite-ignore */ new URL(`../backend/ward-flow/${file}`, import.meta.url).href);
const { LATEST_MIGRATION } = await backend("migrations.mjs");
const { createWorkspaceStore } = await backend("postgres.mjs");
const { planSave } = await backend("records.mjs");

const at = new Date("2026-10-25T04:00:00Z");
const REVISION = 9;
const world = engine.seedWorld(at);
// Long after the seed, every closed movement is old enough to archive.
const split = engine.archiveClosedState(world.state, 10_000_000 + engine.ARCHIVE_AFTER_MINUTES);
const liveWorld = { ...world, state: JSON.parse(JSON.stringify(split.state)) as WardFlowState };
const generation = liveWorld.state.worldGeneration;

const hashOf = (collection: string, body: { id: string }) =>
  createHash("sha256")
    .update(`${collection}\0${body.id}\0${JSON.stringify(body)}`)
    .digest("hex")
    .slice(0, 12);
const sumOf = (hashes: string[]) =>
  (hashes.reduce((sum, hash) => (sum + Number.parseInt(hash, 16)) % 2 ** 48, 0) as number)
    .toString(16)
    .padStart(12, "0");
const entry = (id: string, closedAt: number, extra: Record<string, unknown> = {}) => {
  const body = { id, ...extra };
  return { collection: "movements" as const, body, closedAt, hash: hashOf("movements", body) };
};

describe("folding an archive reply", () => {
  const a = entry("a", 30);
  const b = entry("b", 20);
  const c = entry("c", 10);
  const held: HeldArchive = { through: 4, entries: [a, b, c] };

  it("keeps a whole reply that checks out, so the next read can be a delta", () => {
    const folded = foldArchiveReply({ records: [a, b], through: 4, sum: sumOf([a.hash, b.hash]) }, null);
    expect(folded).not.toBe("reread");
    expect(folded).not.toBe("invalid");
    if (typeof folded === "string") return;
    expect(folded.held).toEqual({ through: 4, entries: [a, b] });
  });

  it("still shows a whole reply from an older server, but asks for the whole archive next time", () => {
    const folded = foldArchiveReply({ archived: 2, records: [{ collection: "movements", body: { id: "a" } }] }, null);
    if (typeof folded === "string") throw new Error(folded);
    expect(folded.entries.map((row) => row.body.id)).toEqual(["a"]);
    expect(folded.held).toBeNull();
  });

  it("adds the records archived since, newest closed first, and drops what falls below the floor", () => {
    const d = entry("d", 25);
    const folded = foldArchiveReply(
      { since: 4, through: 6, floor: [20, "movements", "b"], records: [d], sum: sumOf([a.hash, d.hash, b.hash]) },
      held,
    );
    if (typeof folded === "string") throw new Error(folded);
    expect(folded.entries.map((row) => row.body.id)).toEqual(["a", "d", "b"]);
    expect(folded.held?.through).toBe(6);
  });

  it("replaces a held record the delta sends again", () => {
    const newer = entry("b", 20, { note: "changed" });
    const folded = foldArchiveReply(
      { since: 4, through: 5, records: [newer], sum: sumOf([a.hash, newer.hash, c.hash]) },
      held,
    );
    if (typeof folded === "string") throw new Error(folded);
    expect(folded.entries[1]).toEqual(newer);
  });

  it.each([
    ["the sum does not match what the desk would hold", { since: 4, through: 5, records: [], sum: sumOf([a.hash]) }],
    [
      "the delta starts from another revision",
      { since: 3, through: 5, records: [], sum: sumOf([a.hash, b.hash, c.hash]) },
    ],
    [
      "a record has no hash",
      {
        since: 4,
        through: 5,
        records: [{ collection: "movements", body: { id: "x" }, closedAt: 1 }],
        sum: "0".repeat(12),
      },
    ],
    [
      "the floor is malformed",
      { since: 4, through: 5, floor: ["x"], records: [], sum: sumOf([a.hash, b.hash, c.hash]) },
    ],
    ["the sum is missing", { since: 4, through: 5, records: [] }],
  ])("asks for the whole archive when %s", (_why, reply) => {
    expect(foldArchiveReply(reply, held)).toBe("reread");
  });

  it("asks for the whole archive when a delta arrives with nothing held", () => {
    expect(foldArchiveReply({ since: 4, through: 5, records: [], sum: "0".repeat(12) }, null)).toBe("reread");
  });

  it("refuses a record outside the archived lists", () => {
    expect(foldArchiveReply({ records: [{ collection: "patients", body: { id: "x" } }] }, null)).toBe("invalid");
  });
});

/**
 * The real store over a stand-in database that answers the archive query as PostgreSQL would:
 * only rows archived after the revision asked for, newest closed first, with the window count.
 */
function archiveStore() {
  const rows: Array<{ collection: string; id: string; closedAt: number; body: unknown; revision: number }> = [];
  const asked: Array<{ after: number; sent: number }> = [];
  const plan = planSave([], liveWorld, REVISION);
  const pool = {
    async query(sql: string, params: unknown[] = []) {
      if (/max\(version\)/.test(sql)) return { rows: [{ version: LATEST_MIGRATION }] };
      if (/FROM ward_flow\.archived_records/.test(sql)) {
        expect(params[1]).toBe(generation);
        const after = params[2] as number;
        const fresh = rows
          .filter((row) => row.revision > after)
          .sort((x, y) => y.closedAt - x.closedAt || (x.id < y.id ? -1 : 1));
        const sent = fresh.slice(0, params[3] as number);
        asked.push({ after, sent: sent.length });
        return {
          rows: sent.map((row) => ({
            collection: row.collection,
            record_id: row.id,
            closed_at: row.closedAt,
            body: structuredClone(row.body),
            archived_revision: String(row.revision),
            archived: fresh.length,
            through: String(Math.max(...fresh.map((one) => one.revision))),
          })),
        };
      }
      if (/FROM ward_flow\.workspaces w/.test(sql))
        return {
          rows: [
            {
              data_mode: "prototype",
              revision: String(REVISION),
              payload: structuredClone(plan.core),
              cache_revision: String(REVISION),
              cache_updated_at: new Date(at),
              records: plan.upserts.map(
                (part: {
                  collection: string;
                  recordId: string;
                  kind: string;
                  ordinal: number;
                  revision: number;
                  body: unknown;
                }) => ({
                  collection: part.collection,
                  record_id: part.recordId,
                  kind: part.kind,
                  ordinal: part.ordinal,
                  revision: part.revision,
                  fresh: true,
                  body: structuredClone(part.body),
                }),
              ),
            },
          ],
        };
      throw new Error(`Unexpected query: ${sql.slice(0, 80)}`);
    },
    connect() {
      throw new Error("The archive read must not open a transaction");
    },
  };
  const store = createWorkspaceStore(pool, {
    workspaceId: "22222222-2222-4222-8222-222222222222",
    engine,
    clock: () => new Date(at),
  });
  const archive = (records: typeof split.archived, revision: number) =>
    rows.push(...records.map((record) => ({ ...record, body: structuredClone(record.body), revision })));
  return { store, archive, asked, count: () => rows.length };
}

describe("a desk that holds the archive is sent only what is new", () => {
  it("the store reads only rows archived since it last looked, and a delta carries only the new records", async () => {
    const { store, archive, asked } = archiveStore();
    archive(split.archived.slice(0, 4), 2);
    const whole = await store.archive(undefined);
    expect(whole.records).toHaveLength(4);
    expect(whole.through).toBe(2);
    expect(whole).not.toHaveProperty("since");

    const unchanged = await store.archive(undefined, 2);
    expect(unchanged.records).toEqual([]);
    expect(unchanged.sum).toBe(whole.sum);
    expect(asked.at(-1)).toEqual({ after: 2, sent: 0 });

    archive(split.archived.slice(4), 5);
    const delta = await store.archive(undefined, 2);
    expect(delta.since).toBe(2);
    expect(delta.through).toBe(5);
    expect(delta.archived).toBe(split.archived.length);
    expect(delta.records.map((record: { body: { id: string } }) => record.body.id).sort()).toEqual(
      split.archived
        .slice(4)
        .map((record) => record.id)
        .sort(),
    );
    expect(asked.at(-1)).toEqual({ after: 2, sent: split.archived.length - 4 });

    // A process with nothing held reads the whole archive, and sums it the same way.
    const { store: fresh, archive: archiveFresh } = archiveStore();
    archiveFresh(split.archived.slice(0, 4), 2);
    archiveFresh(split.archived.slice(4), 5);
    expect((await fresh.archive(undefined)).sum).toBe(delta.sum);
  });

  it("the shared client asks with what it holds, ends with every archived record and refetches only the new ones", async () => {
    const { store, archive, count } = archiveStore();
    archive(split.archived.slice(0, 4), 2);
    let view: SharedView | undefined;
    const archiveReads: Array<{ since: string | null; bytes: number }> = [];
    const shared = new SharedWorkspaceClient({
      baseUrl: "https://example.test",
      token: async () => "test",
      changed: (next) => {
        view = next;
      },
      fetch: async (url) => {
        const parsed = new URL(String(url));
        if (parsed.pathname === "/v1/workspace/archive") {
          const since = parsed.searchParams.get("since");
          const body = JSON.stringify(await store.archive(undefined, since === null ? undefined : Number(since)));
          archiveReads.push({ since, bytes: body.length });
          return new Response(body, { headers: { "content-type": "application/json" } });
        }
        return Response.json({
          snapshot: {
            dataMode: "prototype",
            revision: REVISION,
            now: 0,
            archived: count(),
            payload: {
              version: 1,
              state: liveWorld.state,
              dayZero: "2026-10-07T00:00:00Z",
              startedAt: "2026-10-07T10:00:00Z",
            },
          },
        });
      },
    });
    const shown = () => new Set<string>(view?.snapshot?.payload.state.movements.map((movement) => movement.id));
    try {
      await shared.refresh();
      await vi.waitFor(() => expect(archiveReads).toHaveLength(1));
      await vi.waitFor(() => expect(shown().has(split.archived[0]!.id)).toBe(true));
      archive(split.archived.slice(4), 5);
      await shared.refresh();
      await vi.waitFor(() => expect(archiveReads).toHaveLength(2));
      await vi.waitFor(() => {
        for (const record of split.archived) expect(shown().has(record.id)).toBe(true);
      });
      expect(archiveReads[0]!.since).toBeNull();
      expect(archiveReads[1]!.since).toBe("2");
      expect(archiveReads).toHaveLength(2);
    } finally {
      shared.dispose();
    }
  });

  it("a delta that does not check out is never shown: the client reads the whole archive instead", async () => {
    const record = split.archived[0]!;
    const hash = hashOf(record.collection, record.body as { id: string });
    const whole = {
      through: 2,
      sum: sumOf([hash]),
      records: [{ collection: record.collection, body: record.body, closedAt: 30, hash }],
    };
    let archived = 1;
    const paths: string[] = [];
    let view: SharedView | undefined;
    const shared = new SharedWorkspaceClient({
      baseUrl: "https://example.test",
      token: async () => "test",
      changed: (next) => {
        view = next;
      },
      fetch: async (url) => {
        const parsed = new URL(String(url));
        if (parsed.pathname === "/v1/workspace/archive") {
          paths.push(parsed.search);
          // A delta whose sum says the desk should hold something it does not.
          if (parsed.searchParams.has("since"))
            return Response.json({ ...whole, since: 2, through: 3, records: [], sum: "f".repeat(12), archived });
          return Response.json({ ...whole, archived });
        }
        return Response.json({
          snapshot: {
            dataMode: "prototype",
            revision: REVISION,
            now: 0,
            archived,
            payload: {
              version: 1,
              state: liveWorld.state,
              dayZero: "2026-10-07T00:00:00Z",
              startedAt: "2026-10-07T10:00:00Z",
            },
          },
        });
      },
    });
    try {
      await shared.refresh();
      await vi.waitFor(() => expect(paths).toEqual([""]));
      archived = 2;
      await shared.refresh();
      await vi.waitFor(() => expect(paths).toEqual(["", "?since=2", ""]));
      await vi.waitFor(() =>
        expect(view?.snapshot?.payload.state.movements.some((movement) => movement.id === split.archived[0]!.id)).toBe(
          true,
        ),
      );
    } finally {
      shared.dispose();
    }
  });
});
