import { describe, expect, it } from "vitest";

import {
  CHROME_ROLE_LABELS,
  noticeIsForWardChrome,
  noticeIsMarkableByChrome,
  wardChromeRole,
  wardTasksAreActionableForRole,
} from "../src/components/ward-management/ward-chrome-role";
import type { Notice } from "../src/components/ward-management/ward-model";
import { WARD_NAV } from "../src/components/ward-management/ward-nav";
import { orderRoleScreensForRole } from "../src/components/ward-management/ward-nav-role-order";

const officerNotice: Notice = {
  id: "notice:movement:transport_cancelled_officer:0",
  raisedAt: 120,
  to: { role: "officer" },
  about: { movementId: "WF-001" },
  kind: "transport_cancelled_officer",
  sentence: "Transport was cancelled.",
};

describe("route-derived Ward Flow chrome roles", () => {
  it("identifies the transport officer route and label", () => {
    expect(wardChromeRole("/mockups/ward-flow/transport/officer")).toBe("officer");
    expect(wardChromeRole("/mockups/ward-flow/transport/officer/")).toBe("officer");
    expect(CHROME_ROLE_LABELS.officer).toBe("Transport officer");
    expect(orderRoleScreensForRole(WARD_NAV, "officer")[0]?.id).toBe("officer");
  });

  it("keeps coordinator, ward and ED route behavior", () => {
    expect(wardChromeRole("/mockups/ward-flow")).toBe("coordinator");
    expect(wardChromeRole("/mockups/ward-flow/ward/fre-adult-open")).toBe("ward");
    expect(wardChromeRole("/mockups/ward-flow/board/fre-adult-open")).toBe("ward");
    expect(wardChromeRole("/mockups/ward-flow/ed/fre-ed")).toBe("ed");
  });
});

describe("Ward Flow notice audience", () => {
  it("shows an officer notice only on officer chrome at or after its raised time", () => {
    expect(noticeIsForWardChrome(officerNotice, "officer", undefined, 120)).toBe(true);
    expect(noticeIsForWardChrome(officerNotice, "officer", undefined, 119)).toBe(false);
    expect(noticeIsForWardChrome(officerNotice, "coordinator", undefined, 120)).toBe(false);
    expect(noticeIsForWardChrome(officerNotice, "ward", "fre-adult-open", 120)).toBe(false);
    expect(noticeIsForWardChrome(officerNotice, "ed", "fre-ed", 120)).toBe(false);
  });
});

describe("Ward Flow notice read-affordance scoping — item 48, Q2 (owner answer 48)", () => {
  it("is markable only on the same chrome that can see it, and only while unread", () => {
    expect(noticeIsMarkableByChrome(officerNotice, "officer", undefined, 120)).toBe(true);
    // Same three negatives `noticeIsForWardChrome`'s own test above pins — a notice this chrome
    // cannot even see must never read as markable either.
    expect(noticeIsMarkableByChrome(officerNotice, "officer", undefined, 119)).toBe(false);
    expect(noticeIsMarkableByChrome(officerNotice, "coordinator", undefined, 120)).toBe(false);
    expect(noticeIsMarkableByChrome(officerNotice, "ward", "fre-adult-open", 120)).toBe(false);
  });

  it("reads false once the notice is already read, even on its own chrome", () => {
    const read: Notice = { ...officerNotice, readAt: 121, readBy: "officer" };
    expect(noticeIsMarkableByChrome(read, "officer", undefined, 130)).toBe(false);
  });
});

describe("Ward Flow Tasks role boundary", () => {
  it("keeps task actions coordinator-only instead of borrowing coordinator identity", () => {
    expect(wardTasksAreActionableForRole("coordinator")).toBe(true);
    expect(wardTasksAreActionableForRole("ward")).toBe(false);
    expect(wardTasksAreActionableForRole("ed")).toBe(false);
    expect(wardTasksAreActionableForRole("officer")).toBe(false);
  });
});
