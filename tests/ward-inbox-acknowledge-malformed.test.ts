import { describe, expect, it } from "vitest";

import "@/components/ward-management/ward-flow-reducer-slices";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

// Performance audit WF-50 (11 November 2026): an ACKNOWLEDGE_INBOX_ITEM with no inbox row id threw a
// TypeError out of the reducer instead of being refused like any other bad event. It is now refused
// with the existing blank-row reason. Synthetic seed data only.

describe("ACKNOWLEDGE_INBOX_ITEM with a malformed row id", () => {
  it.each([undefined, null, 7])("is refused, not thrown, when inboxItemId is %j", (inboxItemId) => {
    const state = seedWardFlowState();
    const event = { type: "ACKNOWLEDGE_INBOX_ITEM", role: "coordinator", now: NOW_ANCHOR, inboxItemId };
    let next: ReturnType<typeof wardFlowReducer> | undefined;
    expect(() => {
      next = wardFlowReducer(state, event as unknown as WardFlowEvent);
    }).not.toThrow();
    expect(next!.inboxAcknowledgements).toEqual(state.inboxAcknowledgements);
    expect(next!.rejections.length).toBe(state.rejections.length + 1);
    expect(JSON.stringify(next!.rejections.at(-1))).toContain("a blank names nothing");
  });
});

describe("every inbox row event with no row id", () => {
  it.each([
    "COMPLETE_INBOX_ITEM",
    "REOPEN_INBOX_ITEM",
    "TAKE_INBOX_ITEM_OWNERSHIP",
    "RELEASE_INBOX_ITEM_OWNERSHIP",
    "SNOOZE_INBOX_ITEM",
    "UNSNOOZE_INBOX_ITEM",
  ])("refuses %s instead of throwing", (type) => {
    const state = seedWardFlowState();
    const event = { type, role: "coordinator", now: NOW_ANCHOR, reason: "other", until: NOW_ANCHOR + 60 };
    let next: ReturnType<typeof wardFlowReducer> | undefined;
    expect(() => {
      next = wardFlowReducer(state, event as unknown as WardFlowEvent);
    }).not.toThrow();
    expect(next!.rejections.length).toBe(state.rejections.length + 1);
  });
});
