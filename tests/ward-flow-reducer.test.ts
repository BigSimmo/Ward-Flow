import { describe, expect, it } from "vitest";

import { releaseBand } from "../src/components/ward-management/ward-bed-availability";
import {
  CANCEL_TRANSPORT_REASONS,
  GENDER_PLACEMENT_REASONS,
  OVERRIDE_REASONS,
  RELEASE_PULL_REASONS,
} from "../src/components/ward-management/ward-change-reasons";
import { unitCapacity } from "../src/components/ward-management/ward-derivations";
import type { WardFlowEvent } from "../src/components/ward-management/ward-flow-events";
import { seedWardFlowState, wardFlowReducer } from "../src/components/ward-management/ward-flow-reducer";
import { SELECTABLE_LEGAL_FORMS } from "../src/components/ward-management/ward-legal-forms";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

const NOW = NOW_ANCHOR;

function seeded() {
  const state = seedWardFlowState();
  // T11 (item 8, owner answer 17 September 2026): gender must be recorded before a referral can
  // reach a single-gender ward. `fsh-adult-secure`, referred to throughout this file, is the
  // network's Male-only bed (ward-sites.ts); the seed's WF-009 carries `sex: "Male"` but no
  // `gender`. Patched here, locally, rather than in the shared seed (dozens of other files also
  // read it) — no test in this file asserts on WF-009's gender being unset.
  return {
    ...state,
    movements: state.movements.map((candidate) =>
      candidate.id === "WF-009" ? { ...candidate, gender: "Male" as const } : candidate,
    ),
  };
}

function movement(state: ReturnType<typeof seeded>, id: string) {
  const found = state.movements.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`state is missing ${id}`);
  return found;
}

describe("seeding", () => {
  it("copies the fixture rather than aliasing it", () => {
    const first = seeded();
    const second = seeded();
    expect(first.movements[0]).not.toBe(second.movements[0]);
    expect(first.units[0]).not.toBe(second.units[0]);
  });

  it("starts with no refusals and a zero clock offset", () => {
    const state = seeded();
    expect(state.rejections).toEqual([]);
    expect(state.clockOffsetMinutes).toBe(0);
  });
});

describe("referral", () => {
  it("never refers above the parallel cap", () => {
    const state = seeded();
    const next = wardFlowReducer(state, {
      type: "REFER_TO_UNITS",
      role: "coordinator",
      now: NOW,
      movementId: "WF-009",
      unitIds: ["rph-adult-secure", "fsh-adult-secure", "rgh-adult-secure", "gry-adult-secure"],
    });
    expect(next.rejections).toHaveLength(1);
    expect(movement(next, "WF-009").referredUnitIds).toHaveLength(0);
  });

  it("moves a referred movement to destination review", () => {
    const state = seeded();
    const next = wardFlowReducer(state, {
      type: "REFER_TO_UNITS",
      role: "coordinator",
      now: NOW,
      movementId: "WF-009",
      unitIds: ["rph-adult-secure", "fsh-adult-secure"],
    });
    expect(movement(next, "WF-009").stage).toBe("destination_review");
    expect(movement(next, "WF-009").referredUnitIds).toEqual(["rph-adult-secure", "fsh-adult-secure"]);
  });

  /**
   * ⚠️ THE ONLY PRODUCER OF `referredAt`, AND THE ONLY THING THAT KEEPS THE ED BOARD'S SECOND
   * CLOCK HONEST.
   *
   * A `Movement` had no referral timestamp until 2026-09-02, so the ED referral board could say
   * only how long somebody had been in the department. This event is what writes the moment, and
   * a field nothing writes renders as a legitimate-looking empty state that no gate can see. The
   * seeded movements deliberately keep NO value — nobody recorded the moment because in the demo
   * it never happened — so the absence below is the seed's real answer, not a hole in the test.
   */
  it("stamps the moment of referral, and the seed carries none before it", () => {
    const state = seeded();
    expect(
      movement(state, "WF-009").referredAt,
      "a seeded movement already carries a referral time, so the assertion below cannot tell a " +
        "stamped moment from one that was there all along",
    ).toBeUndefined();

    const next = wardFlowReducer(state, {
      type: "REFER_TO_UNITS",
      role: "coordinator",
      now: NOW,
      movementId: "WF-009",
      unitIds: ["rph-adult-secure"],
    });
    expect(
      movement(next, "WF-009").referredAt,
      "the referral moment is not recorded, so the board can only ever say 'referral time not " +
        "recorded' and the wait since referral has no source",
    ).toBe(NOW);
  });
});

describe("acceptance", () => {
  function referred() {
    return wardFlowReducer(seeded(), {
      type: "REFER_TO_UNITS",
      role: "coordinator",
      now: NOW,
      movementId: "WF-009",
      unitIds: ["rph-adult-secure", "fsh-adult-secure", "rgh-adult-secure"],
    });
  }

  it("withdraws the other referrals and records each one", () => {
    const next = wardFlowReducer(referred(), {
      type: "ACCEPT_IN_PRINCIPLE",
      role: "ward",
      now: NOW,
      movementId: "WF-009",
      unitId: "rph-adult-secure",
    });
    const target = movement(next, "WF-009");
    expect(target.acceptedUnitId).toBe("rph-adult-secure");
    expect(target.stage).toBe("accepted_awaiting_bed");
    expect(target.withdrawnReferrals.map((entry) => entry.unitId).sort()).toEqual([
      "fsh-adult-secure",
      "rgh-adult-secure",
    ]);
    // 🔴 This loop USED to assert `.toContain("Ward 2K")` — it REQUIRED the withdrawal
    // written for the losing wards to name the ward that won, which is exactly the FD-23 leak.
    // Two sessions found the defect on screen while this test sat green, demanding it. The
    // inversion is the point: a guard can be precise, mutation-proof and pointed the wrong way.
    for (const withdrawn of target.withdrawnReferrals) {
      // ⚠️ THE NAMED ASSERTION RUNS FIRST, or it cannot run at all. After the exact `.toBe` it
      // was dead in both directions: if the `.toBe` passed, the reason was exactly
      // `another_unit_accepted` and this was trivially true; if it failed, execution stopped
      // here. So the one sentence a reader needs — that a losing ward must never be told who
      // won — could never be shown. Found by scanning for the shape, not by reading.
      expect(withdrawn.reason, "the losing ward must not be told who won").not.toContain("Ward 2K");
      expect(withdrawn.reason).toBe("another_unit_accepted");
    }
  });

  it("refuses a second acceptance and says the referral was withdrawn", () => {
    const accepted = wardFlowReducer(referred(), {
      type: "ACCEPT_IN_PRINCIPLE",
      role: "ward",
      now: NOW,
      movementId: "WF-009",
      unitId: "rph-adult-secure",
    });
    const next = wardFlowReducer(accepted, {
      type: "ACCEPT_IN_PRINCIPLE",
      role: "ward",
      now: NOW,
      movementId: "WF-009",
      unitId: "fsh-adult-secure",
    });
    expect(next.rejections).toHaveLength(1);
    expect(next.rejections[0].reason).toMatch(/withdraw/i);
    expect(movement(next, "WF-009").acceptedUnitId).toBe("rph-adult-secure");
  });
});

describe("the last bed", () => {
  it("refuses the second acceptance against a unit with one allocatable bed", () => {
    // Two patients, one bed. The model already names the answer; the reducer must enforce it.
    let state = seeded();
    const unit = state.units.find((candidate) => candidate.allocatable.value === 1);
    if (!unit) throw new Error("fixture no longer contains a single-allocatable-bed unit");

    for (const movementId of ["WF-009", "WF-017"]) {
      state = wardFlowReducer(state, {
        type: "REFER_TO_UNITS",
        role: "coordinator",
        now: NOW,
        movementId,
        unitIds: [unit.id],
      });
      state = wardFlowReducer(state, {
        type: "ACCEPT_IN_PRINCIPLE",
        role: "ward",
        now: NOW,
        movementId,
        unitId: unit.id,
      });
      state = wardFlowReducer(state, { type: "PULL_PATIENT", role: "ward", now: NOW, movementId, unitId: unit.id });
    }

    /*
     * 🔴 THIS USED TO ASSERT THE REFUSAL NAMED A CAUSE, AND IT PASSED FOR A COINCIDENCE.
     *
     * It required the message to contain the `DECLINE_REASONS` code for a bed pulled for an earlier
     * referral. In THIS scenario pulls really did exhaust the beds, so the claim happened to be
     * true — but the guard tests only `allocatable.value <= 0` and cannot tell that from a ward
     * confirming zero for an unrelated reason. ⚠️ **The assertion and the code agreed here and
     * disagreed nowhere the fixture reached**, which is the same coincidence that let a code-keyed
     * legal-forms split pass every test it had.
     *
     * So it now pins what the guard can actually support: the refusal names the unit and the count
     * it read, and claims no cause.
     */
    const refusal = state.rejections
      .map((rejection) => rejection.reason)
      .find((reason) => reason.includes("no allocatable bed remains"));
    expect(refusal, "no capacity refusal was raised - this case would prove nothing").toBeDefined();
    expect(refusal, "the refusal does not report the count the guard actually read").toMatch(
      /allocatable count is \d+/,
    );
    expect(
      refusal,
      "the refusal names a CAUSE the guard never checked. `allocatable.value <= 0` cannot distinguish " +
        "a bed pulled for an earlier referral from a ward confirming zero, and `allocatable.source` " +
        "cannot either - PULL_PATIENT preserves whatever source a prior CONFIRM_CAPACITY set.",
    ).not.toMatch(/bed_pulled_for_earlier_referral|earlier referral/);
  });
});

describe("holds", () => {
  it("gives a held bed four hours to lapse in", () => {
    let state = seeded();
    state = wardFlowReducer(state, {
      type: "REFER_TO_UNITS",
      role: "coordinator",
      now: NOW,
      movementId: "WF-009",
      unitIds: ["rph-adult-secure"],
    });
    state = wardFlowReducer(state, {
      type: "ACCEPT_IN_PRINCIPLE",
      role: "ward",
      now: NOW,
      movementId: "WF-009",
      unitId: "rph-adult-secure",
    });
    state = wardFlowReducer(state, {
      type: "PULL_PATIENT",
      role: "ward",
      now: NOW,
      movementId: "WF-009",
      unitId: "rph-adult-secure",
    });
    expect(movement(state, "WF-009").pullExpiresAt).toBe(NOW + 240);
    expect(movement(state, "WF-009").stage).toBe("pulled");
  });
});

describe("roles", () => {
  it("refuses an event raised by the wrong role", () => {
    const next = wardFlowReducer(seeded(), {
      type: "ACCEPT_IN_PRINCIPLE",
      role: "coordinator",
      now: NOW,
      movementId: "WF-009",
      unitId: "rph-adult-secure",
    });
    expect(next.rejections).toHaveLength(1);
    expect(next.rejections[0].reason).toMatch(/role/i);
    expect(movement(next, "WF-009").acceptedUnitId).toBeUndefined();
  });
});

