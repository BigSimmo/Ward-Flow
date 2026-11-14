import { describe, expect, it } from "vitest";
import {
  seedWardFlowStateAt,
  wardFlowReducer,
  type WardFlowState,
} from "@/components/ward-management/ward-flow-reducer";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { nextStep } from "@/components/ward-management/legal-forms/legal-forms-next-step";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * OCP and Mental Health Act gap list (Josh, 4 Nov 2026, "Yes to all recommendations"). Synthetic
 * seed only. Every value here is typed or chosen by a person; nothing is worked out from the Act.
 */
const now = NOW_ANCHOR;
const run = (s: WardFlowState, e: WardFlowEvent) => {
  const next = wardFlowReducer(s, e);
  return { next, refused: next.rejections.slice(s.rejections.length) };
};
const movementOf = (s: WardFlowState, id: string) => s.movements.find((m) => m.id === id)!;

/** An open ED movement with a 1A recorded and its time written, not yet received. */
function onForm(code = "1A") {
  const seed = seedWardFlowStateAt(0);
  const target = seed.movements.find((m) => !m.closure && m.originEdId !== undefined)!;
  const { next, refused } = run(seed, {
    type: "RECORD_LEGAL_FORM_WRITTEN",
    role: "ed",
    now,
    movementId: target.id,
    formCode: code,
    writtenAt: now - 120,
  });
  expect(refused).toEqual([]);
  return { state: next, id: target.id };
}

describe("item 1, received time typed from the paper", () => {
  it("keeps a typed time as typed, and marks it typed", () => {
    const { state, id } = onForm();
    const { next, refused } = run(state, {
      type: "RECORD_LEGAL_FORM_RECEIVED",
      role: "ed",
      now,
      movementId: id,
      receivedAt: now - 30,
    });
    expect(refused).toEqual([]);
    expect(movementOf(next, id).legalFormReceivedAt).toBe(now - 30);
    expect(movementOf(next, id).legalFormReceivedTyped).toBe(true);
  });

  it("marks now when no time is typed, and refuses a time later than now", () => {
    const { state, id } = onForm();
    const marked = run(state, { type: "RECORD_LEGAL_FORM_RECEIVED", role: "ed", now, movementId: id });
    expect(movementOf(marked.next, id).legalFormReceivedAt).toBe(now);
    expect(movementOf(marked.next, id).legalFormReceivedTyped).toBeUndefined();
    const late = run(state, {
      type: "RECORD_LEGAL_FORM_RECEIVED",
      role: "ed",
      now,
      movementId: id,
      receivedAt: now + 5,
    });
    expect(late.refused).toHaveLength(1);
  });
});

describe("item 2, more forms recorded from the paper", () => {
  it.each(["3C", "3E", "6C", "6D"])("records Form %s", (code) => {
    const { state, id } = onForm(code);
    expect(movementOf(state, id).legalForm?.code).toBe(code);
    expect(movementOf(state, id).legalForm?.dueAt).toBeUndefined();
  });
});

describe("items 3 to 7, details from the paper", () => {
  const details = (id: string, extra: Partial<Extract<WardFlowEvent, { type: "RECORD_LEGAL_FORM_DETAILS" }>>) =>
    ({
      type: "RECORD_LEGAL_FORM_DETAILS",
      role: "ed",
      now,
      movementId: id,
      formCode: "1A",
      ...extra,
    }) as WardFlowEvent;

  it("records a role, a copy, a review date and an ending, and a null clears one", () => {
    const { state, id } = onForm();
    const first = run(
      state,
      details(id, { madeBy: "psychiatrist", copyGiven: "yes", reviewBy: now + 1440, endedBy: "revoked" }),
    );
    expect(first.refused).toEqual([]);
    expect(movementOf(first.next, id).legalForm).toMatchObject({
      madeBy: "psychiatrist",
      copyGiven: "yes",
      reviewBy: now + 1440,
      endedBy: "revoked",
    });
    const cleared = run(first.next, details(id, { endedBy: null }));
    expect(movementOf(cleared.next, id).legalForm?.endedBy).toBeUndefined();
    // Omitted fields are kept.
    expect(movementOf(cleared.next, id).legalForm?.madeBy).toBe("psychiatrist");
  });

  it("refuses a stale form code, an off-list choice and 6B consent on another form", () => {
    const { state, id } = onForm();
    expect(run(state, details(id, { formCode: "3A", madeBy: "psychiatrist" })).refused).toHaveLength(1);
    expect(run(state, details(id, { madeBy: "surgeon" as never })).refused).toHaveLength(1);
    expect(run(state, details(id, { consent: "yes" })).refused).toHaveLength(1);
  });

  it("records 6B consent on a Form 6B", () => {
    const { state, id } = onForm("6B");
    const { next, refused } = run(state, details(id, { formCode: "6B", consent: "not_yet" }));
    expect(refused).toEqual([]);
    expect(movementOf(next, id).legalForm?.consent).toBe("not_yet");
  });

  it("keeps the details when the same form's written time is changed", () => {
    const { state, id } = onForm();
    const { next } = run(state, details(id, { madeBy: "amhp", copyGiven: "declined" }));
    const edited = run(next, {
      type: "RECORD_LEGAL_FORM_WRITTEN",
      role: "ed",
      now,
      movementId: id,
      formCode: "1A",
      writtenAt: now - 90,
    });
    expect(edited.refused).toEqual([]);
    expect(movementOf(edited.next, id).legalForm).toMatchObject({ madeBy: "amhp", copyGiven: "declined" });
  });

  it("asks for nothing more once a person records the form as ended", () => {
    const { state, id } = onForm();
    const { next } = run(state, details(id, { endedBy: "revoked" }));
    expect(nextStep(movementOf(next, id), now)).toMatchObject({ action: "none", title: "Form ended, as recorded" });
  });
});

