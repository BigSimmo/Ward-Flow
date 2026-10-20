import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  hasMovedInWardFlow,
  markWardRouteReplace,
  noteWardRoute,
  resetWardRouteHistory,
  wardBackParent,
} from "@/components/ward-management/shell/ward-back";

const COORDINATOR_HOME = "/ward-flow";
const NURSE_HOME = "/ward-flow/ward/rph-adult-secure";

describe("the header's Back control (Josh, 20 Oct 2026)", () => {
  it.each([
    ["/ward-flow/people/PX-1a2b", "/ward-flow/movements"],
    ["/ward-flow/people/new", "/ward-flow/search"],
    ["/ward-flow/movements/MV-1a2b", "/ward-flow/movements"],
    ["/ward-flow/ward/rph-adult-secure/answer", "/ward-flow/ward/rph-adult-secure"],
    ["/ward-flow/referrals/new", "/ward-flow/referrals"],
    ["/ward-flow/statistics/ward/rph-adult-secure", "/ward-flow/statistics"],
    ["/ward-flow/statistics/service/east-metro", "/ward-flow/statistics"],
    ["/ward-flow/bed-meeting/agenda", "/ward-flow/capacity"],
    ["/ward-flow/reports/downtime", "/ward-flow"],
    ["/ward-flow/ward/rph-adult-secure", "/ward-flow/wards"],
    ["/ward-flow/board/rph-adult-secure", "/ward-flow/wards"],
    ["/ward-flow/ed/peel-ed", "/ward-flow/ed"],
    ["/ward-flow/community/armadale", "/ward-flow/community"],
  ])("%s is a drill-down for the coordinator and falls back to %s", (pathname, parent) => {
    expect(wardBackParent(pathname, COORDINATOR_HOME)).toBe(parent);
  });

  it.each([
    "/ward-flow",
    "/ward-flow/waiting",
    "/ward-flow/movements",
    "/ward-flow/capacity",
    "/ward-flow/wards",
    "/ward-flow/ed",
    "/ward-flow/statistics",
    "/ward-flow/statistics/overview",
    "/ward-flow/handover",
    "/ward-flow/settings",
  ])("%s is a starting point and keeps Menu", (pathname) => {
    expect(wardBackParent(pathname, COORDINATOR_HOME)).toBeUndefined();
  });

  it("keeps Menu on the desk's own place, its bed board included, but not on another ward", () => {
    expect(wardBackParent(NURSE_HOME, NURSE_HOME)).toBeUndefined();
    expect(wardBackParent("/ward-flow/board/rph-adult-secure", NURSE_HOME)).toBeUndefined();
    expect(wardBackParent("/ward-flow/ward/graylands-older-adult", NURSE_HOME)).toBe("/ward-flow/wards");
    expect(wardBackParent("/ward-flow/ed/peel-ed", "/ward-flow/ed/peel-ed")).toBeUndefined();
    expect(wardBackParent("/ward-flow/community/armadale", "/ward-flow/community/armadale")).toBeUndefined();
  });

  describe("in-app history", () => {
    beforeEach(() => resetWardRouteHistory());
    afterEach(() => vi.unstubAllGlobals());

    it("uses the history entry's place when the browser reports it, so Back never leaves from the landing page", () => {
      const navigation = { currentEntry: { index: 3 } };
      vi.stubGlobal("navigation", navigation);
      noteWardRoute("/ward-flow/people/PX-1a2b"); // landed here from another site (entry 3)
      navigation.currentEntry = { index: 4 };
      noteWardRoute("/ward-flow/movements");
      expect(hasMovedInWardFlow()).toBe(true);
      // Browser Back returns to the landing entry: nothing in Ward Flow sits behind it.
      navigation.currentEntry = { index: 3 };
      noteWardRoute("/ward-flow/people/PX-1a2b");
      expect(hasMovedInWardFlow()).toBe(false);
    });

    it("does not trust the browser history until the tab has moved between Ward Flow screens", () => {
      noteWardRoute("/ward-flow/people/PX-1a2b");
      noteWardRoute("/ward-flow/people/PX-1a2b");
      expect(hasMovedInWardFlow()).toBe(false);
      noteWardRoute("/ward-flow/movements");
      expect(hasMovedInWardFlow()).toBe(true);
    });

    it("without the Navigation API, takes a return to the screen below as a step back", () => {
      noteWardRoute("/ward-flow/people/PX-1a2b"); // landed here from another site
      noteWardRoute("/ward-flow/movements");
      noteWardRoute("/ward-flow/movements/MV-1");
      expect(hasMovedInWardFlow()).toBe(true);
      noteWardRoute("/ward-flow/movements"); // browser Back
      expect(hasMovedInWardFlow()).toBe(true);
      noteWardRoute("/ward-flow/people/PX-1a2b"); // browser Back to the landing page
      expect(hasMovedInWardFlow()).toBe(false);
      noteWardRoute("/ward-flow/movements"); // browser Forward
      expect(hasMovedInWardFlow()).toBe(true);
    });

    it("without the Navigation API, counts Back's own fallback as replacing the page, not a step forward", () => {
      noteWardRoute("/ward-flow/ward/W1/answer"); // opened from an email
      markWardRouteReplace(); // Back had no history, so it replaced this page with its parent
      noteWardRoute("/ward-flow/ward/W1");
      expect(hasMovedInWardFlow()).toBe(false);
      noteWardRoute("/ward-flow/people/PX-1a2b"); // an ordinary push still counts
      expect(hasMovedInWardFlow()).toBe(true);
    });
  });
});