describe("arrival", () => {
  it("consumes the bed and closes the record", () => {
    let state = seeded();
    const before = state.units.find((unit) => unit.id === "rph-adult-secure")!.allocatable.value;
    for (const event of [
      { type: "REFER_TO_UNITS", role: "coordinator", unitIds: ["rph-adult-secure"] },
      { type: "ACCEPT_IN_PRINCIPLE", role: "ward", unitId: "rph-adult-secure" },
      { type: "PULL_PATIENT", role: "ward", unitId: "rph-adult-secure" },
      // Booking is a step of its own since 2026-08-31: `HANDOVER_READY` used to fabricate the
      // transport job and answer the escort question by deriving it from legal status. It no
      // longer invents either, so a walk that reaches handover without booking is refused.
      {
        type: "BOOK_TRANSPORT",
        role: "ed",
        provider: "Ambulance service",
        escortRequired: true,
        cadNumber: "CAD-STUB-0001",
        transportLegalStatus: "voluntary",
        estimatedAt: 0,
      },
      { type: "HANDOVER_READY", role: "ed" },
      { type: "TRANSPORT_ACCEPTED", role: "officer" },
      { type: "TRANSPORT_EN_ROUTE", role: "officer" },
      { type: "PATIENT_COLLECTED", role: "officer" },
      { type: "PATIENT_ARRIVED", role: "officer" },
    ] as const) {
      state = wardFlowReducer(state, { ...event, now: NOW, movementId: "WF-009" } as never);
    }
    expect(state.rejections).toEqual([]);
    expect(movement(state, "WF-009").stage).toBe("arrived");
    const after = state.units.find((unit) => unit.id === "rph-adult-secure")!;
    expect(after.allocatable.value).toBeLessThan(before);
  });

  it("creates a person in the bed on arrival, so the patient does not vanish when the movement closes", () => {
    /*
     * THE DEFECT THIS PINS. Until 2026-08-30 this reducer contained the word "admission" zero times.
     * Arrival closed the movement, decremented the unit's empty count and bumped its sex mix - and
     * created no record of the person. `isOpen` is `!closure && stage !== "arrived"`, and it gates
     * ten surfaces: the queue, the coordinator inbox, handover, placement, patient search, the
     * pressure strip, the live tracker and the ED screen among them.
     *
     * So a patient who reached a ward became a closed movement and nothing else, and the
     * demonstration lost sight of them at the exact moment it had succeeded in placing them. The
     * bed count moved and the person did not exist.
     *
     * Nothing was red. Every assertion about arrival was about the MOVEMENT and the UNIT - both
     * still correct - and no test anywhere asked what happened to the human being.
     */
    const before = seeded();
    let state = before;
    for (const event of [
      { type: "REFER_TO_UNITS", role: "coordinator", unitIds: ["rph-adult-secure"] },
      { type: "ACCEPT_IN_PRINCIPLE", role: "ward", unitId: "rph-adult-secure" },
      { type: "PULL_PATIENT", role: "ward", unitId: "rph-adult-secure" },
      // Booking is a step of its own since 2026-08-31: `HANDOVER_READY` used to fabricate the
      // transport job and answer the escort question by deriving it from legal status. It no
      // longer invents either, so a walk that reaches handover without booking is refused.
      {
        type: "BOOK_TRANSPORT",
        role: "ed",
        provider: "Ambulance service",
        escortRequired: true,
        cadNumber: "CAD-STUB-0001",
        transportLegalStatus: "voluntary",
        estimatedAt: 0,
      },
      { type: "HANDOVER_READY", role: "ed" },
      { type: "TRANSPORT_ACCEPTED", role: "officer" },
      { type: "TRANSPORT_EN_ROUTE", role: "officer" },
      { type: "PATIENT_COLLECTED", role: "officer" },
      { type: "PATIENT_ARRIVED", role: "officer" },
    ] as const) {
      state = wardFlowReducer(state, { ...event, now: NOW, movementId: "WF-009" } as never);
    }
    expect(state.rejections, "the walk itself must succeed, or this test proves nothing").toEqual([]);

    // The movement still closes - that behaviour is unchanged and correct. The point is what now
    // exists alongside it.
    expect(movement(state, "WF-009").stage).toBe("arrived");

    expect(
      state.admissions.length,
      "arrival must create exactly one person in a bed - no more, and above all no fewer",
    ).toBe(before.admissions.length + 1);

    const arrival = state.admissions[state.admissions.length - 1];
    expect(arrival.state, "the person is in the bed, not waitlisted or departed").toBe("occupied");
    expect(arrival.arrivedAt, "arrival is stamped at the instant the event carried").toBe(NOW);
    expect(arrival.unitId, "the person is in the unit that accepted them").toBe(
      movement(state, "WF-009").acceptedUnitId,
    );
    expect(arrival.sex, "the sex mix is derived from the people in the beds, so this must carry it").toBe(
      movement(state, "WF-009").sex,
    );

    // 🔴 R4 (docs/ward-flow/plans/2026-09-16-fix-plan-referral-model.md), 2026-09-17: this used to
    // assert both fields `toBeNull()`, on the reasoning "an admission created by an arrival came
    // from a movement, not a referral - inventing a referral id would point at nothing". That was
    // true of every WF-009 admission only because PULL_PATIENT wrote `referralId: null`
    // UNCONDITIONALLY, even though WF-009 itself carries `referralId: "RF-013"` (a real, resolving
    // seeded link — `ward-movement-referral-link.test.ts`'s own `SEEDED_LINKED_MOVEMENT_IDS`). That
    // was the exact defect R4 fixes: `admissionBelongsToTeam` reads this field, so a community
    // team's own referred patient vanished from its team page the instant a ward pulled them a bed.
    // WF-009's referral resolves, so its admission must now carry that referral's own id and home
    // region — not an invented one, and not a null that no longer describes this admission.
    expect(
      arrival.referralId,
      "WF-009 is raised from RF-013, a real referral this state holds, so its admission must carry " +
        "that referral's own id — a null here would mean the resolution silently stopped happening",
    ).toBe("RF-013");
    expect(
      arrival.homeRegion,
      "RF-013's own homeRegion is the fact to copy, never an address and never derived from the " +
        "origin emergency department — the same resolution referralId above just proved happened",
    ).toBe("Peel");

    // The seeded occupants are untouched: this appends a person, it does not rebuild the ward.
    expect(state.admissions.slice(0, before.admissions.length)).toEqual(before.admissions);
  });
});

describe("new referrals", () => {
  it("issues deterministic ids without any random source", () => {
    const first = wardFlowReducer(seeded(), {
      type: "RAISE_REFERRAL",
      role: "ed",
      now: NOW,
      edId: "jhc-ed",
      draft: {
        cohort: "Adult",
        security: "Open",
        sex: "Female",
        gender: "Female", // R7 (2026-09-25): record gender so the walk needs no coordinator review
        specialling: false,
        highAcuity: false,
        legalStatus: "Voluntary",
        urgency: 2,
        legalFormCode: null,
      },
    });
    const second = wardFlowReducer(seeded(), {
      type: "RAISE_REFERRAL",
      role: "ed",
      now: NOW,
      edId: "jhc-ed",
      draft: {
        cohort: "Adult",
        security: "Open",
        sex: "Female",
        gender: "Female", // R7 (2026-09-25): record gender so the walk needs no coordinator review
        specialling: false,
        highAcuity: false,
        legalStatus: "Voluntary",
        urgency: 2,
        legalFormCode: null,
      },
    });
    const firstId = first.movements[first.movements.length - 1].id;
    expect(firstId).toBe(second.movements[second.movements.length - 1].id);
    expect(first.movements).toHaveLength(second.movements.length);
  });

  it("gives a new referral an owner and the raising department", () => {
    const next = wardFlowReducer(seeded(), {
      type: "RAISE_REFERRAL",
      role: "ed",
      now: NOW,
      edId: "jhc-ed",
      draft: {
        cohort: "Adult",
        security: "Open",
        sex: "Male",
        gender: "Male", // R7 (2026-09-25): record gender so the walk needs no coordinator review
        specialling: false,
        highAcuity: false,
        legalStatus: "Voluntary",
        urgency: 3,
        legalFormCode: null,
      },
    });
    const created = next.movements[next.movements.length - 1];
    expect(created.originEdId).toBe("jhc-ed");
    expect(created.owner.length).toBeGreaterThan(0);
    expect(created.stage).toBe("placement_requested");
    expect(created.withdrawnReferrals).toEqual([]);
  });

  /**
   * 2026-08-24: RAISE_REFERRAL used to DERIVE the form from `legalStatus` — a Form 1A for the two
   * awaiting-examination statuses, nothing otherwise. That derivation is deleted. The clinician
   * chooses the form on the intake form and the software chooses none, so the tests below pin the
   * choice being carried through faithfully in both directions: `null` means no form, a chosen
   * code means that form and no other, and the status has no say in either.
   */
  it("gives a referral with no form chosen no legal form at all", () => {
    const voluntary = wardFlowReducer(seeded(), {
      type: "RAISE_REFERRAL",
      role: "ed",
      now: NOW,
      edId: "jhc-ed",
      draft: {
        cohort: "Adult",
        security: "Open",
        sex: "Female",
        gender: "Female", // R7 (2026-09-25): record gender so the walk needs no coordinator review
        specialling: false,
        highAcuity: false,
        legalStatus: "Voluntary",
        urgency: 2,
        legalFormCode: null,
      },
    });
    const voluntaryCreated = voluntary.movements[voluntary.movements.length - 1];
    expect(voluntaryCreated.legalForm).toBeUndefined();
    // `formedAt` used to be stamped in the same branch as the derived 1A. With the derivation
    // gone there is no rule left to hang it on and none was invented, so a runtime-raised
    // referral now carries no `formedAt` whatever the draft says. Pinned as an explicit absence
    // so a future edit cannot quietly reintroduce a stamping rule nobody asked for.
    expect(voluntaryCreated.formedAt).toBeUndefined();
  });

  it.each(["Referred for psychiatric examination", "Detained awaiting examination", "Voluntary"] as const)(
    "attaches the chosen Form 3D to a %s referral, and derives nothing from the status",
    (legalStatus) => {
      // 3D is the sharpest case in the whole change. The product owner named it as a form a
      // patient might be on; this model holds NO label and NO classification for it, so it is
      // offered as the bare code and carried as the bare code. Asserting the exact object is what
      // makes an invented label or `kind` fail here rather than reach a screen.
      const referred = wardFlowReducer(seeded(), {
        type: "RAISE_REFERRAL",
        role: "ed",
        now: NOW,
        edId: "jhc-ed",
        draft: {
          cohort: "Adult",
          security: "Open",
          sex: "Female",
          gender: "Female", // R7 (2026-09-25): record gender so the walk needs no coordinator review
          specialling: false,
          highAcuity: false,
          legalStatus,
          urgency: 2,
          legalFormCode: "3D",
        },
      });
      expect(referred.rejections).toEqual([]);
      const created = referred.movements.at(-1)!;
      expect(created.legalForm).toEqual({ code: "3D" });
      expect(created.legalForm?.kind).toBeUndefined();
      // The movement stores a code and nothing else — no title is copied onto it. The title a
      // reader sees comes from the register at render time, so it cannot go stale here.
      expect(Object.keys(created.legalForm!)).toEqual(["code"]);
      expect(created.legalForm?.dueAt).toBeUndefined();
      // The status had no say: a "Voluntary" draft carrying a 3D gets the 3D, and an
      // awaiting-examination draft gets the 3D too rather than the 1A the deleted rule imposed.
      expect(created.legalStatus).toBe(legalStatus);
      expect(created.formedAt).toBeUndefined();
    },
  );

  it.each(SELECTABLE_LEGAL_FORMS.map((form) => form.code))(
    "attaches the chosen Form %s exactly as declared",
    (code) => {
      const declared = SELECTABLE_LEGAL_FORMS.find((form) => form.code === code)!;
      const referred = wardFlowReducer(seeded(), {
        type: "RAISE_REFERRAL",
        role: "ed",
        now: NOW,
        edId: "jhc-ed",
        draft: {
          cohort: "Adult",
          security: "Open",
          sex: "Female",
          gender: "Female", // R7 (2026-09-25): record gender so the walk needs no coordinator review
          specialling: false,
          highAcuity: false,
          legalStatus: "Voluntary",
          urgency: 2,
          legalFormCode: code,
        },
      });
      expect(referred.rejections).toEqual([]);
      const created = referred.movements.at(-1)!;
      expect(created.legalForm).toEqual(declared);
      // 2026-08-23 product-owner correction, still in force: no offered form carries a deadline.
      expect(created.legalForm?.dueAt).toBeUndefined();
      // The attached form must be a COPY, never the picker's own entry — a movement is mutable
      // state and the list is a shared module constant.
      expect(created.legalForm).not.toBe(declared);
    },
  );

  it("refuses a form code the picker does not offer rather than inventing or dropping one", () => {
    const next = wardFlowReducer(seeded(), {
      type: "RAISE_REFERRAL",
      role: "ed",
      now: NOW,
      edId: "jhc-ed",
      draft: {
        cohort: "Adult",
        security: "Open",
        sex: "Female",
        gender: "Female", // R7 (2026-09-25): record gender so the walk needs no coordinator review
        specialling: false,
        highAcuity: false,
        legalStatus: "Voluntary",
        urgency: 2,
        legalFormCode: "9Z",
      },
    });
    // Conservative failure: the referral is refused and visible in `rejections`, rather than
    // being created with a fabricated Form 9Z or with the clinician's choice silently discarded.
    expect(next.rejections).toHaveLength(1);
    expect(next.rejections[0].reason).toContain("9Z");
    expect(next.movements).toHaveLength(seeded().movements.length);
  });
});

