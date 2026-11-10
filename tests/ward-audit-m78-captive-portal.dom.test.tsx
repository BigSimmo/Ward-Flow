// M78 (master audit list, 10 Nov 2026): hospital network conditions. A captive portal or proxy that
// answers the board read with a login page, a redirect or an old cached reply must show as not
// updating (unavailable, with the last good read's time unchanged), never as fresh data, and the
// next good read after moving networks recovers by itself. Synthetic board only; fetch is faked.
import { afterEach, describe, expect, it } from "vitest";
import {
  SharedWorkspaceClient,
  type SharedSnapshot,
  type SharedView,
} from "../src/components/ward-management/ward-shared-client";
import { seedWardFlowStateAt } from "../src/components/ward-management/ward-flow-reducer";

const state = seedWardFlowStateAt(0);
const snapshot = (revision: number): SharedSnapshot => ({
  dataMode: "prototype",
  revision,
  now: 642,
  payload: { version: 1, state, dayZero: "2026-11-04T00:00:00Z", startedAt: "2026-11-04T10:00:00Z" },
});
const good = (revision: number) =>
  Response.json({ snapshot: snapshot(revision), receiptScope: "desk", accessUntil: Date.now() + 600_000 });
const loginPage = () =>
  new Response("<!doctype html><title>Hospital guest Wi-Fi</title><form>Sign in</form>", {
    status: 200,
    headers: { "content-type": "text/html" },
  });

let clients: SharedWorkspaceClient[] = [];
afterEach(() => {
  clients.forEach((client) => client.dispose());
  clients = [];
});

function harness() {
  let answer: () => Response | Promise<Response> = () => good(5);
  let view: SharedView | undefined;
  let reads = 0;
  const client = new SharedWorkspaceClient({
    baseUrl: "https://synthetic.invalid",
    token: async () => "synthetic-token",
    manageDrafts: false,
    changed: (next) => {
      view = next;
    },
    fetch: async () => {
      reads += 1;
      return answer();
    },
  });
  clients.push(client);
  return {
    client,
    view: () => view!,
    reads: () => reads,
    answer: (next: () => Response | Promise<Response>) => {
      answer = next;
    },
  };
}

const portalAnswers: Array<[string, () => Response | Promise<Response>]> = [
  ["a 200 login page (HTML, not JSON)", loginPage],
  [
    "a followed redirect that ends on the portal's login page",
    () => {
      const response = loginPage();
      Object.defineProperty(response, "redirected", { value: true });
      Object.defineProperty(response, "url", { value: "http://portal.synthetic.invalid/login" });
      return response;
    },
  ],
  [
    "an unfollowed 302 to the portal",
    () => new Response(null, { status: 302, headers: { location: "http://portal.synthetic.invalid/login" } }),
  ],
  ["an opaque redirect or blocked cross-origin answer", () => Response.error()],
  ["a proxy's 511 network authentication required page", () => new Response("Sign in", { status: 511 })],
  ["a proxy that answers JSON that is not a board", () => Response.json({ ok: true })],
  [
    "an old cached 'not modified' for another revision",
    () => Response.json({ notModified: true, revision: 3, now: 600 }),
  ],
];

describe("M78: captive portals and proxies never look like fresh data", () => {
  for (const [name, answer] of portalAnswers)
    it(`${name} shows as unavailable and keeps the last good read's time`, async () => {
      const h = harness();
      await h.client.refresh();
      expect(h.view().status).toBe("ready");
      const lastGood = h.view().receivedAt;
      expect(lastGood).toBeGreaterThan(0);
      await new Promise((resolve) => setTimeout(resolve, 5));
      h.answer(answer);
      await h.client.refresh();
      expect(h.view().status).toBe("unavailable");
      expect(h.view().receivedAt).toBe(lastGood);
      expect(h.view().snapshot?.revision).toBe(5);

      // Moving to a working network: the browser's `online` event reads again by itself.
      h.answer(() => good(6));
      const before = h.reads();
      window.dispatchEvent(new Event("online"));
      await expect.poll(() => h.view().status).toBe("ready");
      expect(h.reads()).toBeGreaterThan(before);
      expect(h.view().snapshot?.revision).toBe(6);
      expect(h.view().receivedAt).toBeGreaterThan(lastGood);
    });

  it("an old cached full board never replaces the newer one or refreshes the last good read's time", async () => {
    const h = harness();
    await h.client.refresh();
    const lastGood = h.view().receivedAt;
    await new Promise((resolve) => setTimeout(resolve, 5));
    h.answer(() => good(3));
    await h.client.refresh();
    expect(h.view().snapshot?.revision).toBe(5);
    // The freshness chip counts from receivedAt, so the board turns "Not updating since" on time.
    expect(h.view().receivedAt).toBe(lastGood);
  });
});
