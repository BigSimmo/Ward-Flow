import { describe, expect, it } from "vitest";

import type { WardFlowEvent } from "../src/components/ward-management/ward-flow-events";
import { WARD_FLOW_STORED_STATE_VERSION } from "../src/components/ward-management/ward-flow-storage-validation";
import { SHARED_BUILD_HEADER } from "../src/components/ward-management/shared/ward-flow-shared-core";
import {
  accessTokenValid,
  issueAccessToken,
  SHARED_ACCESS_COOKIE,
  SHARED_ACCESS_TTL_SECONDS,
} from "../src/components/ward-management/shared/server/access";
import {
  readSharedConfig,
  sharedModeForBrowser,
  type SharedConfig,
} from "../src/components/ward-management/shared/server/config";
import {
  handleSharedAccess,
  handleSharedEventsGet,
  handleSharedEventsPost,
  handleSharedJoin,
  type SharedHttpDeps,
} from "../src/components/ward-management/shared/server/http";
import { createSharedWorldService } from "../src/components/ward-management/shared/server/service";
import { createMemorySharedStateStore } from "./helpers/ward-flow-shared-memory-store";

// A made-up code for tests only.
const CODE = "synthetic-test-access-code-0001";
const BUILD = "build-under-test";
const NOW_SECONDS = 1_791_590_400;
const DAY_ZERO = Date.UTC(2026, 9, 8, 16, 0, 0);
const WORLD = "11111111-1111-4111-8111-111111111111";
const BASE = "https://ward-flow.test/api/ward-flow/shared";

const readyConfig: SharedConfig = {
  enabled: true,
  ready: true,
  databaseUrl: "postgres://unused",
  accessCode: CODE,
  typedTextAllowed: false,
  buildId: BUILD,
};

function deps(config: SharedConfig = readyConfig): SharedHttpDeps & { serviceCalls: () => number } {
  const memory = createMemorySharedStateStore();
  const service = createSharedWorldService({
    store: memory.store,
    nowMs: () => DAY_ZERO + 9 * 60 * 60 * 1000,
    newWorldId: () => WORLD,
  });
  let calls = 0;
  return {
    config,
    service: () => {
      calls += 1;
      return service;
    },
    nowSeconds: () => NOW_SECONDS,
    failureDelayMs: 0,
    serviceCalls: () => calls,
  };
}

const cookie = `${SHARED_ACCESS_COOKIE}=${issueAccessToken(CODE, NOW_SECONDS)}`;

function post(path: string, body: unknown, headers: Record<string, string> = {}): Request {
  return new Request(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", [SHARED_BUILD_HEADER]: BUILD, cookie, ...headers },
    body: JSON.stringify(body),
  });
}

const refresh: WardFlowEvent = {
  type: "REQUEST_CAPACITY_REFRESH",
  role: "coordinator",
  now: 642,
  unitId: "rph-adult-secure",
};