describe("item 9, follow-up after a finished seclusion", () => {
  /** A seclusion started and ended on a ward with an occupied bed, as the coordinator. */
  function finishedEpisode() {
    const seed = seedWardFlowStateAt(0);
    const stay = seed.admissions.find((admission) => admission.state === "occupied")!;
    const started = run(seed, {
      type: "RECORD_RESTRICTIVE_PRACTICE_START",
      role: "coordinator",
      now,
      unitId: stay.unitId,
      admissionId: stay.id,
      practice: "seclusion",
      startedAt: now - 60,
    });
    expect(started.refused).toEqual([]);
    const unit = started.next.units.find((candidate) => candidate.id === stay.unitId)!;
    const episodeId = unit.restrictivePractice!.episodes.at(-1)!.id;
    return { state: started.next, unitId: stay.unitId, episodeId };
  }
  const mark = (unitId: string, episodeId: string, done: boolean) =>
    ({
      type: "RECORD_RESTRICTIVE_PRACTICE_FOLLOW_UP",
      role: "coordinator",
      now,
      unitId,
      episodeId,
      task: "patient_debrief",
      done,
    }) as WardFlowEvent;
  const episodeOf = (s: WardFlowState, unitId: string, episodeId: string) =>
    s.units.find((u) => u.id === unitId)!.restrictivePractice!.episodes.find((e) => e.id === episodeId)!;

  it("refuses a mark before the episode has ended", () => {
    const { state, unitId, episodeId } = finishedEpisode();
    expect(run(state, mark(unitId, episodeId, true)).refused).toHaveLength(1);
  });

  it("marks done, then not yet, once the episode has ended", () => {
    const { state, unitId, episodeId } = finishedEpisode();
    const ended = run(state, {
      type: "RECORD_RESTRICTIVE_PRACTICE_END",
      role: "coordinator",
      now,
      unitId,
      episodeId,
      endedAt: now - 10,
    });
    expect(ended.refused).toEqual([]);
    const done = run(ended.next, mark(unitId, episodeId, true));
    expect(done.refused).toEqual([]);
    expect(episodeOf(done.next, unitId, episodeId).followUp).toEqual({ patient_debrief: true });
    const undone = run(done.next, mark(unitId, episodeId, false));
    expect(episodeOf(undone.next, unitId, episodeId).followUp?.patient_debrief).toBeUndefined();
  });
});

describe("review fixes on #1398", () => {
  it("drops the current expiry of a form a person recorded as ended", async () => {
    const { currentLegalDueAt } = await import("@/components/ward-management/legal-forms/legal-form-progression");
    const { state, id } = onForm();
    const typed = run(state, {
      type: "RECORD_LEGAL_FORM_EXPIRY",
      role: "ed",
      now,
      movementId: id,
      dueAt: now + 600,
    } as WardFlowEvent);
    expect(currentLegalDueAt(movementOf(typed.next, id))).toBe(now + 600);
    const ended = run(typed.next, {
      type: "RECORD_LEGAL_FORM_DETAILS",
      role: "ed",
      now,
      movementId: id,
      formCode: "1A",
      endedBy: "revoked",
    } as WardFlowEvent);
    expect(ended.refused).toEqual([]);
    expect(currentLegalDueAt(movementOf(ended.next, id))).toBeUndefined();
    // The typed expiry stays on the record as history.
    expect(movementOf(ended.next, id).legalForm?.dueAt).toBe(now + 600);
  });

  it("reads a typed receipt time the same way for the panel and the phone's pinned action", async () => {
    const { typedReceipt } = await import("@/components/ward-management/legal-forms/legal-forms-panel");
    expect(typedReceipt("", now)).toEqual({ at: null });
    expect(typedReceipt("nonsense", now).problem).toBeDefined();
  });
});
