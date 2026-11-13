import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ pathname: "/ward-flow/bed-meeting" }));
vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

import { MIDLAND_DECISIONS_KEY } from "@/components/ward-management/community/team-2026/midland-decisions";
import { LAST_LOOK_STORAGE_KEY } from "@/components/ward-management/coordinator/since-last-look";
import { noteTvLockControl, TV_LOCK_STORAGE_KEY } from "@/components/ward-management/bed-meeting/tv-lock-guard";
import {
  TV_LOCK_FALLBACK_WAIT_MS,
  TvLockFallbackHost,
} from "@/components/ward-management/bed-meeting/tv-lock-fallback-host";
import { WARD_PERSONA_SYNC_EVENT } from "@/components/ward-management/settings/persona-sync";
import { readWardAccessSnapshot, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { WARD_FEATURE_FLAGS_STORAGE_KEY } from "@/components/ward-management/shell/ward-feature-flag-store";
import { MY_PATIENTS_STORAGE_KEY } from "@/components/ward-management/shell/ward-my-patients-store";
import { MY_WARDS_STORAGE_KEY } from "@/components/ward-management/shell/ward-my-wards-store";
import { selectDemoRole } from "@/components/ward-management/tools/ward-demo-role-session";
import { addCallLog, useCallLog } from "@/components/ward-management/tools/ward-tool-call-log-store";
import { addReminder, useReminders } from "@/components/ward-management/tools/ward-tool-remind-store";
import { CENSUS_BED_OPENER_TARGET } from "@/components/ward-management/ward/ward-screen-helpers";
import { resetWardDemoBrowserState, WARD_DEMO_DAY_STORAGE_KEYS } from "@/components/ward-management/ward-browser-data";
import { STATEWIDE_COORDINATOR, type WardAccess } from "@/components/ward-management/ward-role-access";
import { WARD_BED_MEETING_TV_HREF } from "@/components/ward-management/ward-nav";

/*
 * F-65 (K8, RC 5.1, RC 5.3, A12-03, A14-17, A14-24, approved by Josh 13 Nov 2026): Reset demo left the
 * demo desk, a Midland team decision, the TV lock, pins and the Home ED filter in the browser, and the
 * TV lock could trap a browser whose TV view drew no Unlock. Synthetic data only.
 */

const WARD_DESK: WardAccess = { role: "ward", scope: { kind: "ward", unitIds: ["scgh-adult-open"] } };

function deviceFlags(): Record<string, unknown> {
  return JSON.parse(window.localStorage.getItem(WARD_FEATURE_FLAGS_STORAGE_KEY) ?? "{}") as Record<string, unknown>;
}

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  nav.pathname = WARD_BED_MEETING_TV_HREF;
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe("F-65: Reset demo clears this browser's demo day", () => {
  it("lists each store's own key, so a renamed key cannot slip off the list", () => {
    for (const key of [
      MIDLAND_DECISIONS_KEY,
      TV_LOCK_STORAGE_KEY,
      MY_PATIENTS_STORAGE_KEY,
      MY_WARDS_STORAGE_KEY,
      LAST_LOOK_STORAGE_KEY,
      CENSUS_BED_OPENER_TARGET,
    ])
      expect(WARD_DEMO_DAY_STORAGE_KEYS).toContain(key);
  });

  it("clears the demo-day keys and keeps device settings and other Ward Flow keys", () => {
    window.localStorage.setItem(MIDLAND_DECISIONS_KEY, "{}");
    window.localStorage.setItem(TV_LOCK_STORAGE_KEY, `${WARD_BED_MEETING_TV_HREF}?screen=tv`);
    window.localStorage.setItem("ward-hub-pinned", "[]");
    window.localStorage.setItem(MY_PATIENTS_STORAGE_KEY, "[]");
    window.sessionStorage.setItem("ward_flow_home_ed_filter", "rph-ed");
    window.localStorage.setItem("ward-flow-rail", "open");
    window.localStorage.setItem("ward-flow-reminders", "[]");
    const heard: (string | null)[] = [];
    const listen = (event: StorageEvent) => heard.push(event.key);
    window.addEventListener("storage", listen);
    const removed = resetWardDemoBrowserState({ desk: false });
    window.removeEventListener("storage", listen);
    expect(new Set(removed)).toEqual(
      new Set([
        MIDLAND_DECISIONS_KEY,
        TV_LOCK_STORAGE_KEY,
        "ward-hub-pinned",
        MY_PATIENTS_STORAGE_KEY,
        "ward_flow_home_ed_filter",
      ]),
    );
    expect(new Set(heard)).toEqual(new Set(removed));
    expect(window.localStorage.getItem("ward-flow-rail")).toBe("open");
    expect(window.localStorage.getItem("ward-flow-reminders")).toBe("[]");
  });

  it("clears the Tools reminders and call log for the demo day (D-197 item 2)", () => {
    const dayZero = Date.UTC(2026, 10, 12, 16);
    act(() => {
      addReminder({
        kind: "ward",
        targetId: "scgh-adult-open",
        targetLabel: "Synthetic ward",
        reason: "Call back",
        dueAt: 600,
        dayZero,
      });
      addCallLog({ wardId: "scgh-adult-open", wardLabel: "Synthetic ward", outcome: "as-shown", at: 590, dayZero });
    });
    const reminders = renderHook(() => useReminders());
    const calls = renderHook(() => useCallLog());
    expect(reminders.result.current).toHaveLength(1);
    expect(calls.result.current).toHaveLength(1);
    act(() => {
      resetWardDemoBrowserState({ desk: false });
    });
    // The day 0 is the calendar day and Reset keeps it, so the day filter alone would bring them back.
    expect(reminders.result.current).toHaveLength(0);
    expect(calls.result.current).toHaveLength(0);
    expect(window.localStorage.getItem("wf-mock-tools-reminders")).toBeNull();
    expect(window.localStorage.getItem("wf-mock-tools-call-log")).toBeNull();
  });

  it("puts the tab back on the bed coordinator's desk and the role access setting back", () => {
    selectDemoRole(WARD_DESK, { desk: STATEWIDE_COORDINATOR, deviceFlag: null, persona: "coordinator" });
    expect(readWardAccessSnapshot().desk).toEqual(WARD_DESK);
    expect(deviceFlags()["role-access"]).toBe(true);
    const personas: string[] = [];
    const listen = (event: Event) => personas.push((event as CustomEvent<{ role: string }>).detail.role);
    window.addEventListener(WARD_PERSONA_SYNC_EVENT, listen);
    resetWardDemoBrowserState({ desk: true });
    window.removeEventListener(WARD_PERSONA_SYNC_EVENT, listen);
    expect(readWardAccessSnapshot().desk).toEqual(STATEWIDE_COORDINATOR);
    expect(deviceFlags()).not.toHaveProperty("role-access");
    expect(personas.at(-1)).toBe("coordinator");
  });

  it("leaves the desk alone where the shared server owns it", () => {
    setWardAccess(WARD_DESK);
    resetWardDemoBrowserState({ desk: false });
    expect(readWardAccessSnapshot().desk).toEqual(WARD_DESK);
  });

  it("Back to Bed coordinator after a reload puts the role access setting back too", async () => {
    selectDemoRole(WARD_DESK, { desk: STATEWIDE_COORDINATOR, deviceFlag: false, persona: "coordinator" });
    expect(deviceFlags()["role-access"]).toBe(true);
    // A reload loses the memory-only session.
    vi.resetModules();
    const session = await import("@/components/ward-management/tools/ward-demo-role-session");
    session.restoreDemoRoleFlagAfterReload();
    expect(deviceFlags()["role-access"]).toBe(false);
  });
});

describe("F-65: the TV lock never traps a browser", () => {
  it("offers the stand-in Unlock when the TV view draws no control of its own", async () => {
    window.localStorage.setItem(TV_LOCK_STORAGE_KEY, `${WARD_BED_MEETING_TV_HREF}?screen=tv`);
    vi.useFakeTimers();
    render(<TvLockFallbackHost />);
    expect(screen.queryByTestId("tv-lock-fallback")).toBeNull();
    act(() => vi.advanceTimersByTime(TV_LOCK_FALLBACK_WAIT_MS));
    vi.useRealTimers();
    expect(await screen.findByTestId("tv-unlock")).toHaveTextContent("Unlock");
    expect(screen.getByTestId("tv-lock-fallback")).toHaveTextContent("locked to the TV view");
  });

  it("stays out of the way while the TV view shows its own Unlock", () => {
    window.localStorage.setItem(TV_LOCK_STORAGE_KEY, `${WARD_BED_MEETING_TV_HREF}?screen=tv`);
    const gone = noteTvLockControl();
    vi.useFakeTimers();
    render(<TvLockFallbackHost />);
    act(() => vi.advanceTimersByTime(TV_LOCK_FALLBACK_WAIT_MS * 2));
    expect(screen.queryByTestId("tv-lock-fallback")).toBeNull();
    gone();
  });

  it("shows nothing on an unlocked browser", () => {
    vi.useFakeTimers();
    render(<TvLockFallbackHost />);
    act(() => vi.advanceTimersByTime(TV_LOCK_FALLBACK_WAIT_MS * 2));
    expect(screen.queryByTestId("tv-lock-fallback")).toBeNull();
  });
});
