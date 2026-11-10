// M83 (master audit list, 10 Nov 2026): saves fail safely at the 8 MiB board limit. The backend side
// (8,388,608 characters accepted, one more refused with no revision change, and HTTP 413
// "workspace-full") is tested in backend/ward-flow/performance.test.mjs and shared-http.test.mjs.
// This is the browser half: a 413 is settled as refused, never queued for Retry or sent again, and
// the board stays usable. Synthetic board; fetch is faked.
import { expect, it } from "vitest";
import { SharedWorkspaceClient, type SharedView } from "../src/components/ward-management/ward-shared-client";
import { seedWardFlowStateAt } from "../src/components/ward-management/ward-flow-reducer";
import { saveProblem } from "../src/components/ward-management/ward-save-failure";

it("a 413 workspace-full answer is a definite refusal: sent once, not retried, board still ready", async () => {
  const state = seedWardFlowStateAt(0);
  const posts: string[] = [];
  let view: SharedView | undefined;
  const client = new SharedWorkspaceClient({
    baseUrl: "https://synthetic.invalid",
    token: async () => "synthetic-token",
    manageDrafts: false,
    changed: (next) => {
      view = next;
    },
    fetch: async (url, options) => {
      if (options?.method === "POST") {
        posts.push(String(url));
        return Response.json(
          { code: "workspace-full", error: "The shared workspace is full, so this change was not saved." },
          { status: 413 },
        );
      }
      return Response.json({
        snapshot: {
          dataMode: "prototype",
          revision: 7,
          now: 642,
          payload: { version: 1, state, dayZero: "2026-11-04T00:00:00Z", startedAt: "2026-11-04T10:00:00Z" },
        },
        receiptScope: "desk",
        accessUntil: Date.now() + 600_000,
      });
    },
  });
  try {
    await client.refresh();
    expect(view?.status).toBe("ready");
    const unitId = state.units[0]!.id;
    const outcome = await client.dispatch({ type: "REQUEST_CAPACITY_REFRESH", role: "coordinator", unitId } as never);
    expect(outcome.status).toBe("refused");
    expect(posts).toHaveLength(1);
    expect(view?.status).toBe("ready");
    expect(view?.snapshot?.revision).toBe(7);
    expect(view?.error).toBe(saveProblem("refused"));
    await client.refresh();
    expect(posts).toHaveLength(1);
  } finally {
    client.dispose();
  }
});
it.todo("M83 (Josh): say 'The shared board is full' for a 413 workspace-full, rather than the generic refusal text");
