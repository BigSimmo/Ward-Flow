// tests/ward-notice-read.test.ts
//
// Item 48, Q2 (owner answer 48, 2026-09-17): "A notice counts as read only when it is marked as
// read." `Notice.readAt` (`ward-model.ts`) has existed since the communication addendum landed,
// but nothing ever wrote it before `MARK_NOTICE_READ` — every notice sat unread forever, and
// `shell/ward-bar.tsx`'s Activity drawer counted every visible notice as though nobody had ever
// opened it. This file is the reducer-level proof; `tests/ward-notice-mark-read.dom.test.tsx`
// proves the control itself.
//
// Fixture notices are hand-built rather than reached by walking the reducer, the same precedent
// `tests/ward-chrome-role.test.ts` and `tests/ward-activity-count-separate.dom.test.tsx` already
// set: `MARK_NOTICE_READ` reads and rewrites `state.notices` alone, so a notice's own `about`/
// `kind` content is irrelevant to every assertion below.
import { describe, expect, it } from "vitest";

import {
  seedWardFlowState,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import type { Notice } from "../src/components/ward-management/ward-model";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

const NOW = NOW_ANCHOR;

// "fre-adult-open" and "scgh-adult-open" are real seeded unit ids (`tests/ward-notices.test.ts`'s
// own `ACCEPTED_UNIT_ID`/`DECLINED_UNIT_ID`) — not load-bearing here since `MARK_NOTICE_READ` never
// looks a unit up, but real ids keep the fixture honest rather than inventing a placeholder.
const WARD_NOTICE: Notice = {
  id: "notice:movement:transport_cancelled_ward:0",
  raisedAt: NOW - 10,
  to: { role: "ward", placeId: "fre-adult-open" },
  about: { movementId: "WF-001", unitId: "fre-adult-open" },
  kind: "transport_cancelled_ward",
  sentence: "A transport headed here was cancelled.",
};

// `officer` has no place in this model (`Addressee`'s own doc comment, `ward-model.ts`) — this
// fixture is what proves the `undefined === undefined` half of the addressee match, not only the
// `placeId` half `WARD_NOTICE` covers.
const OFFICER_NOTICE: Notice = {
  id: "notice:movement:transport_cancelled_officer:0",
  raisedAt: NOW - 10,
  to: { role: "officer" },
  about: { movementId: "WF-001" },
  kind: "transport_cancelled_officer",
  sentence: "Transport was cancelled.",
};

function withNotices(notices: Notice[]): WardFlowState {
  return { ...seedWardFlowState(), notices };
}

describe("MARK_NOTICE_READ — item 48, Q2 (owner answer 48)", () => {
  it("sets readAt and records the role when the addressee marks its own notice", () => {
    const state = withNotices([WARD_NOTICE]);
    const after = wardFlowReducer(state, {
      type: "MARK_NOTICE_READ",
      role: "ward",
      now: NOW,
      noticeId: WARD_NOTICE.id,
      actingPlaceId: "fre-adult-open",
    });
    expect(after.rejections).toEqual([]);
    const notice = after.notices.find((candidate) => candidate.id === WARD_NOTICE.id)!;
    expect(notice.readAt).toBe(NOW);
    expect(notice.readBy).toBe("ward");
    // Nothing else about the notice was touched.
    expect({ ...notice, readAt: undefined, readBy: undefined }).toEqual(WARD_NOTICE);
  });

  it("marks an officer-addressed notice (no placeId) read when the caller claims no place either", () => {
    const state = withNotices([OFFICER_NOTICE]);
    const after = wardFlowReducer(state, {
      type: "MARK_NOTICE_READ",
      role: "officer",
      now: NOW,
      noticeId: OFFICER_NOTICE.id,
    });
    expect(after.rejections).toEqual([]);
    expect(after.notices[0]!.readAt).toBe(NOW);
    expect(after.notices[0]!.readBy).toBe("officer");
  });

  it("refuses a caller whose role does not match the notice's own addressee", () => {
    const state = withNotices([WARD_NOTICE]);
    const after = wardFlowReducer(state, {
      type: "MARK_NOTICE_READ",
      role: "coordinator",
      now: NOW,
      noticeId: WARD_NOTICE.id,
      actingPlaceId: "fre-adult-open",
    });
    expect(after.rejections).toHaveLength(1);
    expect(after.notices[0]!.readAt).toBeUndefined();
  });

  it("refuses a caller whose actingPlaceId does not match the notice's own place, even with the right role", () => {
    const state = withNotices([WARD_NOTICE]);
    const after = wardFlowReducer(state, {
      type: "MARK_NOTICE_READ",
      role: "ward",
      now: NOW,
      noticeId: WARD_NOTICE.id,
      actingPlaceId: "scgh-adult-open",
    });
    expect(after.rejections).toHaveLength(1);
    expect(after.notices[0]!.readAt).toBeUndefined();
  });

  it("refuses a ward-role caller who supplies no actingPlaceId at all against a placed notice", () => {
    const state = withNotices([WARD_NOTICE]);
    const after = wardFlowReducer(state, {
      type: "MARK_NOTICE_READ",
      role: "ward",
      now: NOW,
      noticeId: WARD_NOTICE.id,
    });
    expect(after.rejections).toHaveLength(1);
    expect(after.notices[0]!.readAt).toBeUndefined();
  });

  it("refuses a second mark — not idempotent, and the first mark's readAt/readBy survive unchanged", () => {
    const state = withNotices([WARD_NOTICE]);
    const once = wardFlowReducer(state, {
      type: "MARK_NOTICE_READ",
      role: "ward",
      now: NOW,
      noticeId: WARD_NOTICE.id,
      actingPlaceId: "fre-adult-open",
    });
    expect(once.rejections).toEqual([]);
    const twice = wardFlowReducer(once, {
      type: "MARK_NOTICE_READ",
      role: "ward",
      now: NOW + 5,
      noticeId: WARD_NOTICE.id,
      actingPlaceId: "fre-adult-open",
    });
    expect(twice.rejections).toHaveLength(1);
    expect(twice.notices[0]!.readAt).toBe(NOW);
    expect(twice.notices[0]!.readBy).toBe("ward");
  });

  it("refuses an unknown notice id, and files the rejection against that id (subjectId coverage)", () => {
    const state = withNotices([]);
    const after = wardFlowReducer(state, {
      type: "MARK_NOTICE_READ",
      role: "ward",
      now: NOW,
      noticeId: "notice:does-not-exist",
      actingPlaceId: "fre-adult-open",
    });
    expect(after.rejections).toHaveLength(1);
    // `subjectId()` (`ward-flow-reducer.ts`) must name the notice id, not fall into `default` and
    // read an absent `movementId` — the same trap `ACKNOWLEDGE_INBOX_ITEM` and its siblings are
    // listed there to avoid.
    expect(after.rejections[0]!.movementId).toBe("notice:does-not-exist");
    expect(after.rejections[0]!.attempted).toBe("MARK_NOTICE_READ");
  });

  it("touches nothing else in state — only the one notice's readAt/readBy change", () => {
    const other: Notice = { ...OFFICER_NOTICE, id: "notice:other:0" };
    const state = withNotices([WARD_NOTICE, other]);
    const after = wardFlowReducer(state, {
      type: "MARK_NOTICE_READ",
      role: "ward",
      now: NOW,
      noticeId: WARD_NOTICE.id,
      actingPlaceId: "fre-adult-open",
    });
    expect(after.notices).toHaveLength(2);
    expect(after.notices.find((candidate) => candidate.id === other.id)).toEqual(other);
    expect(after.movements).toEqual(state.movements);
    expect(after.units).toEqual(state.units);
  });
});