describe("purity", () => {
  it("never mutates the state it was given", () => {
    const state = seeded();
    const snapshot = JSON.stringify(state);
    wardFlowReducer(state, {
      type: "REFER_TO_UNITS",
      role: "coordinator",
      now: NOW,
      movementId: "WF-009",
      unitIds: ["rph-adult-secure"],
    });
    expect(JSON.stringify(state)).toBe(snapshot);
  });
});

describe("examination", () => {
  /**
   * 2026-08-24: recording an examination used to REPLACE a Form 1A with a Form 3B on an inpatient
   * order, and CLEAR the form entirely on a community order or a revocation. Both are deleted —
   * the form never changes by itself, in any outcome, and only the clinician changes it. These
   * three cases pin that across all three outcomes, so a form-touching branch cannot come back in
   * one of them unnoticed.
   */
  it.each(["inpatient_order", "community_order", "revoked"] as const)(
    "records a %s examination without touching the legal form",
    (outcome) => {
      // WF-001 is seeded on 1A ("Referral for examination", no examination recorded yet).
      const before = seeded();
      const formBefore = movement(before, "WF-001").legalForm;
      // Non-vacuity: this proves nothing unless the movement actually carries a form to leave alone.
      expect(formBefore?.code).toBe("1A");

      const next = wardFlowReducer(before, {
        type: "RECORD_EXAMINATION",
        role: "ed",
        now: NOW,
        movementId: "WF-001",
        outcome,
      });
      expect(next.rejections).toEqual([]);
      const target = movement(next, "WF-001");
      expect(target.examination).toEqual({ at: NOW, outcome });
      // Unchanged: still a 1A, still no 3B, still not cleared — and still no deadline.
      expect(target.legalForm).toEqual(formBefore);
      expect(target.legalForm?.dueAt).toBeUndefined();
    },
  );

  it("still refuses a second examination on the same movement", () => {
    // The one guard in this branch that is NOT a form rule and was deliberately kept: two
    // examinations against one movement is a data-integrity fault. Nothing else pinned it, and
    // with the form gate gone it is the only thing standing between the record and a duplicate.
    const once = wardFlowReducer(seeded(), {
      type: "RECORD_EXAMINATION",
      role: "ed",
      now: NOW,
      movementId: "WF-001",
      outcome: "inpatient_order",
    });
    expect(once.rejections).toEqual([]);
    const twice = wardFlowReducer(once, {
      type: "RECORD_EXAMINATION",
      role: "ed",
      now: NOW + 5,
      movementId: "WF-001",
      outcome: "community_order",
    });
    expect(twice.rejections).toHaveLength(1);
    expect(twice.rejections[0].reason).toContain("already examined");
    // The first examination stands unchanged; the refused second one wrote nothing.
    expect(movement(twice, "WF-001").examination).toEqual({ at: NOW, outcome: "inpatient_order" });
  });

  it("refuses an examination against a movement that has already closed", () => {
    // Fix wave 1, item 4. Every other movement-scoped handler already refused a closed movement;
    // this one did not, so an examination recorded against an ARRIVED patient overwrote the
    // arrival closure with `did_not_proceed`. Walked through real events rather than by
    // hand-setting `closure`.
    //
    // WF-012 rather than WF-009 ON PURPOSE: WF-009 already carries an examination in the fixture,
    // so the second-examination guard would refuse this too and the test would still pass with
    // the closure check deleted. WF-012 is Adult/Secure, at `placement_requested`, and carries NO
    // examination, so the closure check is the only thing that can refuse it — which is what
    // makes the mutation kill this test.
    const TARGET = "WF-012";
    const steps = [
      {
        type: "REFER_TO_UNITS",
        role: "coordinator",
        unitIds: ["rph-adult-secure"],
        genderPlacementReason: GENDER_PLACEMENT_REASONS[0],
        genderPlacementChecked: true,
      },
      { type: "ACCEPT_IN_PRINCIPLE", role: "ward", unitId: "rph-adult-secure" },
      { type: "PULL_PATIENT", role: "ward", unitId: "rph-adult-secure" },
      // Booking is a step of its own since 2026-08-31: `HANDOVER_READY` used to fabricate the
      // transport job and answer the escort question by deriving it from legal status. It no
      // longer invents either, so a walk that reaches handover without booking is refused.
      {
        type: "BOOK_TRANSPORT",
        role: "ed",
        provider: "Ambulance service",
        escortRequired: true,
        cadNumber: "CAD-STUB-0001",
        transportLegalStatus: "voluntary",
        estimatedAt: 0,
      },
      { type: "HANDOVER_READY", role: "ed" },
      { type: "TRANSPORT_ACCEPTED", role: "officer" },
      { type: "TRANSPORT_EN_ROUTE", role: "officer" },
      { type: "PATIENT_COLLECTED", role: "officer" },
      { type: "PATIENT_ARRIVED", role: "officer" },
    ] as const;
    let state = seeded();
    for (const step of steps) {
      state = wardFlowReducer(state, { ...step, now: NOW, movementId: TARGET } as never);
    }
    expect(state.rejections).toEqual([]);
    const arrived = movement(state, TARGET);
    // Non-vacuity: the walk really did close this movement by arriving, so the refusal below is
    // about the closure and not about some earlier step having failed.
    expect(arrived.stage).toBe("arrived");
    expect(arrived.closure?.outcome).toBe("arrived");

    // Non-vacuity, and the whole reason this movement was chosen: it carries no examination, so
    // the second-examination guard cannot be what refuses the event below.
    expect(arrived.examination).toBeUndefined();

    const after = wardFlowReducer(state, {
      type: "RECORD_EXAMINATION",
      role: "ed",
      now: NOW + 500,
      movementId: TARGET,
      outcome: "revoked",
    });
    expect(after.rejections).toHaveLength(1);
    expect(after.rejections[0].reason).toContain("closed movement");
    // The arrival stands: neither the closure nor the examination field was overwritten.
    expect(movement(after, TARGET).closure?.outcome).toBe("arrived");
    expect(movement(after, TARGET).examination).toBeUndefined();
  });

  it("still closes the movement without an inpatient bed when the examination is revoked", () => {
    const next = wardFlowReducer(seeded(), {
      type: "RECORD_EXAMINATION",
      role: "ed",
      now: NOW,
      movementId: "WF-001",
      outcome: "revoked",
    });
    const target = movement(next, "WF-001");
    expect(target.closure?.outcome).toBe("did_not_proceed");
  });

  /**
   * The three cases the deleted "form must be 1A" gate refused outright. Each raises a fresh
   * referral so the movement's form is exactly what this test says it is, rather than whatever
   * the fixture happens to carry.
   */
  it.each([["3B"], ["4A"], [null]] as const)("records an examination for a patient on %s", (legalFormCode) => {
    const referred = wardFlowReducer(seeded(), {
      type: "RAISE_REFERRAL",
      role: "ed",
      now: NOW,
      edId: "jhc-ed",
      draft: {
        cohort: "Adult",
        security: "Open",
        sex: "Female",
        gender: "Female", // R7 (2026-09-25): record gender so the walk needs no coordinator review
        specialling: false,
        highAcuity: false,
        legalStatus: "Voluntary",
        urgency: 2,
        legalFormCode,
      },
    });
    const created = referred.movements.at(-1)!;
    // Non-vacuity: the movement really carries (or really lacks) the form this case is about.
    expect(created.legalForm?.code ?? null).toBe(legalFormCode);

    const next = wardFlowReducer(referred, {
      type: "RECORD_EXAMINATION",
      role: "ed",
      now: NOW + 1,
      movementId: created.id,
      outcome: "inpatient_order",
    });
    expect(next.rejections).toEqual([]);
    const target = movement(next, created.id);
    expect(target.examination).toEqual({ at: NOW + 1, outcome: "inpatient_order" });
    // Recorded, and the form is still exactly what the clinician selected.
    expect(target.legalForm).toEqual(created.legalForm);
  });

  /**
   * 🔴 CORRECTED 2026-09-15 under WLQ-4 (owner): this test used to be titled "cancels downstream
   * transport, releases the held bed, and refuses further transitions when a movement closes",
   * and every one of those three things was true of WF-005 (seeded at `handover_ready`) until
   * this ruling. The owner's words: *"a revoked examination after transport is booked or the
   * patient is moving does NOT release the bed"* — it must not auto-cancel the transport or
   * auto-refund the bed either, because doing either automatically is exactly the judgement about
   * a moving vehicle and an occupied admission that WLQ-4 reserves for the coordinator. See the
   * new `describe` block below this one for the full behaviour and the release path.
   *
   * This test now proves the ONE THING WLQ-4 changed here — that `handover_ready` no longer
   * refunds the bed or cancels transport — while keeping WF-005 as the fixture that reproduces the
   * original reported defect's SETUP (a movement genuinely at `handover_ready` with transport
   * accepted). The defect this test originally guarded — a closed movement still accepting
   * `TRANSPORT_EN_ROUTE` — cannot recur here in the old form, because WLQ-4 deliberately leaves the
   * movement OPEN at this stage; see the new block for what closes it instead of the reducer
   * silently getting it wrong.
   */
  it("does NOT cancel transport or refund the bed at handover_ready — WLQ-4 flags it for the coordinator instead", () => {
    // WF-005 is seeded at handover_ready, accepted at fre-adult-open, with a transport job
    // already accepted (but not yet en route). fre-adult-open's allocatable count reflects an
    // earlier PULL_PATIENT on this same movement.
    const before = seeded();
    const beforeUnit = before.units.find((candidate) => candidate.id === "fre-adult-open")!;
    const beforeTransport = movement(before, "WF-005").transport;
    expect(
      beforeTransport,
      "WF-005 must already carry a booked, accepted transport job, or this proves nothing",
    ).toBeDefined();

    const next = wardFlowReducer(before, {
      type: "RECORD_EXAMINATION",
      role: "ed",
      now: NOW,
      movementId: "WF-005",
      outcome: "revoked",
    });
    expect(next.rejections).toEqual([]);
    const target = movement(next, "WF-005");

    // The clinical fact is still recorded...
    expect(target.examination).toEqual({ at: NOW, outcome: "revoked" });
    // ...but the movement stays OPEN. Closing it here is what would make the release path below
    // unreachable — `STEP_BACK_STAGE` and `RELEASE_PULL` both refuse a closed movement outright.
    expect(
      target.closure,
      "WLQ-4: closing here would block every coordinator action that could release the bed",
    ).toBeUndefined();
    expect(target.stage).toBe("handover_ready");
    // Transport is UNTOUCHED — not cancelled, not otherwise modified.
    expect(target.transport).toEqual(beforeTransport);
    // The bed reserved by the earlier PULL_PATIENT is NOT given back — that is exactly the
    // "released it without anybody deciding to" defect WLQ-4 exists to stop.
    const afterUnit = next.units.find((candidate) => candidate.id === "fre-adult-open")!;
    expect(afterUnit.allocatable.value).toBe(beforeUnit.allocatable.value);
    // `admissionId` is untouched — WF-005 is a hand-authored fixture with no real pull-admission
    // join (see `PATIENT_ARRIVED`'s own comment on why an absent id here is a real, left-alone
    // case), so this proves the field did not MOVE rather than that a join was kept; the
    // WLQ-4 release-path block below proves the admission itself survives, on a movement reached
    // by the real `PULL_PATIENT` event.
    expect(target.admissionId).toBe(movement(before, "WF-005").admissionId);
    // The exception is visible on the movement itself, in the same field every other stage
    // transition already uses to say what is holding a movement up.
    expect(target.blocker).toContain("examination was revoked");

    // WLQ-4 close-out (2026-09-20): while examination is revoked and bed is held, transport
    // cannot be advanced.
    const enRoute = wardFlowReducer(next, {
      type: "TRANSPORT_EN_ROUTE",
      role: "officer",
      now: NOW + 5,
      movementId: "WF-005",
    });
    expect(enRoute.rejections).toContainEqual(
      expect.objectContaining({
        attempted: "TRANSPORT_EN_ROUTE",
        reason: expect.stringContaining("the examination was revoked and the bed is still held"),
      }),
    );
  });

  /**
   * WLQ-4 (owner, 2026-09-15): the full behaviour, and the release path the coordinator actually
   * has. `RECORD_EXAMINATION`'s `handover_ready`/`moving` branch deliberately leaves the movement
   * open (see the test above), which is what keeps `STEP_BACK_STAGE` (coordinator-only, "touches
   * nothing but `stage`" — its own doc comment) and `RELEASE_PULL` (valid once stage is `pulled`
   * again) reachable. Walking that exact chain is the proof that "flag it" is not a dead end.
   */
  describe("WLQ-4: the coordinator's release path after a flagged revocation", () => {
    function walkToHandoverReady(movementId: string) {
      let state = seeded();
      for (const step of [
        {
          type: "REFER_TO_UNITS",
          role: "coordinator",
          unitIds: ["rph-adult-secure"],
          genderPlacementReason: GENDER_PLACEMENT_REASONS[0],
          genderPlacementChecked: true,
        },
        { type: "ACCEPT_IN_PRINCIPLE", role: "ward", unitId: "rph-adult-secure" },
        { type: "PULL_PATIENT", role: "ward", unitId: "rph-adult-secure" },
        {
          type: "BOOK_TRANSPORT",
          role: "ed",
          provider: "Ambulance service",
          escortRequired: true,
          cadNumber: "CAD-STUB-0001",
          transportLegalStatus: "voluntary",
          estimatedAt: 0,
        },
        { type: "HANDOVER_READY", role: "ed" },
      ] as const) {
        state = wardFlowReducer(state, { ...step, now: NOW, movementId } as never);
      }
      expect(state.rejections, "the walk to handover_ready must succeed, or nothing below proves anything").toEqual([]);
      return state;
    }

    it("lets the coordinator release the bed exactly once, with no orphaned admission or transport", () => {
      const TARGET = "WF-012";
      const atHandover = walkToHandoverReady(TARGET);
      const beforeUnit = atHandover.units.find((candidate) => candidate.id === "rph-adult-secure")!;
      const admissionId = movement(atHandover, TARGET).admissionId;
      expect(
        admissionId,
        "the walk must have created a pulled admission, or the release below proves nothing",
      ).toBeDefined();

      const revoked = wardFlowReducer(atHandover, {
        type: "RECORD_EXAMINATION",
        role: "ed",
        now: NOW + 1,
        movementId: TARGET,
        outcome: "revoked",
      });
      expect(revoked.rejections).toEqual([]);
      // Non-vacuity: the bed must genuinely still be held and the admission still present, or the
      // release proven below could be releasing something that was never withheld.
      expect(revoked.units.find((candidate) => candidate.id === "rph-adult-secure")!.allocatable.value).toBe(
        beforeUnit.allocatable.value,
      );
      expect(revoked.admissions.some((candidate) => candidate.id === admissionId)).toBe(true);

      // Step 1: the coordinator's own record correction — steps the stage back to `pulled` and
      // touches nothing else (STEP_BACK_STAGE's own contract).
      const steppedBack = wardFlowReducer(revoked, {
        type: "STEP_BACK_STAGE",
        role: "coordinator",
        now: NOW + 2,
        movementId: TARGET,
        to: "pulled",
        reason: "the_patient_situation_changed",
      } as never);
      expect(steppedBack.rejections).toEqual([]);
      expect(movement(steppedBack, TARGET).stage).toBe("pulled");
      // STEP_BACK_STAGE alone changes no bed figure and deletes nothing.
      expect(steppedBack.units.find((candidate) => candidate.id === "rph-adult-secure")!.allocatable.value).toBe(
        beforeUnit.allocatable.value,
      );
      expect(steppedBack.admissions.some((candidate) => candidate.id === admissionId)).toBe(true);

      // A recorded booking must be cancelled before release; stage correction cannot undo it.
      const premature = wardFlowReducer(steppedBack, {
        type: "RELEASE_PULL",
        role: "coordinator",
        now: NOW + 3,
        movementId: TARGET,
        reason: "patient_no_longer_coming",
      });
      expect(premature.rejections.at(-1)?.reason).toContain("cancel it (CANCEL_TRANSPORT)");
      expect(premature.units).toBe(steppedBack.units);
      expect(premature.admissions).toBe(steppedBack.admissions);
      const cancelled = wardFlowReducer(steppedBack, {
        type: "CANCEL_TRANSPORT",
        role: "coordinator",
        now: NOW + 3,
        movementId: TARGET,
        reason: CANCEL_TRANSPORT_REASONS[0],
      });
      expect(cancelled.rejections).toEqual([]);
      const released = wardFlowReducer(cancelled, {
        type: "RELEASE_PULL",
        role: "coordinator",
        now: NOW + 4,
        movementId: TARGET,
        reason: "patient_no_longer_coming",
      });
      expect(released.rejections).toEqual([]);

      const releasedUnit = released.units.find((candidate) => candidate.id === "rph-adult-secure")!;
      // Refunded EXACTLY ONCE — a defect in this path would either never refund it or refund it
      // twice (once automatically inside RECORD_EXAMINATION, once again here); this pins the count.
      expect(releasedUnit.allocatable.value).toBe(beforeUnit.allocatable.value + 1);
      expect(
        released.admissions.some((candidate) => candidate.id === admissionId),
        "no orphaned admission — the released pull deletes exactly the record it created",
      ).toBe(false);
      expect(movement(released, TARGET).admissionId).toBeUndefined();
    });

    it("STILL PROVES the pulled behaviour from 3956761b1f is unchanged — a revoked exam AT pulled releases immediately", () => {
      const TARGET = "WF-012";
      let state = seeded();
      for (const step of [
        {
          type: "REFER_TO_UNITS",
          role: "coordinator",
          unitIds: ["rph-adult-secure"],
          genderPlacementReason: GENDER_PLACEMENT_REASONS[0],
          genderPlacementChecked: true,
        },
        { type: "ACCEPT_IN_PRINCIPLE", role: "ward", unitId: "rph-adult-secure" },
        { type: "PULL_PATIENT", role: "ward", unitId: "rph-adult-secure" },
      ] as const) {
        state = wardFlowReducer(state, { ...step, now: NOW, movementId: TARGET } as never);
      }
      const beforeUnit = state.units.find((candidate) => candidate.id === "rph-adult-secure")!;
      const admissionId = movement(state, TARGET).admissionId;

      const revoked = wardFlowReducer(state, {
        type: "RECORD_EXAMINATION",
        role: "ed",
        now: NOW + 1,
        movementId: TARGET,
        outcome: "revoked",
      });
      expect(revoked.rejections).toEqual([]);
      expect(movement(revoked, TARGET).closure?.outcome).toBe("did_not_proceed");
      expect(revoked.units.find((candidate) => candidate.id === "rph-adult-secure")!.allocatable.value).toBe(
        beforeUnit.allocatable.value + 1,
      );
      expect(revoked.admissions.some((candidate) => candidate.id === admissionId)).toBe(false);
      expect(movement(revoked, TARGET).admissionId).toBeUndefined();
    });
  });

  it("REFER_TO_UNITS, ACCEPT_IN_PRINCIPLE and PULL_PATIENT actually reach a pulled bed with a pulled admission", () => {
    // Non-vacuity for the test below: proves the walk to a pulled bed is real — a genuine bed held
    // (allocatable drops to 0) and a genuine `Admission` recorded with state "pulled" — so the
    // expected-failure test cannot be resting on a setup that silently did nothing.
    const TARGET = "WF-012";
    const steps = [
      {
        type: "REFER_TO_UNITS",
        role: "coordinator",
        unitIds: ["rph-adult-secure"],
        genderPlacementReason: GENDER_PLACEMENT_REASONS[0],
        genderPlacementChecked: true,
      },
      { type: "ACCEPT_IN_PRINCIPLE", role: "ward", unitId: "rph-adult-secure" },
      { type: "PULL_PATIENT", role: "ward", unitId: "rph-adult-secure" },
    ] as const;
    let state = seeded();
    for (const step of steps) {
      state = wardFlowReducer(state, { ...step, now: NOW, movementId: TARGET } as never);
    }
    expect(state.rejections).toEqual([]);

    const pulled = movement(state, TARGET);
    expect(pulled.stage).toBe("pulled");
    expect(pulled.admissionId).toBe("AD-ARR-01");

    const unit = state.units.find((candidate) => candidate.id === "rph-adult-secure")!;
    expect(unit.allocatable.value).toBe(0);

    const admission = state.admissions.find((candidate) => candidate.id === "AD-ARR-01");
    expect(admission?.state).toBe("pulled");
  });

  it("RECORD_EXAMINATION on a pulled bed is ACCEPTED and does release the bed", () => {
    // ⚠️ THE CONTROL THAT THE `it.fails` BELOW CANNOT PROVIDE FOR ITSELF, AND IT IS NOT OPTIONAL.
    // `it.fails` passes when its body throws for ANY reason — including a dispatch the reducer
    // REFUSED. A refused `RECORD_EXAMINATION` would leave the admission in place, so the assertion
    // below would throw and the pin would stay green forever while proving nothing. Inverting that
    // assertion does not distinguish the two cases either: a refusal satisfies the inverted form
    // just as a real defect does.
    //
    // The discriminator is that the dispatch CHANGED something: allocatable goes 0 -> 1 and the
    // movement closes. That is asserted HERE, in a normal test that goes RED if the action is ever
    // refused — role renamed, guard added, stage renamed. Without this test the pin is unfalsifiable.
    const TARGET = "WF-012";
    let state = seeded();
    for (const step of [
      {
        type: "REFER_TO_UNITS",
        role: "coordinator",
        unitIds: ["rph-adult-secure"],
        genderPlacementReason: GENDER_PLACEMENT_REASONS[0],
        genderPlacementChecked: true,
      },
      { type: "ACCEPT_IN_PRINCIPLE", role: "ward", unitId: "rph-adult-secure" },
      { type: "PULL_PATIENT", role: "ward", unitId: "rph-adult-secure" },
    ] as const) {
      state = wardFlowReducer(state, { ...step, now: NOW, movementId: TARGET } as never);
    }
    const before = state.units.find((candidate) => candidate.id === "rph-adult-secure")!;
    expect(before.allocatable.value).toBe(0);

    const after = wardFlowReducer(state, {
      type: "RECORD_EXAMINATION",
      role: "ed",
      now: NOW + 1,
      movementId: TARGET,
      outcome: "revoked",
    });

    // Not refused: the reducer records refusals rather than throwing, so an unchanged rejection
    // list is what "the action was permitted" looks like here.
    expect(after.rejections).toEqual(state.rejections);
    // And it did the capacity half of the work — the half that WAS ported from RELEASE_PULL.
    expect(after.units.find((candidate) => candidate.id === "rph-adult-secure")!.allocatable.value).toBe(1);
    expect(movement(after, TARGET).closure?.outcome).toBe("did_not_proceed");
  });

  /**
   * `RECORD_EXAMINATION`'s discharge branch (`community_order`/`revoked`) gave the held bed back
   * to `unit.allocatable.value` but never deleted the `Admission` the earlier `PULL_PATIENT`
   * created, and never cleared `movement.admissionId` — so a closed, revoked movement was left
   * pointing at an admission still recorded `state: "pulled"`, and the ward board went on showing
   * a phantom occupant in a bed the unit's own count said was free again.
   *
   * `RELEASE_PULL` was fixed for this exact shape on 2026-09-01: it filters the admission out of
   * `state.admissions` and sets `movement.admissionId` to `undefined`. `RECORD_EXAMINATION` now
   * mirrors that admission half too, scoped to exactly the fixture below proves: a bed that was
   * pulled and whose transport has not yet been collected (`movement.stage === "pulled"`). A
   * revoked examination reached from `handover_ready` or `moving` — transport booked or already
   * collected — is UNCHANGED by this fix and keeps the pre-existing dangling-admission behaviour;
   * see the fix's own commit for why that stayed out of scope.
   */
  it("deletes the pulled admission and clears movement.admissionId when a pulled bed's examination is revoked", () => {
    const TARGET = "WF-012";
    const steps = [
      {
        type: "REFER_TO_UNITS",
        role: "coordinator",
        unitIds: ["rph-adult-secure"],
        genderPlacementReason: GENDER_PLACEMENT_REASONS[0],
        genderPlacementChecked: true,
      },
      { type: "ACCEPT_IN_PRINCIPLE", role: "ward", unitId: "rph-adult-secure" },
      { type: "PULL_PATIENT", role: "ward", unitId: "rph-adult-secure" },
    ] as const;
    let state = seeded();
    for (const step of steps) {
      state = wardFlowReducer(state, { ...step, now: NOW, movementId: TARGET } as never);
    }

    const after = wardFlowReducer(state, {
      type: "RECORD_EXAMINATION",
      role: "ed",
      now: NOW + 1,
      movementId: TARGET,
      outcome: "revoked",
    });

    expect(after.admissions.some((candidate) => candidate.id === "AD-ARR-01")).toBe(false);
    expect(movement(after, TARGET).admissionId).toBeUndefined();
  });
});

