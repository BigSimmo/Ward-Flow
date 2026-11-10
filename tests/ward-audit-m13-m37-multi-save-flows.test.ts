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

describe("M13/M37: Acknowledge visible with the middle save refused", () => {
  it("records the first and last and nothing for the middle (and, today, no audit rows)", () => {
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
    // DEFECT for Josh (M37): ACKNOWLEDGE_INBOX_ITEM writes no audit row at all (ward-audit.ts has no
    // category for it), so a bulk acknowledge leaves no per-item audit trail. Pinned here so a fix shows.
    expect(after.auditEvents.slice(auditFrom)).toEqual([]);
  });

  it.todo(
    "DEFECT M37: Acknowledge visible writes one audit row per alert (accepted, denied, accepted) — ACKNOWLEDGE_INBOX_ITEM has no audit category today",
  );
});
