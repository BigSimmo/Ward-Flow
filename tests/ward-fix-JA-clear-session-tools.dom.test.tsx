import { afterEach, describe, expect, it } from "vitest";

import { resetWardDemoBrowserState } from "@/components/ward-management/ward-browser-data";

/*
 * D-197 item 2 / F-65 (journey review JR1, helper JA, 13 Nov 2026): Settings' "Clear session data" on
 * the local demo runs Reset demo's browser half. The Tools reminders and call log stores load only
 * with the Tools sheet, Alerts reminders or Leave, so on a page where neither has loaded their own
 * reset hooks are not registered. This file deliberately never imports either store: the reset must
 * still clear their saved entries, or they come back because the day 0 is kept (D-197 item 3).
 * Synthetic data only.
 */
afterEach(() => window.localStorage.clear());

describe("Reset demo's browser half before the Tools stores have loaded", () => {
  it("still clears the Tools reminders and call log", () => {
    window.localStorage.setItem("wf-mock-tools-reminders", JSON.stringify([{ id: "synthetic" }]));
    window.localStorage.setItem("wf-mock-tools-call-log", JSON.stringify([{ id: "synthetic" }]));
    window.localStorage.setItem("ward-flow-rail", "open");
    const removed = resetWardDemoBrowserState({ desk: false });
    expect(removed).toEqual(expect.arrayContaining(["wf-mock-tools-reminders", "wf-mock-tools-call-log"]));
    expect(window.localStorage.getItem("wf-mock-tools-reminders")).toBeNull();
    expect(window.localStorage.getItem("wf-mock-tools-call-log")).toBeNull();
    expect(window.localStorage.getItem("ward-flow-rail")).toBe("open");
  });
});