describe("shared-state switch", () => {
  it("is off without DATABASE_URL and needs a long access code when on", () => {
    expect(readSharedConfig({})).toEqual({ enabled: false });
    expect(readSharedConfig({ DATABASE_URL: "  " })).toEqual({ enabled: false });
    expect(readSharedConfig({ DATABASE_URL: "postgres://x" })).toEqual({
      enabled: true,
      ready: false,
      reason: "access-code-missing",
    });
    expect(readSharedConfig({ DATABASE_URL: "postgres://x", WARD_FLOW_SHARED_ACCESS_CODE: "short" }).enabled).toBe(
      true,
    );
    const ready = readSharedConfig({ DATABASE_URL: "postgres://x", WARD_FLOW_SHARED_ACCESS_CODE: CODE });
    expect(ready).toMatchObject({ enabled: true, ready: true, typedTextAllowed: false, buildId: "local" });
    expect(
      readSharedConfig({
        DATABASE_URL: "postgres://x",
        WARD_FLOW_SHARED_ACCESS_CODE: CODE,
        WARD_FLOW_SHARED_TYPED_TEXT: "yes",
      }),
    ).toMatchObject({ typedTextAllowed: false });
    expect(
      readSharedConfig({
        DATABASE_URL: "postgres://x",
        WARD_FLOW_SHARED_ACCESS_CODE: CODE,
        WARD_FLOW_SHARED_TYPED_TEXT: "allow",
      }),
    ).toMatchObject({ typedTextAllowed: true });
  });

  it("tells the browser only a boolean and a build id", () => {
    expect(sharedModeForBrowser({})).toEqual({ enabled: false, buildId: "local" });
    expect(
      sharedModeForBrowser({
        DATABASE_URL: "postgres://secret",
        WARD_FLOW_SHARED_ACCESS_CODE: CODE,
        RAILWAY_GIT_COMMIT_SHA: "abc",
      }),
    ).toEqual({ enabled: true, buildId: "abc" });
  });

  it("answers 404 on every route and opens no database while disabled", async () => {
    const off = deps({ enabled: false });
    for (const response of [
      await handleSharedAccess(post("/access", { code: CODE }), off),
      await handleSharedJoin(post("/join", {}), off),
      await handleSharedEventsGet(new Request(`${BASE}/events?worldId=${WORLD}&after=0`), off),
      await handleSharedEventsPost(post("/events", {}), off),
    ]) {
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: "shared_state_disabled" });
    }
    expect(off.serviceCalls()).toBe(0);
  });

  it("answers 503 when the access code is missing", async () => {
    const locked = deps({ enabled: true, ready: false, reason: "access-code-missing" });
    expect((await handleSharedJoin(post("/join", {}), locked)).status).toBe(503);
    expect((await handleSharedAccess(post("/access", { code: CODE }), locked)).status).toBe(503);
    expect(locked.serviceCalls()).toBe(0);
  });
});

describe("shared-state access code", () => {
  it("issues an HttpOnly, SameSite=Strict cookie for the right code only", async () => {
    const wrong = await handleSharedAccess(post("/access", { code: "not-the-code" }), deps());
    expect(wrong.status).toBe(401);
    expect(wrong.headers.get("set-cookie")).toBeNull();
    expect(await wrong.text()).not.toContain(CODE);

    const right = await handleSharedAccess(post("/access", { code: CODE }), deps());
    expect(right.status).toBe(204);
    const setCookie = right.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(`${SHARED_ACCESS_COOKIE}=v1.`);
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Strict");
    expect(setCookie).toContain("Secure");
    expect(setCookie).toContain("Path=/api/ward-flow/shared");
    expect(setCookie).not.toContain(CODE);
  });

  it("refuses expired, forged and other-code tokens", () => {
    const token = issueAccessToken(CODE, NOW_SECONDS);
    expect(accessTokenValid(token, CODE, NOW_SECONDS)).toBe(true);
    expect(accessTokenValid(token, CODE, NOW_SECONDS + SHARED_ACCESS_TTL_SECONDS)).toBe(false);
    expect(accessTokenValid(token, "another-synthetic-code-0002", NOW_SECONDS)).toBe(false);
    const [prefix, expiresAt, signature] = token.split(".");
    expect(accessTokenValid(`${prefix}.${Number(expiresAt) + 60}.${signature}`, CODE, NOW_SECONDS)).toBe(false);
    expect(accessTokenValid(undefined, CODE, NOW_SECONDS)).toBe(false);
    expect(accessTokenValid("v1.garbage", CODE, NOW_SECONDS)).toBe(false);
  });

  it("refuses data routes without the cookie and with an old build", async () => {
    const noCookie = await handleSharedJoin(post("/join", {}, { cookie: "" }), deps());
    expect(noCookie.status).toBe(401);
    const oldBuild = await handleSharedJoin(post("/join", {}, { [SHARED_BUILD_HEADER]: "older-build" }), deps());
    expect(oldBuild.status).toBe(426);
  });
});

