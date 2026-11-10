// A stand-in for the shared Ward Flow server, run by the real engine, and a provider wired to it
// through the real SharedWorkspaceClient. It lets a screen test open a dialog against one board,
// change the world from "a second desk" without the screen hearing of it (no poll runs), and then
// save: the save meets the server's checks at commit time, exactly as a stale popup would.
//
// Fidelity notes. The server answers like backend/ward-flow/postgres.mjs `command`: the sender's
// role and place first (`engine.commandRefusal`, 422 code "scope"), then a clash with another
// desk's change to a record the command names (409, `staleReason`, which never names the patient),
// then the engine's own refusal (422 with the workflow reason). Every reply carries the board. The
// clash check is a simplification of `conflictingCollection`: a record the command names by id
// (admission, movement or referral) that another desk changed since the command's revision. The
// real check is proven against PostgreSQL in backend/ward-flow/postgres.test.mjs. Synthetic only.
import { useEffect, useState, type ReactNode } from "react";

import { applyCommand, commandRefusal, scopeWorld, seedWorld, type SharedWorld } from "../../backend/ward-flow/engine";
import type { WardAccess } from "@/components/ward-management/ward-role-access";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { seedWardFlowState, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import type { WardSharedConnection } from "@/components/ward-management/ward-shared-access";
import {
  SharedWorkspaceClient,
  type SharedSnapshot,
  type SharedView,
} from "@/components/ward-management/ward-shared-client";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

// The backend's own 409 sentence. Loaded through a path the root type check does not follow, so
// it does not take in the backend's plain JavaScript (checked separately by typecheck:backend).
const RECORDS_MODULE = "../../backend/ward-flow/records.mjs";
const { staleReason } = (await import(/* @vite-ignore */ RECORDS_MODULE)) as {
  staleReason: (collection: string) => string;
};

export const DESK_AT = new Date("2026-11-04T02:00:00Z");
const ACTOR = "synthetic-desk-actor";
const NAMED = [
  ["admissionId", "admissions"],
  ["movementId", "movements"],
  ["referralId", "referrals"],
] as const;

export type SentCommand = { commandId: string; expectedRevision: number; event: WardFlowEvent };

export type DeskServer = {
  world: SharedWorld;
  revision: number;
  access: WardAccess;
  /** The account's role was taken away: every request answers 403, as `role-ended` does. */
  revoked: boolean;
  /** Commands that reached the server, in order, including repeats of one command ID. */
  sent: SentCommand[];
  /** Command IDs the server applied (a repeat of an applied ID is answered from its first reply). */
  applied: Set<string>;
  /** Commands the engine found invalid (answered 400, nothing saved). A test expects none. */
  invalid: unknown[];
  /** Apply the next N commands and then drop their replies (a lost reply). */
  loseReplies: number;
  /** Another desk saves `event`; it must be accepted. Returns the new world's state. */
  secondDesk: (event: Record<string, unknown>) => WardFlowState;
  fetch: typeof globalThis.fetch;
};

/** Each named record's body, by collection and id, to see which records a save changed. */
function recordsIn(state: WardFlowState) {
  const out = new Map<string, string>();
  for (const [, collection] of NAMED)
    for (const row of (state[collection] ?? []) as { id: string }[])
      out.set(`${collection}:${row.id}`, JSON.stringify(row));
  return out;
}

export function createDeskServer({
  state,
  access = { role: "coordinator", scope: { kind: "statewide" } },
}: {
  state?: WardFlowState;
  access?: WardAccess;
} = {}): DeskServer {
  // The same synthetic seed the local screens open with, unless the test brings its own.
  const world: SharedWorld = {
    ...seedWorld(DESK_AT),
    state: JSON.parse(JSON.stringify(state ?? seedWardFlowState())),
  };
  // The revision at which each named record last changed, as the server's per-record rows hold it.
  const revisions = new Map<string, number>();
  const replies = new Map<string, { status: number; body: Record<string, unknown> }>();

  function apply(event: Record<string, unknown>) {
    const result = applyCommand(server.world, event, DESK_AT);
    if (result.outcome !== "accepted") return result;
    const before = recordsIn(server.world.state);
    server.world = result.world;
    server.revision += 1;
    for (const [key, row] of recordsIn(server.world.state))
      if (before.get(key) !== row) revisions.set(key, server.revision);
    return result;
  }

  const snapshot = (): SharedSnapshot => ({
    dataMode: "prototype",
    revision: server.revision,
    now: NOW_ANCHOR,
    payload: scopeWorld(server.world, server.access, DESK_AT) as SharedSnapshot["payload"],
  });
  const answer = (status: number, body: Record<string, unknown>) =>
    Response.json({ actorId: ACTOR, access: server.access, accessUntil: Date.now() + 3_600_000, ...body }, { status });

  /** One command, answered in the order postgres.mjs `command` makes its checks. */
  function commit(body: SentCommand): { status: number; body: Record<string, unknown> } {
    const event = body.event as unknown as Record<string, unknown>;
    const scope = commandRefusal(server.world, server.access, event, DESK_AT);
    if (scope) return { status: 422, body: { outcome: "denied", code: "scope", error: scope } };
    const clash = NAMED.find(
      ([field, collection]) =>
        typeof event[field] === "string" &&
        (revisions.get(`${collection}:${String(event[field])}`) ?? 0) > body.expectedRevision,
    )?.[1];
    if (clash) return { status: 409, body: { outcome: "conflict", error: staleReason(clash) } };
    const result = apply(event);
    if (result.outcome !== "accepted") return { status: 422, body: { outcome: "denied", error: result.reason } };
    server.applied.add(body.commandId);
    return { status: 200, body: { outcome: "accepted", commandRevision: server.revision, ...result.completion } };
  }

  const server: DeskServer = {
    world,
    revision: 1,
    access,
    revoked: false,
    sent: [],
    applied: new Set(),
    invalid: [],
    loseReplies: 0,
    secondDesk(event) {
      const result = apply(event);
      if (result.outcome !== "accepted")
        throw new Error(`the second desk's ${String(event.type)} was refused: ${String(result.reason)}`);
      return server.world.state;
    },
    fetch: async (url, init) => {
      const path = new URL(String(url)).pathname;
      if (path !== "/v1/workspace/commands") {
        if (server.revoked)
          return Response.json({ error: "No Ward Flow role is assigned to this account" }, { status: 403 });
        return answer(200, { workingAs: "bootstrap", snapshot: snapshot() });
      }
      const body = JSON.parse(String(init?.body)) as SentCommand;
      server.sent.push(body);
      if (server.revoked)
        return Response.json(
          { code: "role-ended", error: "No Ward Flow role is assigned to this account" },
          { status: 403 },
        );
      // A command ID the server has answered is answered the same way again, and never re-applied.
      let reply = replies.get(body.commandId);
      if (!reply) {
        try {
          reply = commit(body);
        } catch (error) {
          // As shared-http.mjs answers an engine `invalid-command`: nothing is saved.
          if (!(error instanceof Error) || error.message !== "invalid-command") throw error;
          server.invalid.push(body.event);
          return answer(400, { error: "The command is invalid; no change was saved" });
        }
        replies.set(body.commandId, reply);
        if (server.loseReplies > 0 && reply.status === 200) {
          server.loseReplies -= 1;
          throw new TypeError("Synthetic lost reply");
        }
      }
      return answer(reply.status, { ...reply.body, snapshot: snapshot() });
    },
  };
  return server;
}

/** The connection the provider reads, kept in step with the client's published view. */
function useDeskConnection(client: SharedWorkspaceClient, first: SharedView): WardSharedConnection {
  const [view, setView] = useState(first);
  useEffect(() => {
    const listener = (event: Event) => setView((event as CustomEvent<SharedView>).detail);
    window.addEventListener("synthetic-desk-view", listener);
    return () => window.removeEventListener("synthetic-desk-view", listener);
  }, [client]);
  return {
    ...view,
    enabled: true,
    signedIn: true,
    dispatch: client.dispatch,
    retry: client.retry,
    signIn: () => {},
    signOut: () => {},
    pushApi: {
      pushKey: async () => "",
      pushStatus: async () => ({ subscribed: false }),
      pushSubscribe: async () => undefined,
      pushUnsubscribe: async () => undefined,
    } as unknown as WardSharedConnection["pushApi"],
  };
}

/**
 * Opens a desk on `server`: one read, then no polling, so the screen keeps the board it opened with
 * until a save's reply (or the test's own `client.refresh()`) brings the next one.
 */
export async function openDesk(server: DeskServer) {
  let latest: SharedView | null = null;
  const client = new SharedWorkspaceClient({
    baseUrl: "https://example.test",
    token: async () => "synthetic-token",
    manageDrafts: false,
    fetch: server.fetch,
    changed: (view) => {
      latest = view;
      window.dispatchEvent(new CustomEvent("synthetic-desk-view", { detail: view }));
    },
  });
  await client.refresh();
  if (!latest || (latest as SharedView).status !== "ready") throw new Error("the synthetic desk did not open");
  const first = latest as SharedView;
  function Desk({ children }: { children: ReactNode }) {
    const connection = useDeskConnection(client, first);
    return (
      <WardFlowProvider initialNow={NOW_ANCHOR} sharedConnection={connection}>
        {children}
      </WardFlowProvider>
    );
  }
  return { client, Desk, view: () => latest as SharedView | null };
}