describe("capacity confirmation", () => {
  it("writes the ward's restated allocatable count to that unit only", () => {
    const initial = seeded();
    const next = wardFlowReducer(initial, {
      type: "CONFIRM_CAPACITY",
      role: "ward",
      now: NOW,
      unitId: "rph-older-adult",
      actingUnitId: "rph-older-adult",
      value: 3,
      expectedRevision: initial.units.find((unit) => unit.id === "rph-older-adult")!.allocatable.revision ?? 0,
    });
    const unit = next.units.find((candidate) => candidate.id === "rph-older-adult")!;
    expect(unit.allocatable.value).toBe(3);
    expect(unit.allocatable.confirmedAt).toBe(NOW);
    // Untouched: a sibling unit's allocatable count must not move.
    const sibling = next.units.find((candidate) => candidate.id === "rph-adult-secure")!;
    expect(sibling.allocatable.value).toBe(1);
  });

  /**
   * Deferred item 2. The role check only proves *a* ward raised the event, not *which* ward, so a
   * ward user on one unit could restate another unit's allocatable count. The event now carries
   * the unit the caller stated it was acting as, and the reducer refuses a mismatched pair.
   *
   * This is a recorded claim, not an authenticated identity — nothing verifies that the caller
   * really is `actingUnitId`. The test therefore proves only what the reducer does: matched pair
   * writes, mismatched pair refuses and names both ids, and the target unit is left untouched.
   */
  it("refuses a confirmation raised acting as one unit but targeting another, naming both", () => {
    const before = seeded().units.find((candidate) => candidate.id === "rph-adult-secure")!.allocatable;

    const next = wardFlowReducer(seeded(), {
      type: "CONFIRM_CAPACITY",
      role: "ward",
      now: NOW,
      unitId: "rph-adult-secure",
      actingUnitId: "rph-older-adult",
      value: 7,
    });

    expect(next.rejections).toHaveLength(1);
    expect(next.rejections[0].reason).toContain("rph-older-adult");
    expect(next.rejections[0].reason).toContain("rph-adult-secure");
    expect(next.rejections[0].attempted).toBe("CONFIRM_CAPACITY");

    // Nothing was written: neither the value nor the confirmation stamp moved.
    const after = next.units.find((candidate) => candidate.id === "rph-adult-secure")!.allocatable;
    expect(after.value).toBe(before.value);
    expect(after.confirmedAt).toBe(before.confirmedAt);
    // And the unit the caller claimed to be acting as was not written to either.
    const claimed = next.units.find((candidate) => candidate.id === "rph-older-adult")!;
    expect(claimed.allocatable.value).not.toBe(7);
  });
});

