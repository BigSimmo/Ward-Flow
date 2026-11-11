// M13 and M37 (master audit list, 10 Nov 2026): actions that send several saves in a row. One save
// can't half-apply, but a run of them can. The flows that send several saves from one tap are:
//
//   1. Ward Decisions "Sign off N" (ward-decisions-cockpit.tsx): one CONFIRM_BED_RELEASE per row.
//   2. Tasks drawer "Acknowledge visible" (ward-tasks-drawer.tsx, tasks-acknowledge-visible.tsx):
//      one ACKNOWLEDGE_INBOX_ITEM per row.
//   3. Alerts drawer "Acknowledge visible" (pop-alerts/alerts-drawer.tsx): the same button and saves.
//   4. Coordinator Activity "Mark all read" (coordinator/activity-panel.tsx): one MARK_NOTICE_READ
//      per notice. It names no patient and changes no clinical record.
//
// This file proves the engine half: with the middle save refused, the others still apply, nothing
// is half-applied, and the audit log holds exactly one row per item with the right outcome. The
// screen half (what the person is told) is in tests/ward-audit-m13-m37-bulk-screens.dom.test.tsx.
// Synthetic data only.
import { describe, expect, it } from "vitest";

import { buildActionInbox } from "../src/components/ward-management/ward-derivations";
import type { WardFlowEvent } from "../src/components/ward-management/ward-flow-events";
import {
  seedWardFlowState,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

const NOW = NOW_ANCHOR;
const UNIT = "rph-adult-secure";

function expectedReleases(state: WardFlowState, count: number) {
  const ids = state.bedReleases
    .filter(
      (release) =>
        release.state === "expected" &&
        state.admissions.find((admission) => admission.id === release.admissionId)?.unitId === UNIT,
    )
    .map((release) => release.id)
    .slice(0, count);
  expect(ids).toHaveLength(count);
  return ids;
}

const signOff = (releaseId: string): WardFlowEvent =>
  ({ type: "CONFIRM_BED_RELEASE", role: "ward", now: NOW, releaseId, actingUnitId: UNIT }) as WardFlowEvent;

describe("M13/M37: Sign off N with the middle save refused", () => {
  it("applies the first and last, leaves the middle as it was, and audits one row per person", () => {
    const seed = seedWardFlowState();
    const [first, middle, last] = expectedReleases(seed, 3);
    // Another desk signs the middle person off first, so this desk's save for them is refused.
    const colleague = wardFlowReducer(seed, signOff(middle!));
    expect(colleague.rejections).toEqual([]);
    const middleBefore = colleague.bedReleases.find((release) => release.id === middle);

    const auditFrom = colleague.auditEvents.length;
    const rejectionsFrom = colleague.rejections.length;
    const after = [first!, middle!, last!].reduce((state, id) => wardFlowReducer(state, signOff(id)), colleague);

    const stateOf = (id: string) => after.bedReleases.find((release) => release.id === id)?.state;
    expect(stateOf(first!)).toBe("confirmed");
    expect(stateOf(last!)).toBe("confirmed");
    // The refused save changed nothing on the middle person's record.
    expect(after.bedReleases.find((release) => release.id === middle)).toEqual(middleBefore);
    expect(after.rejections.length - rejectionsFrom).toBe(1);

    const rows = after.auditEvents.slice(auditFrom);
    expect(rows.map((row) => [row.action, (row.subject as { releaseId?: string }).releaseId, row.outcome])).toEqual([
      ["CONFIRM_BED_RELEASE", first, "accepted"],
      ["CONFIRM_BED_RELEASE", middle, "denied"],
      ["CONFIRM_BED_RELEASE", last, "accepted"],
    ]);
  });
});

describe("M37: Sign off N offers Undo through the step undo", () => {
  const undo = (releaseId: string, recordSeq?: number): WardFlowEvent =>
    ({
      type: "UNDO_RELEASE_STEP",
      role: "ward",
      now: NOW,
      releaseId,
      actingUnitId: UNIT,
      ...(recordSeq === undefined ? {} : { recordSeq }),
    }) as WardFlowEvent;

  it("puts each signed-off release back exactly, one at a time", () => {
    const seed = seedWardFlowState();
    const [first, second] = expectedReleases(seed, 2);
    const signed = [first!, second!].reduce((state, id) => wardFlowReducer(state, signOff(id)), seed);
    const undone = wardFlowReducer(signed, undo(first!));
    expect(undone.rejections).toEqual(signed.rejections);
    expect(undone.bedReleases.find((release) => release.id === first)).toEqual(
      seed.bedReleases.find((release) => release.id === first),
    );
    // The other sign-off is its own record and stays signed off.
    expect(undone.bedReleases.find((release) => release.id === second)?.state).toBe("confirmed");
    const audit = undone.auditEvents.at(-1)!;
    expect([audit.action, audit.outcome, (audit.details as { undoneAction?: string }).undoneAction]).toEqual([
      "UNDO_RELEASE_STEP",
      "accepted",
      "CONFIRM_BED_RELEASE",
    ]);
  });

  it("refuses the Undo when a colleague changed the release since", () => {
    const seed = seedWardFlowState();
    const [first] = expectedReleases(seed, 1);
    const signed = wardFlowReducer(seed, signOff(first!));
    const changed = wardFlowReducer(signed, {
      type: "BLOCK_BED_RELEASE",
      role: "ward",
      now: NOW,
      releaseId: first!,
      actingUnitId: UNIT,
      blocker: "Awaiting pharmacy",
    } as WardFlowEvent);
    // A colleague on the same ward recorded a hold-up on this release after the sign-off.
    expect(changed.rejections).toEqual(signed.rejections);
    const before = changed.bedReleases.find((release) => release.id === first);
    const after = wardFlowReducer(changed, undo(first!));
    expect(after.rejections.length - changed.rejections.length).toBe(1);
    expect(after.rejections.at(-1)?.reason).toMatch(/changed since/);
    expect(after.bedReleases.find((release) => release.id === first)).toEqual(before);
  });
});

describe("M13/M37: Acknowledge visible with the middle save refused", () => {
  it("records the first and last, nothing for the middle, and audits one row per alert", () => {
    const seed = seedWardFlowState();
    const real = buildActionInbox(seed.movements, NOW, seed.units)
      .filter((item) => item.kind === "fact")
      .map((item) => item.id);
    expect(real.length).toBeGreaterThanOrEqual(2);
    // The middle row no longer names a live record (another desk closed it meanwhile).
    const ids = [real[0]!, "transport-closed-by-another-desk-synthetic", real[1]!];
    const auditFrom = seed.auditEvents.length;
    const after = ids.reduce(
      (state, inboxItemId) =>
        wardFlowReducer(state, { type: "ACKNOWLEDGE_INBOX_ITEM", role: "coordinator", now: NOW, inboxItemId }),
      seed,
    );
    expect(Object.keys(after.inboxAcknowledgements).sort()).toEqual(
      [...Object.keys(seed.inboxAcknowledgements), real[0]!, real[1]!].sort(),
    );
    expect(after.inboxAcknowledgements[ids[1]!]).toBeUndefined();
    expect(after.rejections.length - seed.rejections.length).toBe(1);
    // M37 (D-129): one audit row per alert, with its own outcome.
    const rows = after.auditEvents.slice(auditFrom);
    expect(
      rows.map((row) => [row.category, row.action, (row.details as { inboxItemId?: string }).inboxItemId, row.outcome]),
    ).toEqual([
      ["inbox", "ACKNOWLEDGE_INBOX_ITEM", ids[0], "accepted"],
      ["inbox", "ACKNOWLEDGE_INBOX_ITEM", ids[1], "denied"],
      ["inbox", "ACKNOWLEDGE_INBOX_ITEM", ids[2], "accepted"],
    ]);
  });
});
