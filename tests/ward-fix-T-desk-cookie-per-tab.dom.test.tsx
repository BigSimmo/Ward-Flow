import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WARD_DESK_HELD_COOKIE } from "@/components/ward-management/shell/ward-desk-early";

/*
 * F-115 (RC 5.6, Audit 7 claim 5, approved by Josh 13 Nov 2026): the desk cookie is shared by the
 * whole browser, so a ward desk tab reloaded after a coordinator tab wrote "0" was sent the
 * coordinator's page. Each tab now writes its own stored desk back when it comes to the front and as
 * it unloads. A tab with no stored desk leaves the cookie alone (D-137). Synthetic data only.
 */

const KEY = "wardflow:access-desk-v1";
const WARD_DESK = JSON.stringify({ role: "ward", scope: { kind: "ward", unitIds: ["scgh-adult-open"] } });

function deskCookie(): string | undefined {
  return document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${WARD_DESK_HELD_COOKIE}=`))
    ?.split("=")[1];
}

/** Another tab, on the coordinator's desk, writes "0". */
function otherTabWritesCoordinator() {
  document.cookie = `${WARD_DESK_HELD_COOKIE}=0;path=/ward-flow`;
}

async function loadStore() {
  vi.resetModules();
  const store = await import("@/components/ward-management/shell/ward-access-store");
  // Reading the desk loads the store, as every page's shell does.
  renderHook(() => store.useWardAccessSnapshot());
  return store;
}

beforeEach(() => {
  window.history.pushState({}, "", "/ward-flow/ward/scgh-adult-open");
  window.sessionStorage.clear();
  document.cookie = `${WARD_DESK_HELD_COOKIE}=;path=/ward-flow;max-age=0`;
});
afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
});

describe("F-115: the desk cookie follows the tab in use", () => {
  it("a ward desk tab writes its own desk back when it comes to the front and as it reloads", async () => {
    window.sessionStorage.setItem(KEY, WARD_DESK);
    await loadStore();
    otherTabWritesCoordinator();
    expect(deskCookie()).toBe("0");
    window.dispatchEvent(new Event("focus"));
    expect(deskCookie()).toBe("1");

    otherTabWritesCoordinator();
    window.dispatchEvent(new Event("pagehide"));
    expect(deskCookie()).toBe("1");
  });

  it("a tab with no stored desk leaves the cookie as it is", async () => {
    await loadStore();
    otherTabWritesCoordinator();
    window.dispatchEvent(new Event("focus"));
    expect(deskCookie()).toBe("0");
  });

  it("never writes back a desk that sign-out removed", async () => {
    window.sessionStorage.setItem(KEY, WARD_DESK);
    const store = await loadStore();
    window.sessionStorage.removeItem(KEY);
    document.cookie = `${WARD_DESK_HELD_COOKIE}=;path=/ward-flow;max-age=0`;
    store.syncStoredDeskCookie();
    expect(deskCookie()).toBeUndefined();
  });
});