describe("ward intake constraints (Answer 18, second round, 2026-09-17)", () => {
  it("writes the ward's chosen intake-constraint codes to that unit only", () => {
    const next = wardFlowReducer(seeded(), {
      type: "RECORD_WARD_INTAKE_CONSTRAINTS",
      role: "ward",
      now: NOW,
      unitId: "rph-older-adult",
      actingUnitId: "rph-older-adult",
      codes: ["staffing_shortage", "bay_or_room_closed"],
    });
    const unit = next.units.find((candidate) => candidate.id === "rph-older-adult")!;
    expect(unit.intakeConstraints).toEqual(["staffing_shortage", "bay_or_room_closed"]);
    // Untouched: a sibling unit's constraints must not move.
    const sibling = next.units.find((candidate) => candidate.id === "rph-adult-secure")!;
    expect(sibling.intakeConstraints ?? []).toEqual([]);
  });

  it("accepts an empty list as a recorded answer — nothing is currently limiting intake", () => {
    const next = wardFlowReducer(seeded(), {
      type: "RECORD_WARD_INTAKE_CONSTRAINTS",
      role: "ward",
      now: NOW,
      unitId: "rph-older-adult",
      actingUnitId: "rph-older-adult",
      codes: [],
    });
    const unit = next.units.find((candidate) => candidate.id === "rph-older-adult")!;
    expect(unit.intakeConstraints).toEqual([]);
  });

  it("refuses a code outside WARD_INTAKE_CONSTRAINTS, chosen never typed", () => {
    const next = wardFlowReducer(seeded(), {
      type: "RECORD_WARD_INTAKE_CONSTRAINTS",
      role: "ward",
      now: NOW,
      unitId: "rph-older-adult",
      actingUnitId: "rph-older-adult",
      codes: ["typed_free_text" as never],
    });
    expect(next.rejections).toHaveLength(1);
    expect(next.rejections[0].reason).toContain("WARD_INTAKE_CONSTRAINTS");
    const unit = next.units.find((candidate) => candidate.id === "rph-older-adult")!;
    expect(unit.intakeConstraints ?? []).toEqual([]);
  });

  it("refuses a confirmation raised acting as one unit but targeting another, naming both", () => {
    const next = wardFlowReducer(seeded(), {
      type: "RECORD_WARD_INTAKE_CONSTRAINTS",
      role: "ward",
      now: NOW,
      unitId: "rph-adult-secure",
      actingUnitId: "rph-older-adult",
      codes: ["staffing_shortage"],
    });
    expect(next.rejections).toHaveLength(1);
    expect(next.rejections[0].reason).toContain("rph-older-adult");
    expect(next.rejections[0].reason).toContain("rph-adult-secure");
    expect(next.rejections[0].attempted).toBe("RECORD_WARD_INTAKE_CONSTRAINTS");
    const target = next.units.find((candidate) => candidate.id === "rph-adult-secure")!;
    expect(target.intakeConstraints ?? []).toEqual([]);
  });
});

describe("decline", () => {
  it("drops the unit from the live referral and records why", () => {
    // WF-010 is seeded at destination_review, referred only to sjgm-adult-open.
    const next = wardFlowReducer(seeded(), {
      type: "DECLINE",
      role: "ward",
      now: NOW,
      movementId: "WF-010",
      unitId: "sjgm-adult-open",
      reason: "out_of_catchment",
    });
    const target = movement(next, "WF-010");
    expect(target.declines).toContainEqual({
      unitId: "sjgm-adult-open",
      at: NOW,
      reason: "out_of_catchment",
      note: undefined,
    });
    expect(target.referredUnitIds).not.toContain("sjgm-adult-open");
    expect(target.stage).toBe("destination_review");
  });
});

describe("escalation", () => {
  it("stamps what was tried and who is being contacted", () => {
    // WF-010 carries no escalation at seed time.
    const next = wardFlowReducer(seeded(), {
      type: "RECORD_ESCALATION",
      role: "coordinator",
      now: NOW,
      movementId: "WF-010",
      triedUnitIds: ["sjgm-adult-open", "rph-adult-secure"],
      contact: "State bed coordination desk",
    });
    expect(movement(next, "WF-010").escalation).toEqual({
      at: NOW,
      triedUnitIds: ["sjgm-adult-open", "rph-adult-secure"],
      contact: "State bed coordination desk",
    });
  });
});

describe("demo controls", () => {
  it("advances the clock offset by the given number of minutes", () => {
    const next = wardFlowReducer(seeded(), { type: "ADVANCE_CLOCK", role: "demo", now: NOW, minutes: 15 });
    expect(next.clockOffsetMinutes).toBe(15);
  });

  it("resets a genuinely mutated state back to the seed, not just back to itself", () => {
    let state = seeded();
    state = wardFlowReducer(state, {
      type: "REFER_TO_UNITS",
      role: "coordinator",
      now: NOW,
      movementId: "WF-009",
      unitIds: ["rph-adult-secure"],
    });
    state = wardFlowReducer(state, { type: "ADVANCE_CLOCK", role: "demo", now: NOW, minutes: 30 });
    // Sanity: the mutation actually took, so the reset below is proving something real.
    expect(movement(state, "WF-009").referredUnitIds).toEqual(["rph-adult-secure"]);
    expect(state.clockOffsetMinutes).toBe(30);

    const reset = wardFlowReducer(state, { type: "RESET_SCENARIO", role: "demo", now: NOW });
    expect(movement(reset, "WF-009").referredUnitIds).toEqual([]);
    expect(reset.clockOffsetMinutes).toBe(0);
    expect(reset.rejections).toEqual([]);
  });
});

