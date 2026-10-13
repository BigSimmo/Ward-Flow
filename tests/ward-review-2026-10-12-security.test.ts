/**
 * Regression tests for the security-plumbing findings (A4-1 to A4-15) of the 8 October 2026
 * review (`docs/ward-flow/audit-2026-10-08-issue-list.md`). Backend server-side refusals (A4-3,
 * A4-8) are covered in `backend/ward-flow/backend.test.mjs` and `shared-http.test.mjs`.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { checkSyntheticPayload } from "@/lib/synthetic-data-guard";
import { checkSyntheticPayload as backendScan } from "../backend/ward-flow/synthetic-scan.mjs";
import { seedWardFlowState, seedWardFlowStateAt } from "@/components/ward-management/ward-flow-reducer";
import { WARD_SCENARIOS, activateScenarioNetwork } from "@/components/ward-management/ward-scenarios";
import {
  SharedWorkspaceClient,
  type SharedSnapshot,
  type SharedView,
} from "@/components/ward-management/ward-shared-client";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { saveCloudScenario } from "@/components/ward-management/cloud-scenario-vault";
import { WARD_FLOW_STORED_STATE_VERSION } from "@/components/ward-management/ward-flow-storage-validation";
import { formatLogLine, redactLogContext } from "@/lib/logger";
import { redactCaptionIdentifiers, redactLogValue } from "@/lib/privacy";
import { apiMutationCsrfVerdict, isCsrfGuardedApiRequest } from "@/lib/api-csrf";
import { localProjectRequestIdentityPayload } from "@/lib/local-project-guard";
import { config as proxyConfig, proxy } from "../src/proxy";
import { GET as digestGet } from "../src/app/mockups/ward-flow-digest/route";

const read = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("A4-1: the synthetic-data guard detects real Australian identifier formats", () => {
  it.each([
    ["dotted Medicare", "Card 2123.45678.1"],
    ["non-breaking-space Medicare", "Card 2123 45678 1"],
    ["narrow no-break space Medicare", "Card 2123 45678 1"],
    ["11-digit Medicare with IRN", "Card 2123 45678 1 2"],
    ["plain IHI", "IHI 8003601234567890"],
    ["grouped IHI", "8003 6012 3456 7890"],
    ["hyphenated UMRN", "UMRN-1234567"],
    ["UR No.", "UR No. 1234567"],
    ["UR Number", "UR Number: 1234567"],
    ["dotted mobile", "Call 0412.345.678"],
    ["+61 mobile", "Call +61 412 345 678"],
    ["Sydney landline", "Ring (02) 9123 4567"],
    ["+61 landline", "Ring +61 8 9123 4567"],
  ])("flags %s", (_label, text) => {
    expect(checkSyntheticPayload({ notes: text }).safe).toBe(false);
  });

  it("flags a bare all-digit record number stored under its own field", () => {
    expect(checkSyntheticPayload({ type: "ADD_PATIENT", umrn: "1234567" }).safe).toBe(false);
    expect(checkSyntheticPayload({ medicareNumber: "2123456781" }).safe).toBe(false);
  });

  it("never flags the app's own synthetic identifiers or ordinary values", () => {
    expect(
      checkSyntheticPayload({
        patients: [
          { id: "PT-DN-0001", umrn: "UM100001" },
          { id: "SYN-0042", umrn: "UM700123" },
          { umrn: "UMRN not recorded" },
        ],
        reason: "ADD_PATIENT UMRN collision: UM100001 already belongs to patient PT-DN-0001",
        measurement: 3456.789012,
        timestamp: 1_791_331_200_000,
        thirtyDaysMs: 2_592_000_000,
      }).safe,
    ).toBe(true);
  });

  it("passes every seeded scenario state, as the backend will see it", () => {
    for (const scenario of WARD_SCENARIOS) {
      activateScenarioNetwork(scenario);
      for (const state of [seedWardFlowState(scenario), seedWardFlowStateAt(5000, scenario)]) {
        const payload = JSON.parse(JSON.stringify({ version: 5, state }));
        expect(checkSyntheticPayload(payload), scenario).toEqual({ safe: true });
      }
    }
    activateScenarioNetwork("standard");
  });

  it("the browser guard is the backend scan, not a copy that can drift", () => {
    expect(checkSyntheticPayload).toBe(backendScan);
  });
});

describe("A4-2: the guard scans numeric values", () => {
  it("flags identifiers stored as JSON numbers", () => {
    // 2953457091 carries a valid Medicare check digit.
    expect(checkSyntheticPayload({ medicare: 2953457091 }).safe).toBe(false);
    expect(checkSyntheticPayload({ card: 2953457091 }).safe).toBe(false);
    expect(checkSyntheticPayload({ ihi: 8003601234567890 }).safe).toBe(false);
    expect(checkSyntheticPayload([61412345678]).safe).toBe(false);
  });
});

describe("A4-4: the guard runs on the live save paths", () => {
  const state = JSON.parse(JSON.stringify(seedWardFlowStateAt(0))) as SharedSnapshot["payload"]["state"];
  const snapshot: SharedSnapshot = {
    dataMode: "prototype",
    revision: 1,
    now: 642,
    payload: { version: 1, state, dayZero: "2026-10-07T00:00:00Z", startedAt: "2026-10-07T10:00:00Z" },
  };

  it("the shared workspace client never sends a command carrying a real identifier", async () => {
    const posted: unknown[] = [];
    let view: SharedView | undefined;
    const client = new SharedWorkspaceClient({
      baseUrl: "https://example.test",
      token: async () => "test",
      changed: (next) => {
        view = next;
      },
      fetch: async (_url, options) => {
        if (options?.body) posted.push(options.body);
        return Response.json({ snapshot });
      },
    });
    await client.refresh();
    client.dispatch({
      type: "ADD_PATIENT",
      role: "coordinator",
      now: 642,
      umrn: "UMRN-1234567",
      givenName: "Test",
      familyName: "Person",
      dateOfBirth: "1990-01-01",
    } as unknown as WardFlowEvent);
    await vi.waitFor(() => expect(view?.error).toMatch(/real identifier/));
    expect(posted).toEqual([]);
    expect(view?.status).toBe("ready");
    client.dispose();
  });

  afterEach(() => vi.unstubAllGlobals());

  it("the cloud vault reports the backend's server-side refusal as an unsafe payload", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ error: "refused" }, { status: 422 })),
    );
    const result = await saveCloudScenario(
      "https://example.com/api",
      "token",
      "11111111-1111-4111-8111-111111111111",
      0,
      // A real stored world with the typed-text lock off, so only the backend's 422 can refuse it
      // (the vault's own world and lock checks are A2-9's, covered in ward-cloud-scenario-vault).
      JSON.parse(JSON.stringify({ version: WARD_FLOW_STORED_STATE_VERSION, state: seedWardFlowState() })),
      { typedTextSeen: false },
    );
    expect(result.status).toBe("unsafe_payload");
  });

  it("the backend scan is wired into the session save and shared command routes", () => {
    expect(read("backend/ward-flow/server.mjs")).toContain("checkSyntheticPayload(body.payload)");
    expect(read("backend/ward-flow/shared-http.mjs")).toContain("checkSyntheticPayload(body.event)");
    const packaged = read("backend/ward-flow/package-deployment.mjs");
    expect(packaged).toContain('"synthetic-scan.mjs"');
    expect(packaged).toContain('"session-quota.mjs"');
  });
});

describe("A4-5: mockup comments match the owner's decision that Ward Flow has no access gate", () => {
  it("no comment claims a DeveloperAreaGate still guards the mockup routes", () => {
    for (const file of ["src/proxy.ts", "src/app/mockups/layout.tsx", "src/lib/developer-area/headers.ts"]) {
      const source = read(file);
      expect(source, file).not.toMatch(/signed-in-administrator gate \(`DeveloperAreaGate`/);
      expect(source, file).not.toMatch(/spoof (?:its )?way past `DeveloperAreaGate`/);
      expect(source, file).toMatch(/28 September 2026/);
    }
  });
});

describe("A4-6: only real static assets skip the proxy", () => {
  const pageMatcher = new RegExp(`^${proxyConfig.matcher[1]}$`);
  it("runs the proxy for page routes ending in an image extension", () => {
    expect(pageMatcher.test("/mockups/ward-flow/board.png")).toBe(true);
    expect(pageMatcher.test("/mockups/ward-flow/people/logo.svg")).toBe(true);
    expect(pageMatcher.test("/report.jpg")).toBe(true);
  });
  it("still skips Next's build output and the root icons", () => {
    expect(pageMatcher.test("/_next/static/chunks/main.js")).toBe(false);
    expect(pageMatcher.test("/_next/image")).toBe(false);
    expect(pageMatcher.test("/favicon.ico")).toBe(false);
    expect(pageMatcher.test("/icon.svg")).toBe(false);
    expect(pageMatcher.test("/api/health")).toBe(false);
  });
  it("strips a spoofed trust header on such a route", async () => {
    const request = new NextRequest(new URL("http://localhost/documents/x.png"));
    request.headers.set("x-developer-area", "1");
    const response = await proxy(request);
    expect(response.headers.get("content-security-policy")).toBeTruthy();
    expect(response.headers.get("x-middleware-request-x-developer-area")).toBeNull();
  });
});

describe("A4-7: root public/*.html mockups", () => {
  it("are sent with a noindex header", () => {
    const config = read("next.config.ts");
    expect(config).toMatch(
      /source: "\/:file\(\[\^\/\]\+\\\\\.html\)",\s*headers: \[\{ key: "X-Robots-Tag", value: "noindex, nofollow" \}\]/,
    );
  });
  it("load no unpinned third-party script", () => {
    for (const file of [
      "public/mockup.html",
      "public/capacity-table-mockup.html",
      "public/referral-board-mockup.html",
    ]) {
      const html = read(file);
      expect(html, file).not.toContain("gstatic.com/antigravity");
      for (const [, src] of html.matchAll(/<script[^>]*\bsrc="(https?:[^"]+)"/g)) {
        expect(src, file).toMatch(/\d+\.\d+\.\d+/);
      }
    }
  });
});

describe("A4-9 and A4-11: logger", () => {
  it("redacts Ward Flow identifiers and identity fields", () => {
    const out = redactLogContext({
      umrn: "UM100001",
      givenName: "Jane",
      familyName: "Citizen",
      notes: "Feeling unsafe at home",
      medicareNumber: "2123 45678 1",
      detail: "Patient UM100001 moved",
      card: "Card 2123 45678 1",
      ihiText: "8003 6012 3456 7890",
      reason: "UR No. 1234567",
      status: 200,
      name: "TypeError",
    });
    for (const key of [
      "umrn",
      "givenName",
      "familyName",
      "notes",
      "medicareNumber",
      "detail",
      "card",
      "ihiText",
      "reason",
    ])
      expect(out[key], key).toBe("[redacted]");
    expect(out.status).toBe(200);
    expect(out.name).toBe("TypeError");
  });
  it("a context key cannot overwrite level, message or timestamp", () => {
    const line = JSON.parse(
      formatLogLine(
        "error",
        "ward.request_failed",
        { level: "debug", message: "forged", timestamp: "x", id: 1 },
        new Date(0),
      ),
    );
    expect(line).toEqual({
      level: "error",
      message: "ward.request_failed",
      timestamp: "1970-01-01T00:00:00.000Z",
      id: 1,
    });
  });
});

describe("A4-10: Copy diagnostics redacts names, UMRNs and Medicare numbers", () => {
  it("redacts identity from an error message", () => {
    const text = String(
      redactLogValue("Patient Jane Citizen (UMRN UM100001, Medicare 2123 45678 1, UR No. 1234567) failed"),
    );
    expect(text).not.toMatch(/Jane|Citizen|UM100001|2123|45678|1234567/);
    expect(text).toContain("failed");
  });
  it("is what the error boundaries' Copy diagnostics button uses", () => {
    expect(read("src/lib/use-copy-diagnostics.ts")).toContain("redactLogValue(error.message)");
  });
});

describe("A4-12 and A4-15: API CSRF guard", () => {
  it("refuses a header-less mutation", () => {
    expect(apiMutationCsrfVerdict(new Headers(), "localhost")).toEqual({
      allowed: false,
      reason: "missing_browser_headers",
    });
    expect(apiMutationCsrfVerdict(new Headers({ origin: "http://localhost" }), "localhost").allowed).toBe(true);
  });
  it("guards bare /api and /api/webhooks/** like every other API path", () => {
    expect(isCsrfGuardedApiRequest("POST", "/api")).toBe(true);
    expect(isCsrfGuardedApiRequest("POST", "/api/webhooks/anything")).toBe(true);
    expect(isCsrfGuardedApiRequest("GET", "/api")).toBe(false);
  });
  it("blocks a header-less POST to bare /api through the proxy", async () => {
    const response = await proxy(new NextRequest(new URL("http://localhost/api"), { method: "POST" }));
    expect(response.status).toBe(403);
  });
  it("caption redaction uses Ward Flow identifier patterns, not NHS ones", () => {
    const text = redactCaptionIdentifiers(
      "UMRN UM100001; UR No. 1234567; Medicare 2123 45678 1; IHI 8003 6012 3456 7890",
    );
    expect(text).not.toMatch(/UM100001|1234567|2123|8003/);
    expect(read("src/lib/privacy.ts")).not.toMatch(/mrn\|nhs/);
  });
});

describe("A4-13: local server exposure", () => {
  it("a non-loopback Host header cannot loosen the local port rule", () => {
    const payload = localProjectRequestIdentityPayload(
      new Request("http://127.0.0.1:3000/api/local-project-id", { headers: { host: "rebind.example" } }),
    );
    expect(payload.localServer.safeLocalOrigin).toBe(false);
    expect(payload.localServer.currentPort).toBe(3000);
  });
  it("the dev server binds to loopback unless WARD_FLOW_DEV_HOST opts in", () => {
    const script = read("scripts/dev-free-port.mjs");
    expect(script).toContain('process.env.WARD_FLOW_DEV_HOST?.trim() || "127.0.0.1"');
    expect(script).not.toMatch(/"--hostname",\s*"0\.0\.0\.0"/);
  });
});

describe("A4-14: the digest route checks production itself", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("answers 404 in production without relying on the proxy", async () => {
    vi.stubEnv("NODE_ENV", "production");
    expect((await digestGet()).status).toBe(404);
  });
  it("still serves the design reference outside production", async () => {
    vi.stubEnv("NODE_ENV", "test");
    const response = await digestGet();
    expect(response.status).toBe(200);
  });
});
