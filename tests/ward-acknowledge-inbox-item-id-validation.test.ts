import { describe, expect, it } from "vitest";

/*
 * Opus adversarial review, 2026-09-17, P2 finding 1: `case "ACKNOWLEDGE_INBOX_ITEM"`
 * (`ward-flow-reducer.ts`) used to accept ANY non-blank `inboxItemId`, storing it unchecked into
 * `state.inboxAcknowledgements`. `InboxItem.id` is `${idPrefix}${movement.id}` for every one of the
 * five `INBOX_CATEGORIES` (`ward-derivations.ts`'s `buildActionInbox`, every push site — never a
 * referral id, checked directly below), so a real id's prefix must be one of `INBOX_CATEGORIES`'s
 * own and its remainder a movement genuinely in state. This file is deliberately separate from
 * `tests/ward-inbox-events.test.ts` to avoid touching a shared file another agent may be editing in
 * the same review round (`DECLINE_REFERRAL`'s own fix round).
 */

import { buildActionInbox } from "../src/components/ward-management/ward-derivations";
import {
  INBOX_CATEGORIES,
  seedWardFlowState,
  wardFlowReducer,
} from "../src/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

const NOW = NOW_ANCHOR;

describe("ACKNOWLEDGE_INBOX_ITEM inboxItemId validation", () => {
  it("every InboxItem.id buildActionInbox actually produces is built from a movement id, never a referral id", () => {
    // The premise this whole fix depends on, checked directly rather than assumed: if a category
    // ever used a referral id instead, the fix below would wrongly refuse every real row of it.
    const state = seedWardFlowState();
    const items = buildActionInbox(state.movements, NOW, state.units);
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      const category = Object.values(INBOX_CATEGORIES).find((entry) => item.id.startsWith(entry.idPrefix));
      expect(category, `no known category prefixes real item id ${item.id}`).toBeDefined();
      const remainder = item.id.slice(category!.idPrefix.length);
      expect(remainder).toBe(item.movementId);
      expect(state.movements.some((movement) => movement.id === remainder)).toBe(true);
    }
  });

  it("refuses an inboxItemId whose prefix is not a real INBOX_CATEGORIES prefix", () => {
    const state = seedWardFlowState();
    const inboxItemId = "not-a-real-category-WF-001";
    const next = wardFlowReducer(state, {
      type: "ACKNOWLEDGE_INBOX_ITEM",
      role: "coordinator",
      now: NOW,
      inboxItemId,
    });
    expect(next.rejections.length).toBe(1);
    expect(next.rejections[0]!.reason).toContain("inboxItemId");
    expect(next.inboxAcknowledgements[inboxItemId]).toBeUndefined();
  });

  it("refuses an inboxItemId with a real prefix but a movement id that does not exist", () => {
    const state = seedWardFlowState();
    // "bed-pull-" is a real prefix (`INBOX_CATEGORIES.bed_pull_expired`); no fixture movement is
    // named "NOT-A-REAL-MOVEMENT-ID".
    const inboxItemId = "bed-pull-NOT-A-REAL-MOVEMENT-ID";
    expect(state.movements.some((movement) => `bed-pull-${movement.id}` === inboxItemId)).toBe(false);
    const next = wardFlowReducer(state, {
      type: "ACKNOWLEDGE_INBOX_ITEM",
      role: "coordinator",
      now: NOW,
      inboxItemId,
    });
    expect(next.rejections.length).toBe(1);
    expect(next.rejections[0]!.reason).toContain("inboxItemId");
    expect(next.inboxAcknowledgements[inboxItemId]).toBeUndefined();
  });

  it("still accepts every real row buildActionInbox produces, from every category", () => {
    const state = seedWardFlowState();
    const items = buildActionInbox(state.movements, NOW, state.units);
    expect(items.length).toBeGreaterThan(0);
    let next = state;
    for (const item of items) {
      next = wardFlowReducer(next, {
        type: "ACKNOWLEDGE_INBOX_ITEM",
        role: "coordinator",
        now: NOW,
        inboxItemId: item.id,
      });
    }
    expect(next.rejections).toEqual([]);
    for (const item of items) {
      expect(next.inboxAcknowledgements[item.id]).toHaveLength(1);
    }
  });
});