describe("scenario selection", () => {
  it("replaces the units with the scarce night's, leaving movement ids unchanged", () => {
    const state = seeded();
    expect(state.scenario).toBe("standard");
    const standardMovementIds = state.movements.map((candidate) => candidate.id);

    const next = wardFlowReducer(state, { type: "SET_SCENARIO", role: "demo", now: NOW, scenario: "scarce" });

    expect(next.scenario).toBe("scarce");
    expect(next.movements.map((candidate) => candidate.id)).toEqual(standardMovementIds);
    // The scarce night's units are strictly tighter, not merely different — every unit's
    // allocatable count moves to 0 or 1 and specialling capacity moves to 0 (`ward-scenarios.ts`).
    expect(next.units.every((unit) => unit.allocatable.value <= 1 && unit.speciallingCapacity === 0)).toBe(true);
    expect(next.units).not.toEqual(state.units);
  });

  it("refuses SET_SCENARIO raised by a role other than demo", () => {
    const next = wardFlowReducer(seeded(), {
      type: "SET_SCENARIO",
      role: "ward",
      now: NOW,
      scenario: "scarce",
    } as never);
    expect(next.rejections).toHaveLength(1);
    expect(next.rejections[0].reason).toMatch(/role/i);
    expect(next.scenario).toBe("standard");
  });

  it("returns to the standard night on RESET_SCENARIO after SET_SCENARIO — reset is never scenario-sticky", () => {
    let state = seeded();
    state = wardFlowReducer(state, { type: "SET_SCENARIO", role: "demo", now: NOW, scenario: "scarce" });
    expect(state.scenario).toBe("scarce");

    const reset = wardFlowReducer(state, { type: "RESET_SCENARIO", role: "demo", now: NOW });
    expect(reset.scenario).toBe("standard");
  });
});

describe("arrival capacity floor", () => {
  it("refuses an arrival once the unit's physically empty beds are exhausted", () => {
    // A ward can CONFIRM_CAPACITY an allocatable count above what is physically empty — nothing
    // in PULL_PATIENT's own guard prevents that, since it only bounds `allocatable.value`. That makes
    // over-arriving a real, reachable sequence, not a hypothetical: hold and arrive one patient
    // against rph-adult-secure's single seeded allocatable bed (empty 2 -> 1), have the ward
    // restate a larger allocatable count than physically exists, then hold and arrive a second
    // patient (empty 1 -> 0), then attempt a third. The third must be refused rather than driving
    // `empty.value` negative.
    const walkToArrival = (state: ReturnType<typeof seeded>, movementId: string) => {
      const steps = [
        { type: "REFER_TO_UNITS", role: "coordinator", unitIds: ["rph-adult-secure"] },
        { type: "ACCEPT_IN_PRINCIPLE", role: "ward", unitId: "rph-adult-secure" },
        // Item 11, owner answer 11 — `rph-adult-secure` is wholly locked (20 of 20 beds), but
        // `CONFIRM_CAPACITY` below restates `allocatable.value` without touching
        // `allocatableLocked` (out of this test's own scope), so the second and third walk find no
        // locked bed on file as free even though the ward has no other kind. A reason is supplied
        // unconditionally: unused when a locked bed is free (the first walk), and what lets the
        // later walks reach `PATIENT_ARRIVED` at all, which is the guard this test is actually about.
        { type: "PULL_PATIENT", role: "ward", unitId: "rph-adult-secure", overrideReason: OVERRIDE_REASONS[0] },
        // Booking is a step of its own since 2026-08-31: `HANDOVER_READY` used to fabricate the
        // transport job and answer the escort question by deriving it from legal status. It no
        // longer invents either, so a walk that reaches handover without booking is refused.
        {
          type: "BOOK_TRANSPORT",
          role: "ed",
          provider: "Ambulance service",
          escortRequired: true,
          cadNumber: "CAD-STUB-0001",
          transportLegalStatus: "voluntary",
          estimatedAt: 0,
        },
        { type: "HANDOVER_READY", role: "ed" },
        { type: "TRANSPORT_ACCEPTED", role: "officer" },
        { type: "TRANSPORT_EN_ROUTE", role: "officer" },
        { type: "PATIENT_COLLECTED", role: "officer" },
        { type: "PATIENT_ARRIVED", role: "officer" },
      ] as const;
      let next = state;
      for (const step of steps) {
        next = wardFlowReducer(next, { ...step, now: NOW, movementId } as never);
      }
      return next;
    };

    let state = seeded();
    state = walkToArrival(state, "WF-009"); // empty 2 -> 1, allocatable 1 -> 0
    state = wardFlowReducer(state, {
      type: "CONFIRM_CAPACITY",
      role: "ward",
      now: NOW,
      unitId: "rph-adult-secure",
      actingUnitId: "rph-adult-secure",
      value: 5,
      expectedRevision: state.units.find((unit) => unit.id === "rph-adult-secure")!.allocatable.revision ?? 0,
    });
    state = walkToArrival(state, "WF-017"); // empty 1 -> 0, allocatable 5 -> 4

    const before = state.units.find((unit) => unit.id === "rph-adult-secure")!.empty.value;
    expect(before).toBe(0);

    // A third referral raised fresh, so its stage starts clean regardless of fixture state.
    const raised = wardFlowReducer(state, {
      type: "RAISE_REFERRAL",
      role: "ed",
      now: NOW,
      edId: "jhc-ed",
      draft: {
        cohort: "Adult",
        security: "Secure",
        sex: "Male",
        gender: "Male", // R7 (2026-09-25): record gender so the walk needs no coordinator review
        specialling: false,
        highAcuity: false,
        legalStatus: "Voluntary",
        urgency: 3,
        legalFormCode: null,
      },
    });
    const thirdId = raised.movements[raised.movements.length - 1].id;
    const final = walkToArrival(raised, thirdId);

    expect(movement(final, thirdId).stage).toBe("arrived");
    expect(movement(final, thirdId).blocker).toBe("Arrived — Bed Turnaround");
    const after = final.units.find((unit) => unit.id === "rph-adult-secure")!;
    expect(final.rejections.some((rejection) => rejection.attempted === "PATIENT_ARRIVED")).toBe(false);
    expect(after.empty.value).toBe(0);
    const pulledAdm = final.admissions.find((a) => a.id === movement(final, thirdId).admissionId);
    expect(pulledAdm).toBeDefined();
    expect(pulledAdm?.state).toBe("occupied");
    expect(pulledAdm?.blockReason).toBe("Awaiting clean");
  });
});

describe("urgency and legal status changes (Task 2)", () => {
  it("records an urgency change with who made it, from both permitted roles", () => {
    const seeded = seedWardFlowState();
    const target = seeded.movements.find((candidate) => candidate.urgency !== 1)!;
    const after = wardFlowReducer(seeded, {
      type: "CHANGE_URGENCY",
      role: "coordinator",
      now: NOW,
      movementId: target.id,
      urgency: 1,
      reason: "reassessed",
    });
    const updated = after.movements.find((candidate) => candidate.id === target.id)!;
    expect(updated.urgency).toBe(1);
    expect(updated.urgencyChanges).toHaveLength(1);
    expect(updated.urgencyChanges[0]).toMatchObject({
      from: target.urgency,
      to: 1,
      by: "coordinator",
      reason: "reassessed",
    });
    expect(after.rejections).toHaveLength(0);

    const fromEd = wardFlowReducer(seeded, {
      type: "CHANGE_URGENCY",
      role: "ed",
      now: NOW,
      movementId: target.id,
      urgency: 1,
      reason: "reassessed",
    });
    expect(fromEd.rejections).toHaveLength(0);
  });

  it("refuses an urgency change from a role that may not make one", () => {
    const seeded = seedWardFlowState();
    const target = seeded.movements[0];
    const after = wardFlowReducer(seeded, {
      type: "CHANGE_URGENCY",
      role: "officer",
      now: NOW,
      movementId: target.id,
      urgency: 1,
      reason: "reassessed",
    });
    expect(after.rejections).toHaveLength(1);
    expect(after.movements.find((candidate) => candidate.id === target.id)!.urgency).toBe(target.urgency);
  });

  it("records a legal status change and never re-sorts or un-accepts the patient", () => {
    const seeded = seedWardFlowState();

    // The brief's literal precondition (legalStatus === "Voluntary" && acceptedUnitId !==
    // undefined) is satisfied by three fixture movements — WF-007, WF-008 and WF-015 — but the
    // first two are both CLOSED (WF-007 "arrived", WF-008 "did_not_proceed") and sort earlier in
    // fixture array order than WF-015, the only OPEN one. A naive `.find()` over just those two
    // fields would therefore resolve to a closed movement, exercising the closed-movement
    // rejection path rather than the success path this test is about — a trap in the fixture's
    // own ordering, not a defect in the reducer. Constructed explicitly instead, from a real open
    // Voluntary movement (WF-002) with `acceptedUnitId` set directly, so the outcome never
    // depends on which movement the fixture happens to put first.
    const base = seeded.movements.find((candidate) => candidate.id === "WF-002")!;
    const withAcceptedUnit = { ...base, legalStatus: "Voluntary" as const, acceptedUnitId: "fsh-older-adult" };
    const seededWithAcceptedVoluntary = {
      ...seeded,
      movements: seeded.movements.map((candidate) =>
        candidate.id === withAcceptedUnit.id ? withAcceptedUnit : candidate,
      ),
    };

    const after = wardFlowReducer(seededWithAcceptedVoluntary, {
      type: "CHANGE_LEGAL_STATUS",
      role: "ed",
      now: NOW,
      movementId: withAcceptedUnit.id,
      legalStatus: "Involuntary inpatient",
      reason: "recorded_by_treating_team",
    });
    const updated = after.movements.find((candidate) => candidate.id === withAcceptedUnit.id)!;
    expect(updated.legalStatus).toBe("Involuntary inpatient");
    expect(updated.statusChanges).toHaveLength(1);
    expect(updated.statusChanges[0]).toMatchObject({
      from: "Voluntary",
      to: "Involuntary inpatient",
      by: "ed",
    });
    // Nothing auto-allocates: the accepted unit, the stage and the referrals are untouched.
    expect(updated.acceptedUnitId).toBe(withAcceptedUnit.acceptedUnitId);
    expect(updated.stage).toBe(withAcceptedUnit.stage);
    expect(updated.referredUnitIds).toEqual(withAcceptedUnit.referredUnitIds);
  });

  it("refuses both changes on a closed movement, naming the closure reason", () => {
    const seeded = seedWardFlowState();
    const target = seeded.movements[0];
    const closed = {
      ...seeded,
      movements: seeded.movements.map((candidate) =>
        candidate.id === target.id
          ? { ...candidate, closure: { at: NOW, outcome: "arrived" as const, reason: "arrived at unit" } }
          : candidate,
      ),
    };
    const after = wardFlowReducer(closed, {
      type: "CHANGE_URGENCY",
      role: "coordinator",
      now: NOW,
      movementId: target.id,
      urgency: 1,
      reason: "reassessed",
    });
    expect(after.rejections).toHaveLength(1);
    expect(after.rejections[0].reason).toContain("arrived at unit");
  });
});

/**
 * Task 3, spec item 10 — the undo the prototype has never had. Before this, the only path that
 * released a held bed or cancelled a transport job was closing the movement outright, by
 * recording an examination with outcome `community_order` or `revoked`.
 */
