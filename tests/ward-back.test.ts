import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  hasMovedInWardFlow,
  markWardRouteReplace,
  noteWardRoute,
  resetWardRouteHistory,
  wardBackParent,
} from "@/components/ward-management/shell/ward-back";

const COORDINATOR_HOME = "/bedchart";
const NURSE_HOME = "/bedchart/ward/rph-adult-secure";

describe("the header's Back control (Josh, 20 Oct 2026)", () => {
  it.each([
    ["/bedchart/people/PX-1a2b", "/bedchart/movements"],
    ["/bedchart/people/new", "/bedchart/search"],
    ["/bedchart/movements/MV-1a2b", "/bedchart/movements"],
    ["/bedchart/ward/rph-adult-secure/answer", "/bedchart/ward/rph-adult-secure"],
    ["/bedchart/referrals/new", "/bedchart/referrals"],
    ["/bedchart/statistics/ward/rph-adult-secure", "/bedchart/statistics"],
    ["/bedchart/statistics/service/east-metro", "/bedchart/statistics"],
    ["/bedchart/bed-meeting/agenda", "/bedchart/capacity"],
    ["/bedchart/reports/downtime", "/bedchart"],
    ["/bedchart/ward/rph-adult-secure", "/bedchart/wards"],
    ["/bedchart/board/rph-adult-secure", "/bedchart/wards"],
    ["/bedchart/ed/peel-ed", "/bedchart/ed"],
    ["/bedchart/community/armadale", "/bedchart/community"],
  ])("%s is a drill-down for the coordinator and falls back to %s", (pathname, parent) => {
    expect(wardBackParent(pathname, COORDINATOR_HOME)).toBe(parent);
  });

  it.each([
    "/bedchart",
    "/bedchart/waiting",
    "/bedchart/movements",
    "/bedchart/capacity",
    "/bedchart/wards",
    "/bedchart/ed",
    "/bedchart/statistics",
    "/bedchart/statistics/overview",
    "/bedchart/handover",
    "/bedchart/settings",
  ])("%s is a starting point and keeps Menu", (pathname) => {
    expect(wardBackParent(pathname, COORDINATOR_HOME)).toBeUndefined();
  });

  it("keeps Menu on the desk's own place, its bed board included, but not on another ward", () => {
    expect(wardBackParent(NURSE_HOME, NURSE_HOME)).toBeUndefined();
    expect(wardBackParent("/bedchart/board/rph-adult-secure", NURSE_HOME)).toBeUndefined();
    expect(wardBackParent("/bedchart/ward/graylands-older-adult", NURSE_HOME)).toBe("/bedchart/wards");
    expect(wardBackParent("/bedchart/ed/peel-ed", "/bedchart/ed/peel-ed")).toBeUndefined();
    expect(wardBackParent("/bedchart/community/armadale", "/bedchart/community/armadale")).toBeUndefined();
  });

  it.each([
    ["/bedchart/statistics/ward/rph-adult-secure", NURSE_HOME],
    ["/bedchart/statistics/ed/peel-ed", "/bedchart/ed/peel-ed"],
    ["/bedchart/statistics/community/armadale", "/bedchart/community/armadale"],
  ])("%s falls back to the own-place desk's authorised home after a reload", (pathname, home) => {
    resetWardRouteHistory();
    noteWardRoute(pathname);
    expect(hasMovedInWardFlow()).toBe(false);
    expect(wardBackParent(pathname, home)).toBe(home);
  });

  it.each([COORDINATOR_HOME, "/bedchart/capacity"])(
    "keeps the Statistics index fallback for the coordinator or site desk at %s",
    (home) => {
      expect(wardBackParent("/bedchart/statistics/ward/rph-adult-secure", home)).toBe("/bedchart/statistics");
      expect(wardBackParent("/bedchart/statistics/service/east-metro", home)).toBe("/bedchart/statistics");
    },
  );

  describe("in-app history", () => {
    beforeEach(() => resetWardRouteHistory());
    afterEach(() => vi.unstubAllGlobals());

    it("uses the history entry's place when the browser reports it, so Back never leaves from the landing page", () => {
      const navigation = { currentEntry: { index: 3 } };
      vi.stubGlobal("navigation", navigation);
      noteWardRoute("/bedchart/people/PX-1a2b"); // landed here from another site (entry 3)
      navigation.currentEntry = { index: 4 };
      noteWardRoute("/bedchart/movements");
      expect(hasMovedInWardFlow()).toBe(true);
      // Browser Back returns to the landing entry: nothing in Ward Flow sits behind it.
      navigation.currentEntry = { index: 3 };
      noteWardRoute("/bedchart/people/PX-1a2b");
      expect(hasMovedInWardFlow()).toBe(false);
    });

    it("does not trust the browser history until the tab has moved between Ward Flow screens", () => {
      noteWardRoute("/bedchart/people/PX-1a2b");
      noteWardRoute("/bedchart/people/PX-1a2b");
      expect(hasMovedInWardFlow()).toBe(false);
      noteWardRoute("/bedchart/movements");
      expect(hasMovedInWardFlow()).toBe(true);
    });

    it("without the Navigation API, takes a return to the screen below as a step back", () => {
      noteWardRoute("/bedchart/people/PX-1a2b"); // landed here from another site
      noteWardRoute("/bedchart/movements");
      noteWardRoute("/bedchart/movements/MV-1");
      expect(hasMovedInWardFlow()).toBe(true);
      noteWardRoute("/bedchart/movements"); // browser Back
      expect(hasMovedInWardFlow()).toBe(true);
      noteWardRoute("/bedchart/people/PX-1a2b"); // browser Back to the landing page
      expect(hasMovedInWardFlow()).toBe(false);
      noteWardRoute("/bedchart/movements"); // browser Forward
      expect(hasMovedInWardFlow()).toBe(true);
    });

    it("without the Navigation API, counts Back's own fallback as replacing the page, not a step forward", () => {
      noteWardRoute("/bedchart/ward/W1/answer"); // opened from an email
      markWardRouteReplace(); // Back had no history, so it replaced this page with its parent
      noteWardRoute("/bedchart/ward/W1");
      expect(hasMovedInWardFlow()).toBe(false);
      noteWardRoute("/bedchart/people/PX-1a2b"); // an ordinary push still counts
      expect(hasMovedInWardFlow()).toBe(true);
    });
  });
});
