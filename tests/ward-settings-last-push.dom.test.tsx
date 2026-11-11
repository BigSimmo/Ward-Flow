import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SettingsAlertsPane } from "@/components/ward-management/settings/settings-alerts-check";
import {
  LAST_PUSH_CACHE,
  LAST_PUSH_KEY,
  lastPushLine,
  readLastPushAt,
} from "@/components/ward-management/settings/settings-last-push";
import { ToastProvider } from "@/components/wf";

/** A Cache Storage holding one record, as public/ward-flow-push-sw.js writes it. */
function storageWith(record: unknown): CacheStorage {
  return {
    match: async (key: string, options?: { cacheName?: string }) =>
      key === LAST_PUSH_KEY && options?.cacheName === LAST_PUSH_CACHE && record !== undefined
        ? new Response(JSON.stringify(record))
        : undefined,
  } as unknown as CacheStorage;
}

describe("Settings: when this device last received an alert (A8-07)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("says today, yesterday or the date, in 24-hour time", () => {
    const now = new Date(2026, 10, 10, 16, 0);
    expect(lastPushLine(new Date(2026, 10, 10, 14, 5), now)).toBe("Last alert on this device: 14:05 today.");
    expect(lastPushLine(new Date(2026, 10, 9, 9, 30), now)).toBe("Last alert on this device: 09:30 yesterday.");
    expect(lastPushLine(new Date(2026, 10, 3, 14, 5), now)).toBe("Last alert on this device: 14:05, 3 Nov.");
    expect(lastPushLine(null, now)).toBe("No alert received on this device yet.");
  });

  it("reads only a valid time, and never throws when storage is missing or broken", async () => {
    const at = "2026-11-10T06:05:00.000Z";
    expect((await readLastPushAt(storageWith({ at, kind: "act-now" })))?.toISOString()).toBe(at);
    expect(await readLastPushAt(storageWith(undefined))).toBeNull();
    expect(await readLastPushAt(storageWith({ at: "not a time" }))).toBeNull();
    expect(await readLastPushAt(storageWith({ at: 7 }))).toBeNull();
    expect(await readLastPushAt(undefined)).toBeNull();
    const broken = {
      match: async () => {
        throw new Error("SecurityError");
      },
    } as unknown as CacheStorage;
    expect(await readLastPushAt(broken)).toBeNull();
  });

  it("uses the same cache and key the service worker writes", async () => {
    const { readFileSync } = await import("node:fs");
    const worker = readFileSync("public/ward-flow-push-sw.js", "utf8");
    expect(worker).toContain(`const LAST_PUSH_CACHE = "${LAST_PUSH_CACHE}";`);
    expect(worker).toContain(`const LAST_PUSH_KEY = "${LAST_PUSH_KEY}";`);
  });

  function pane() {
    return render(
      <ToastProvider>
        <SettingsAlertsPane
          notifications={false}
          permission="default"
          phonePush="off"
          onAlertsChange={() => {}}
          buzz={false}
          onBuzzChange={() => {}}
          onTestBuzz={() => {}}
          showToast={() => {}}
        />
      </ToastProvider>,
    );
  }

  it("shows the recorded time in the alerts check card", async () => {
    const at = new Date();
    at.setSeconds(0, 0);
    vi.stubGlobal("caches", storageWith({ at: at.toISOString(), kind: "jobs" }));
    pane();
    expect(await screen.findByText(lastPushLine(at))).toHaveAttribute("data-testid", "ward-settings-last-push");
    expect(screen.getByTestId("ward-settings-last-push").textContent).toMatch(
      /^Last alert on this device: \d\d:\d\d today\.$/,
    );
  });

  it("says no alert has arrived yet when none is recorded", async () => {
    vi.stubGlobal("caches", undefined);
    pane();
    expect(screen.getByTestId("ward-settings-last-push")).toHaveTextContent("No alert received on this device yet.");
  });
});