describe("release and cancel", () => {
  it("releases a held bed back to allocatable and returns the movement to accepted_awaiting_bed", () => {
    const seeded = seedWardFlowState();
    const movement = seeded.movements.find((candidate) => candidate.stage === "pulled")!;
    const unitBefore = seeded.units.find((candidate) => candidate.id === movement.acceptedUnitId)!;
    const after = wardFlowReducer(seeded, {
      type: "RELEASE_PULL",
      role: "coordinator",
      now: NOW_ANCHOR,
      movementId: movement.id,
      reason: "pull_made_in_error",
    });
    const updated = after.movements.find((candidate) => candidate.id === movement.id)!;
    const unitAfter = after.units.find((candidate) => candidate.id === movement.acceptedUnitId)!;
    expect(updated.stage).toBe("accepted_awaiting_bed");
    expect(updated.pullExpiresAt).toBeUndefined();
    expect(unitAfter.allocatable.value).toBe(unitBefore.allocatable.value + 1);
    // The movement survives, keeps its acceptance, and is not re-referred anywhere.
    expect(updated.closure).toBeUndefined();
    expect(updated.acceptedUnitId).toBe(movement.acceptedUnitId);
    expect(updated.legalForm).toEqual(movement.legalForm);
    expect(updated.unwinds.at(-1)).toMatchObject({ kind: "pull_released", by: "coordinator" });
  });

  it("🔴 refuses a reason that is not in RELEASE_PULL_REASONS — the check this event went without", () => {
    /*
     * 🔴 **THE LAST OF FIVE, AND FOUND BY A TYPE ERROR NO TEST COULD SEE.** `DECLINE_REFERRAL`,
     * `CANCEL_TRANSPORT`, `STEP_BACK_STAGE` and `WITHDRAW_ACCEPTANCE` all check their reason list
     * at runtime. `RELEASE_PULL` — the oldest of the five — did not, and accepted
     * `"bed_needed_for_a_more_urgent_patient"`, which is not a member. **Every test passed, because
     * `vitest run` involves no `tsc`.**
     *
     * ⚠️ **THE CONSEQUENCE WAS SILENT, WHICH IS WHY IT SURVIVED.** The bogus value is written into
     * `stageChanges` and `unwinds`, reaches the audit timeline, and `stageChangeReasonLabel` finds
     * no map holding it — so the line renders the fact with NO reason, **indistinguishable from an
     * act nobody gave a reason for.** The record quietly loses why a ward gave a bed back.
     *
     * The cast is what a JavaScript caller does for free; it is the situation being tested, not a
     * shortcut around the type.
     */
    const seeded = seedWardFlowState();
    const movement = seeded.movements.find((candidate) => candidate.stage === "pulled")!;
    const unitBefore = seeded.units.find((candidate) => candidate.id === movement.acceptedUnitId)!;
    const after = wardFlowReducer(seeded, {
      type: "RELEASE_PULL",
      role: "coordinator",
      now: NOW_ANCHOR,
      movementId: movement.id,
      reason: "bed_needed_for_a_more_urgent_patient",
    } as unknown as WardFlowEvent);

    expect(after.rejections).toHaveLength(1);
    expect(after.rejections[0]?.reason).toContain("RELEASE_PULL reason must be chosen from RELEASE_PULL_REASONS");

    // ⚠️ Refused means NOTHING happened, not merely that a rejection was logged. The bed must not
    // have gone back and the stage must not have moved — a check that recorded a complaint and
    // performed the release anyway would pass on the rejection count alone.
    const updated = after.movements.find((candidate) => candidate.id === movement.id)!;
    const unitAfter = after.units.find((candidate) => candidate.id === movement.acceptedUnitId)!;
    expect(updated.stage).toBe("pulled");
    expect(updated.unwinds).toEqual(movement.unwinds);
    expect(unitAfter.allocatable.value).toBe(unitBefore.allocatable.value);
  });

  it("control: every member of RELEASE_PULL_REASONS is still accepted", () => {
    /*
     * ⚠️ **WITHOUT THIS, A CHECK THAT REFUSED EVERYTHING WOULD PASS THE TEST ABOVE.** A guard that
     * blocks its own purpose is the failure mode of a membership check added late — and this one
     * was added to an event that had shipped without it, so every existing caller must still work.
     */
    for (const reason of RELEASE_PULL_REASONS) {
      const seeded = seedWardFlowState();
      const movement = seeded.movements.find((candidate) => candidate.stage === "pulled")!;
      const after = wardFlowReducer(seeded, {
        type: "RELEASE_PULL",
        role: "coordinator",
        now: NOW_ANCHOR,
        movementId: movement.id,
        reason,
      });
      expect(after.rejections, `"${reason}" is a member and was refused`).toHaveLength(0);
      expect(after.movements.find((candidate) => candidate.id === movement.id)!.stage).toBe("accepted_awaiting_bed");
    }
    // The floor: this looped over something.
    expect(RELEASE_PULL_REASONS.length).toBeGreaterThan(1);
  });

  it("refuses a release once the patient is handover_ready or moving", () => {
    const seeded = seedWardFlowState();
    const movement = seeded.movements.find((candidate) => candidate.stage === "moving")!;
    const after = wardFlowReducer(seeded, {
      type: "RELEASE_PULL",
      role: "coordinator",
      now: NOW_ANCHOR,
      movementId: movement.id,
      reason: "pull_made_in_error",
    });
    expect(after.rejections).toHaveLength(1);
    expect(after.movements.find((candidate) => candidate.id === movement.id)!.stage).toBe("moving");
  });

  it("refuses a ward caller acting as a unit that is not holding the bed, naming both ids", () => {
    const seeded = seedWardFlowState();
    const movement = seeded.movements.find((candidate) => candidate.stage === "pulled")!;
    const otherUnit = seeded.units.find((candidate) => candidate.id !== movement.acceptedUnitId)!;
    const after = wardFlowReducer(seeded, {
      type: "RELEASE_PULL",
      role: "ward",
      now: NOW_ANCHOR,
      movementId: movement.id,
      actingUnitId: otherUnit.id,
      reason: "ward_withdrew_the_bed",
    });
    expect(after.rejections).toHaveLength(1);
    expect(after.rejections[0].reason).toContain(otherUnit.id);
    expect(after.rejections[0].reason).toContain(movement.acceptedUnitId!);
  });

  it("cancels a transport job without closing the movement, and a person can book again from handover_ready", () => {
    // REWRITTEN 2026-09-17, owner answer 30 (build plan item 30): "no automatic rebooking; a
    // person books again." This test used to pin the opposite — that CANCEL_TRANSPORT installed a
    // fresh replacement job while a bed was held, minted with a new id, ready to be accepted
    // outright. See tests/ward-transport-cancel-no-rebook.test.ts for the full suite; this case
    // keeps the original seeded-fixture walk (rather than a hand-built one) as its own regression
    // coverage that a seeded, already-in-flight job cancels cleanly too.
    const seeded = seedWardFlowState();
    const movement = seeded.movements.find(
      (candidate) =>
        candidate.transport !== undefined &&
        candidate.transport.cancelledAt === undefined &&
        candidate.transport.collectedAt === undefined,
    )!;
    const originalProvider = movement.transport!.provider;
    const originalEscortRequired = movement.transport!.escortRequired;
    const after = wardFlowReducer(seeded, {
      type: "CANCEL_TRANSPORT",
      role: "coordinator",
      now: NOW_ANCHOR,
      movementId: movement.id,
      reason: "provider_unavailable",
    });
    const updated = after.movements.find((candidate) => candidate.id === movement.id)!;
    expect(updated.transport).toBeUndefined();
    expect(updated.closure).toBeUndefined();
    expect(updated.stage).toBe("handover_ready");
    expect(updated.blocker).toBe("Transport cancelled; not booked again yet");
    expect(updated.unwinds.at(-1)).toMatchObject({ kind: "transport_cancelled", transportId: movement.transport?.id });

    // A person books again — BOOK_TRANSPORT now works from handover_ready, the widening this same
    // owner answer requires (see that case's own comment).
    const rebooked = wardFlowReducer(after, {
      type: "BOOK_TRANSPORT",
      role: "ed",
      now: NOW_ANCHOR + 1,
      movementId: movement.id,
      provider: originalProvider,
      escortRequired: originalEscortRequired,
      cadNumber: "CAD-STUB-0001",
      transportLegalStatus: "voluntary",
      estimatedAt: 0,
    });
    expect(rebooked.rejections).toEqual([]);
    const rebookedJob = rebooked.movements.find((candidate) => candidate.id === movement.id)!.transport;
    expect(rebookedJob?.id).toBeDefined();
    expect(rebookedJob?.id).not.toBe(movement.transport?.id);

    const reaccepted = wardFlowReducer(rebooked, {
      type: "TRANSPORT_ACCEPTED",
      role: "officer",
      now: NOW_ANCHOR + 2,
      movementId: movement.id,
    });
    expect(reaccepted.rejections).toEqual([]);
    expect(reaccepted.movements.find((candidate) => candidate.id === movement.id)!.transport?.acceptedAt).toBe(
      NOW_ANCHOR + 2,
    );
  });

  it("refuses cancellation after collection so the in-flight patient can still arrive", () => {
    const movementId = "WF-012";
    const steps = [
      {
        type: "REFER_TO_UNITS",
        role: "coordinator",
        unitIds: ["rph-adult-secure"],
        genderPlacementReason: GENDER_PLACEMENT_REASONS[0],
        genderPlacementChecked: true,
      },
      { type: "ACCEPT_IN_PRINCIPLE", role: "ward", unitId: "rph-adult-secure" },
      { type: "PULL_PATIENT", role: "ward", unitId: "rph-adult-secure" },
      // Booking is a step of its own since 2026-08-31: `HANDOVER_READY` used to fabricate the
      // transport job and answer the escort question by deriving it from legal status. It no
      // longer invents either, so a walk that reaches handover without booking is refused.
      {
        type: "BOOK_TRANSPORT",
        role: "ed",
        provider: "Ambulance service",
        escortRequired: true,
        cadNumber: "CAD-STUB-0001",
        transportLegalStatus: "voluntary",
        estimatedAt: 0,
      },
      { type: "HANDOVER_READY", role: "ed" },
      { type: "TRANSPORT_ACCEPTED", role: "officer" },
      { type: "TRANSPORT_EN_ROUTE", role: "officer" },
      { type: "PATIENT_COLLECTED", role: "officer" },
    ] as const;
    let inFlight = seedWardFlowState();
    for (const step of steps) {
      inFlight = wardFlowReducer(inFlight, { ...step, now: NOW_ANCHOR, movementId } as never);
    }
    expect(inFlight.rejections).toEqual([]);

    const cancelled = wardFlowReducer(inFlight, {
      type: "CANCEL_TRANSPORT",
      role: "coordinator",
      now: NOW_ANCHOR + 1,
      movementId,
      reason: "provider_unavailable",
    });
    expect(cancelled.rejections.at(-1)?.reason).toContain("patient has departed");
    expect(cancelled.movements.find((candidate) => candidate.id === movementId)!.stage).toBe("moving");

    const arrived = wardFlowReducer(cancelled, {
      type: "PATIENT_ARRIVED",
      role: "officer",
      now: NOW_ANCHOR + 2,
      movementId,
    });
    expect(arrived.movements.find((candidate) => candidate.id === movementId)!.stage).toBe("arrived");
  });
});

/**
 * Task 11 (spec item 9). Bed releases move from a frozen fixture constant into reducer state so a
 * ward can flag its own bed coming free, and `unitCapacity()`'s `potential` figure actually moves
 * when it does. `FLAG_BED_RELEASE` is `ward`-only (see `EVENT_ROLE.FLAG_BED_RELEASE` in
 * `ward-flow-events.ts`), so unlike `RELEASE_PULL`/`CANCEL_TRANSPORT` there is no coordinator
 * caller to exempt — `actingUnitId` is always required and always compared against `unitId`,
 * exactly like `CONFIRM_CAPACITY`.
 */
