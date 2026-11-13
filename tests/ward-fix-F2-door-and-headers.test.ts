import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import loadNextConfig from "../next.config";
import { doorPoints, IDLE_MINUTES, SESSION_HOURS } from "@/components/ward-management/front-door/front-door-parts";
import { DEMO_PASS_HOURS } from "@/lib/front-door-pass";
import { proxy } from "../src/proxy";

/**
 * Audit 15 (Josh, 13 Nov 2026).
 * A15-03: the install screenshots, app images and manifest skip the front door, so they carry noindex.
 * A15-21: no old address answers before the door: next.config.ts has no `redirects()`, and the proxy
 * checks the door before its own old-address list.
 */

function requestFor(path: string): NextRequest {
  return new NextRequest(new URL(`https://ward.example.test${path}`));
}

describe("A15-03 noindex on the files that skip the door", () => {
  it("tells crawlers to stay away from screenshots, app images and the manifest", async () => {
    const rules = (await (await loadNextConfig()).headers?.()) ?? [];
    for (const source of ["/screenshots/:path*", "/icons/:path*", "/manifest.webmanifest"]) {
      const rule = rules.find((entry) => entry.source === source);
      expect(rule?.headers, source).toContainEqual({ key: "X-Robots-Tag", value: "noindex, nofollow" });
    }
  });
});

describe("A15-21 the door answers before old addresses", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("has no next.config redirects, which Next would run before the proxy", async () => {
    const config = await loadNextConfig();
    expect(config.redirects).toBeUndefined();
  });

  it("still forwards the old addresses when the door is off", async () => {
    for (const [path, target] of [
      ["/ward-flow/transport", "/ward-flow/transport/officer"],
      ["/ward-flow/patients", "/ward-flow/search"],
    ]) {
      const response = await proxy(requestFor(`${path}?site=rph`));
      expect(response.status, path).toBe(307);
      const location = new URL(response.headers.get("location")!);
      expect(location.pathname, path).toBe(target);
      expect(location.search, path).toBe("?site=rph");
      expect(response.headers.get("content-security-policy"), path).toBeTruthy();
    }
  });

  it("sends a visitor with no pass to sign-in, not to the old address's target", async () => {
    vi.stubEnv("WARD_FRONT_DOOR", "required");
    vi.stubEnv("WARD_PASS_SECRET", "synthetic-front-door-secret-0123456789abcdef"); // gitleaks:allow
    for (const path of ["/ward-flow/transport", "/ward-flow/queue", "/ward-flow/patients"]) {
      const response = await proxy(requestFor(path));
      const location = new URL(response.headers.get("location")!);
      expect(location.pathname, path).toBe("/sign-in");
      expect(location.searchParams.get("next"), path).toBe(path);
    }
    // A moved /mockups address meets the door at its new address, so sign-in still returns there.
    const moved = await proxy(requestFor("/mockups/ward-flow/capacity"));
    const location = new URL(moved.headers.get("location")!);
    expect(location.pathname).toBe("/sign-in");
    expect(location.searchParams.get("next")).toBe("/ward-flow/capacity");
  });
});

describe("A15-04 the demo-code door describes the demo", () => {
  it("says any desk can be picked, the screen covers when idle and the code's real life", () => {
    const demo = doorPoints(true);
    expect(demo.role.body).toBe("Pick any desk to see its view.");
    expect(demo.lock.body).toBe(
      `Covers the screen after ${IDLE_MINUTES} minutes without use. A code lasts ${DEMO_PASS_HOURS} hours.`,
    );
    expect(JSON.stringify(demo)).not.toMatch(/your role|fresh sign-in/iu);
    expect(JSON.stringify(demo)).not.toContain(`${SESSION_HOURS} hours`);
  });

  it("keeps the signed-in door's role and sign-in wording, values read from their constants", () => {
    const account = doorPoints(false);
    expect(account.role.title).toBe("Your role, your view");
    expect(account.lock.body).toContain(`${IDLE_MINUTES} minutes without use`);
    expect(account.lock.body).toContain(`every ${SESSION_HOURS} hours`);
  });
});