describe("shared-state routes", () => {
  it("joins, appends, polls and reports conflicts and refusals with codes only", async () => {
    const d = deps();
    const joined = await handleSharedJoin(
      post("/join", { dayZeroMs: DAY_ZERO, stateVersion: WARD_FLOW_STORED_STATE_VERSION }),
      d,
    );
    expect(joined.status).toBe(200);
    const joinBody = (await joined.json()) as { worldId: string; seq: number; typedTextAllowed: boolean };
    expect(joinBody).toMatchObject({ worldId: WORLD, seq: 0, typedTextAllowed: false });

    const accepted = await handleSharedEventsPost(
      post("/events", { worldId: WORLD, baseSeq: 0, eventId: "client-a-0001", event: refresh }),
      d,
    );
    expect(accepted.status).toBe(200);
    expect(await accepted.json()).toEqual({ seq: 1, duplicate: false });

    const conflict = await handleSharedEventsPost(
      post("/events", { worldId: WORLD, baseSeq: 0, eventId: "client-b-0001", event: refresh }),
      d,
    );
    expect(conflict.status).toBe(409);
    expect(await conflict.json()).toEqual({ error: "conflict", headSeq: 1 });

    const refused = await handleSharedEventsPost(
      post("/events", {
        worldId: WORLD,
        baseSeq: 1,
        eventId: "client-b-0002",
        event: { ...refresh, unitId: "no-such-unit" },
      }),
      d,
    );
    expect(refused.status).toBe(422);
    // The refusal reason (which can quote an id back) never leaves the server.
    expect(await refused.json()).toEqual({ error: "refused" });

    const typed = await handleSharedEventsPost(
      post("/events", {
        worldId: WORLD,
        baseSeq: 1,
        eventId: "client-b-0003",
        event: { type: "RECORD_ESCALATION", role: "coordinator", now: 642 },
      }),
      d,
    );
    expect(typed.status).toBe(403);

    const polled = await handleSharedEventsGet(
      new Request(`${BASE}/events?worldId=${WORLD}&after=0`, { headers: { [SHARED_BUILD_HEADER]: BUILD, cookie } }),
      d,
    );
    expect(polled.status).toBe(200);
    expect(await polled.json()).toEqual({
      currentWorldId: WORLD,
      headSeq: 1,
      truncated: false,
      events: [{ seq: 1, eventId: "client-a-0001", event: refresh }],
    });
  });

  it("refuses non-JSON, oversized and malformed bodies", async () => {
    const d = deps();
    const text = new Request(`${BASE}/events`, {
      method: "POST",
      headers: { "content-type": "text/plain", [SHARED_BUILD_HEADER]: BUILD, cookie },
      body: "{}",
    });
    expect((await handleSharedEventsPost(text, d)).status).toBe(415);
    const big = post("/events", { pad: "x".repeat(70 * 1024) });
    expect((await handleSharedEventsPost(big, d)).status).toBe(413);
    const broken = new Request(`${BASE}/events`, {
      method: "POST",
      headers: { "content-type": "application/json", [SHARED_BUILD_HEADER]: BUILD, cookie },
      body: "{not json",
    });
    expect((await handleSharedEventsPost(broken, d)).status).toBe(400);
    const badPoll = new Request(`${BASE}/events?worldId=${WORLD}&after=-1`, {
      headers: { [SHARED_BUILD_HEADER]: BUILD, cookie },
    });
    expect((await handleSharedEventsGet(badPoll, d)).status).toBe(400);
  });

  it("answers 503 with a code, not the error text, when the database fails", async () => {
    const logged: string[] = [];
    const failing: SharedHttpDeps = {
      ...deps(),
      service: () => {
        const broken = createSharedWorldService({
          store: {
            ...createMemorySharedStateStore().store,
            migrate: async () => {
              throw new Error("connect ECONNREFUSED postgres://user:secret@db");
            },
          },
        });
        return broken;
      },
      log: (message) => logged.push(message),
    };
    const response = await handleSharedJoin(
      post("/join", { dayZeroMs: Date.now() - 60_000, stateVersion: WARD_FLOW_STORED_STATE_VERSION }),
      failing,
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "shared_state_unavailable" });
    expect(logged.join(" ")).not.toContain("secret");
  });
});