describe("bed release flagging", () => {
  /**
   * Bed-model rework (2026-08-28). This used to assert the flagged release came out in the fourth
   * state `"blocked"` with a null waiting-on value. There is no such state now: a flag always creates a
   * PREDICTED release, and naming a blocker sets the blocked flag on it. That is the whole change
   * — a bed coming free but currently held up is a prediction AND a block, and pretending those
   * were alternatives is what let `capacityBreakdown` count such a release nowhere at all.
   */
  it("appends a expected release carrying the blocked flag for the acting unit, and increases that unit's potential by one", () => {
    const seeded = seedWardFlowState();
    const unit = seeded.units[0];
    const sibling = seeded.units[1];
    const potentialBefore = unitCapacity(unit, seeded.bedReleases).potential;
    const siblingPotentialBefore = unitCapacity(sibling, seeded.bedReleases).potential;

    // Fix round 2 (P1): `expectedAt` deliberately differs from `NOW` here so this test actually
    // proves the fix — before the fix the reducer discarded `event.expectedAt` entirely and
    // always stamped `event.now`, so a test using the same value for both could never have
    // caught it.
    const EXPECTED_FREE = NOW + 90;
    const after = wardFlowReducer(seeded, {
      type: "FLAG_BED_RELEASE",
      role: "ward",
      now: NOW,
      unitId: unit.id,
      actingUnitId: unit.id,
      // The event type requires `admissionId` (owner decision 2026-09-25); the reducer under test
      // here predates that field and does not yet read it, so any real admission id satisfies the
      // type without changing what this test proves.
      // An occupant with no live release yet: FLAG_BED_RELEASE refuses a second live release per stay.
      admissionId: seeded.admissions.find(
        (a) =>
          a.unitId === unit.id &&
          a.state === "occupied" &&
          !seeded.bedReleases.some((r) => r.admissionId === a.id && r.state !== "discharged"),
      )!.id,
      waitingOn: "Awaiting ward round",
      expectedAt: EXPECTED_FREE,
      blocker: "Awaiting clean",
    });

    expect(after.rejections).toEqual([]);
    expect(after.bedReleases.length).toBe(seeded.bedReleases.length + 1);
    const flagged = after.bedReleases.at(-1)!;
    expect(flagged.unitId).toBe(unit.id);
    // The stage says how certain the discharge is; the flag says whether it is stuck. Both, at
    // once, on one release — which the four-stage model could not express.
    expect(flagged.state).toBe("expected");
    expect(flagged.waitingOn).toBe("Awaiting ward round");
    expect(flagged.blocker).toBe("Awaiting clean");
    // The role that recorded the block, never a person (Q3).
    expect(flagged.blockedBy).toBe(`NUM ${unit.name}`);
    // A bed nobody has left yet is not being made ready.
    expect(flagged.preparing).toBe(false);
    expect(flagged.preparationNote).toBeNull();
    // `confirmedAt` is when the ward REPORTED this (event.now); `expectedAt` is the ward's own
    // estimate of when the bed will be free (event.expectedAt) — the two are genuinely different
    // facts and must not collapse onto the same value.
    expect(flagged.confirmedAt).toBe(NOW);
    expect(flagged.expectedAt).toBe(EXPECTED_FREE);

    const unitAfter = after.units.find((candidate) => candidate.id === unit.id)!;
    expect(unitCapacity(unitAfter, after.bedReleases).potential).toBe(potentialBefore + 1);
    // Untouched: a sibling unit's own potential count must not move.
    const siblingAfter = after.units.find((candidate) => candidate.id === sibling.id)!;
    expect(unitCapacity(siblingAfter, after.bedReleases).potential).toBe(siblingPotentialBefore);
  });

  it("flagging with an expected time later today lands in the correct planning band, not 'now' (Finding 1, spec D5)", () => {
    // Before the fix, `expectedAt` was stamped from `event.now` (the report instant), so
    // `releaseBand()` always classified a runtime-flagged release as "now" — the four planning
    // bands only ever worked for hand-authored fixture data. `NOW + 90` (732) lands strictly
    // between MIDDAY_MINUTES (720) and LATE_AFTERNOON_MINUTES (960), which `releaseBand()` bands
    // "by-1600" — a value the old, `event.now`-only code could never produce.
    const seeded = seedWardFlowState();
    const unit = seeded.units[0];
    const laterToday = NOW + 90;

    const after = wardFlowReducer(seeded, {
      type: "FLAG_BED_RELEASE",
      role: "ward",
      now: NOW,
      unitId: unit.id,
      actingUnitId: unit.id,
      // An occupant with no live release yet: FLAG_BED_RELEASE refuses a second live release per stay.
      admissionId: seeded.admissions.find(
        (a) =>
          a.unitId === unit.id &&
          a.state === "occupied" &&
          !seeded.bedReleases.some((r) => r.admissionId === a.id && r.state !== "discharged"),
      )!.id,
      waitingOn: "Awaiting ward round",
      expectedAt: laterToday,
    });

    const flagged = after.bedReleases.at(-1)!;
    expect(flagged.expectedAt).toBe(laterToday);
    // ⚠️ `releaseBand` reads only its two arguments, so both calls return the same value and
    // the negative could not report after the exact `.toBe`. "Not now" is the clinically
    // meaningful half — a release banded as immediate when it is not is what misleads a
    // coordinator — so it leads.
    expect(releaseBand(flagged, NOW)).not.toBe("now");
    expect(releaseBand(flagged, NOW)).toBe("by-1600");
  });

  it("appends a expected release when no blocker is given", () => {
    const seeded = seedWardFlowState();
    const unit = seeded.units[0];

    const after = wardFlowReducer(seeded, {
      type: "FLAG_BED_RELEASE",
      role: "ward",
      now: NOW,
      unitId: unit.id,
      actingUnitId: unit.id,
      // An occupant with no live release yet: FLAG_BED_RELEASE refuses a second live release per stay.
      admissionId: seeded.admissions.find(
        (a) =>
          a.unitId === unit.id &&
          a.state === "occupied" &&
          !seeded.bedReleases.some((r) => r.admissionId === a.id && r.state !== "discharged"),
      )!.id,
      waitingOn: "Awaiting ward round",
      expectedAt: NOW + 60,
    });

    expect(after.rejections).toEqual([]);
    const flagged = after.bedReleases.at(-1)!;
    expect(flagged.state).toBe("expected");
    expect(flagged.waitingOn).toBe("Awaiting ward round");
    expect(flagged.blocker).toBeNull();
    // No blocker means no blocking role either — the two move together in both directions.
    expect(flagged.blockedBy).toBeNull();
    expect(flagged.expectedAt).toBe(NOW + 60);
  });

  it("refuses a flag raised acting as one unit but targeting another, naming both", () => {
    const seeded = seedWardFlowState();
    const unit = seeded.units[0];
    const otherUnit = seeded.units[1];

    const after = wardFlowReducer(seeded, {
      type: "FLAG_BED_RELEASE",
      role: "ward",
      now: NOW,
      unitId: unit.id,
      actingUnitId: otherUnit.id,
      admissionId: seeded.admissions.find((a) => a.unitId === unit.id && a.state === "occupied")!.id,
      waitingOn: "Nothing outstanding",
      expectedAt: NOW + 60,
      blocker: "Awaiting pharmacy",
    });

    expect(after.rejections).toHaveLength(1);
    expect(after.rejections[0].reason).toContain(otherUnit.id);
    expect(after.rejections[0].reason).toContain(unit.id);
    expect(after.rejections[0].attempted).toBe("FLAG_BED_RELEASE");
    // Nothing was written: no release was appended for either unit.
    expect(after.bedReleases).toEqual(seeded.bedReleases);
  });

  it("refuses a coordinator caller", () => {
    const seeded = seedWardFlowState();
    const unit = seeded.units[0];

    const after = wardFlowReducer(seeded, {
      type: "FLAG_BED_RELEASE",
      role: "coordinator",
      now: NOW,
      unitId: unit.id,
      actingUnitId: unit.id,
      admissionId: seeded.admissions.find((a) => a.unitId === unit.id && a.state === "occupied")!.id,
      waitingOn: "Nothing outstanding",
      expectedAt: NOW + 60,
      blocker: "Awaiting service coordination",
    });

    expect(after.rejections).toHaveLength(1);
    expect(after.rejections[0].reason).toMatch(/role/i);
    expect(after.bedReleases).toEqual(seeded.bedReleases);
  });

  it("refuses a blocker outside BED_RELEASE_BLOCKERS, not just an empty one (review Finding 1)", () => {
    // Review Finding 1: the reducer's own runtime guard was a truthiness test
    // (`event.blocker !== undefined`, no membership check), so any non-empty string reached this
    // far. A typed caller cannot construct this event with an arbitrary `blocker` — the invalid
    // event is constructed only for this runtime-refusal test, never by widening the event type
    // itself, mirroring `ward-bed-release-lifecycle.test.ts`'s "no blocker" case.
    const seeded = seedWardFlowState();
    const unit = seeded.units[0];

    const invalidEvent = {
      type: "FLAG_BED_RELEASE",
      role: "ward",
      now: NOW,
      unitId: unit.id,
      actingUnitId: unit.id,
      waitingOn: "Nothing outstanding",
      expectedAt: NOW + 60,
      blocker: "Family unavailable to collect",
    } as unknown as WardFlowEvent;

    const after = wardFlowReducer(seeded, invalidEvent);

    expect(after.rejections).toHaveLength(1);
    expect(after.rejections[0].attempted).toBe("FLAG_BED_RELEASE");
    expect(after.bedReleases).toEqual(seeded.bedReleases);
  });
});

/**
 * Task 11's privacy rule, from the binding spec §4, is unconditional: a bed release carries
 * nothing whatsoever about the departing patient — no identifier, no timing that could identify
 * them, no reason relating to them. `BedRelease` is a compile-time-only TypeScript type, so
 * nothing can introspect it directly at runtime; the strongest available proof is structural
 * against every REAL instance this reducer or fixture can produce — checked as an ALLOWLIST of
 * the exact field set, not a denylist of forbidden names. A denylist (as
 * `tests/ward-model.test.ts`'s existing "flags bed releases without any departing-patient detail"
 * test already is, checking for `name`/`mrn`/`diagnosis` and a handful of forbidden substrings)
 * can only catch a field whose NAME was anticipated. This allowlist instead fails on ANY
 * unexpected field, of any name, which is what "no field capable of carrying a patient reference"
 * actually requires — a reviewer must extend this list deliberately before a new field can ship.
 */
describe("bed release privacy", () => {
  it("gives every BedRelease exactly the allowed field set — fixture and reducer-produced alike", () => {
    const ALLOWED_BED_RELEASE_FIELDS = [
      "id",
      "unitId",
      // Owner decision 2026-09-25: a bed release names the admission it belongs to
      // (`BedRelease.admissionId`) — a join key, never a display field. See that field's own doc
      // comment in `ward-model.ts`.
      "admissionId",
      "state",
      "expectedAt",
      "waitingOn",
      "blocker",
      // Added by the bed-model rework (2026-08-28), and each extended here deliberately, which is
      // exactly what this allowlist is for. `blockedBy` is a ROLE — a unit or service label,
      // never a personal name (Q3). `preparing`/`preparationNote` describe the BED being made
      // ready (Q4). None of the three can carry a fact about the departing patient.
      "blockedBy",
      "preparing",
      "preparationNote",
      "confirmedAt",
      "confirmedBy",
    ].sort();

    const seeded = seedWardFlowState();
    const flagged = wardFlowReducer(seeded, {
      type: "FLAG_BED_RELEASE",
      role: "ward",
      now: NOW,
      unitId: seeded.units[0].id,
      actingUnitId: seeded.units[0].id,
      admissionId: seeded.admissions.find((a) => a.unitId === seeded.units[0].id && a.state === "occupied")!.id,
      waitingOn: "Awaiting ward round",
      expectedAt: NOW + 60,
      blocker: "Awaiting clean",
    });
    const reducerProduced = flagged.bedReleases.at(-1)!;

    // Non-vacuity: this must actually inspect both a fixture-seeded release AND a fresh
    // reducer-produced one, never silently degrade to checking only one source.
    expect(seeded.bedReleases.length).toBeGreaterThan(0);
    const everyRelease = [...seeded.bedReleases, reducerProduced];
    for (const release of everyRelease) {
      expect(Object.keys(release).sort()).toEqual(ALLOWED_BED_RELEASE_FIELDS);
    }
  });
});
