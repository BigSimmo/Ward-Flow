import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";

import { INSTANT_FIELDS, shiftInstants } from "@/components/ward-management/ward-reanchor";
import {
  seedWardFlowState,
  seedWardFlowStateAt,
  wardFlowReducer,
} from "@/components/ward-management/ward-flow-reducer";
import { COMMUNITY_TEAM_PAGES } from "@/components/ward-management/community/community-derivations";
import type { CareChange } from "@/components/ward-management/ward-care-journey";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * ⚠️ **TWO FILES, AND THE SECOND ONE IS WHY THIS GUARD WAS WORTHLESS FOR MONTHS.** It scanned
 * `ward-model.ts` alone, and `Admission` lives in `ward-admissions.ts` — a file `ward-model.ts` does
 * not even import. So this test agreed with itself about a set that was missing six of the seven
 * instants on `Admission`, stayed green throughout, and a patient two hours in an emergency
 * department rendered as fifteen. A guard that reads the wrong file is not a weak guard; it is a
 * guard that cannot fail.
 *
 * Any file declaring `Instant` fields that reach the reducer state belongs in this list.
 */
const MODEL_FILES = [
  "src/components/ward-management/ward-model.ts",
  "src/components/ward-management/ward-admissions.ts",
  "src/components/ward-management/ward-care-journey.ts",
  "src/components/ward-management/ward-audit.ts",
  "src/components/ward-management/alerts/ward-broadcast-model.ts",
  // D-38: the community treatment order on the patient record holds instants too.
  "src/components/ward-management/ward-patients.ts",
];

/**
 * The re-anchor must move EVERY point in time and nothing else.
 *
 * WHY THIS EXISTS. `shiftInstants` moves fields by NAME, which is only safe while the name list
 * matches the model. Add an `Instant` field to `ward-model.ts` and forget this list and the fixture
 * ships with one timestamp still on the old anchor - and nothing goes red, because every other
 * screen agrees with itself. A clinician reads a single wrong time as bad data rather than as a
 * bug, which is the worst kind of failure this prototype can have.
 *
 * The expected set is DERIVED FROM THE MODEL'S OWN DECLARATIONS rather than hand-listed twice.
 * That is normally how a check that cannot fail gets built, and it is safe here for the same reason
 * `ward-flow-data-boundary.test.ts` gives: the model is the SUBJECT, and the claim is about a
 * different file's list agreeing with it. If a field is renamed this follows the rename and keeps
 * checking the same property; if one is added, it goes red until somebody decides.
 */
function isInstantType(type: ts.TypeNode): boolean {
  if (ts.isUnionTypeNode(type)) {
    const parts = type.types.filter(
      (member) =>
        member.kind !== ts.SyntaxKind.UndefinedKeyword &&
        !(ts.isLiteralTypeNode(member) && member.literal.kind === ts.SyntaxKind.NullKeyword),
    );
    return parts.length > 0 && parts.every(isInstantType);
  }
  return ts.isTypeReferenceNode(type) && ts.isIdentifier(type.typeName) && type.typeName.text === "Instant";
}

function declaredInstantFields(): Set<string> {
  const found = new Set<string>();
  const visit = (node: ts.Node): void => {
    if (ts.isPropertySignature(node) && node.type && ts.isIdentifier(node.name)) {
      // The property's own type must BE an Instant, not merely CONTAIN one. Matching the type's
      // TEXT instead caught `escalation`, `examination`, `localBedSought` and `withdrawnReferrals`
      // - containers whose inline object types have an `at: Instant` inside them. Adding those
      // four to INSTANT_FIELDS would have turned this red green while making the shift try to add
      // a number to an object, which the typeof check in `shift` quietly declines to do: a repair
      // that satisfies the guard and does nothing. The nested `at` is found on its own by the
      // recursive walk below, which is why being strict here loses nothing.
      if (isInstantType(node.type)) found.add(node.name.text);
    }
    ts.forEachChild(node, visit);
  };
  for (const file of MODEL_FILES) {
    visit(ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true));
  }
  return found;
}

describe("re-anchoring moves every instant and nothing else", () => {
  it("shifts capture start once at a nonzero offset and reset after clock advance", () => {
    const state = seedWardFlowStateAt(137);
    expect(state.auditCaptureStartedAt).toBe(NOW_ANCHOR + 137);
    const advanced = wardFlowReducer(state, {
      type: "ADVANCE_CLOCK",
      role: "demo",
      now: NOW_ANCHOR + 137,
      minutes: 45,
    });
    const reset = wardFlowReducer(advanced, { type: "RESET_SCENARIO", role: "demo", now: NOW_ANCHOR + 137 + 45 });
    expect(reset.auditCaptureStartedAt).toBe(NOW_ANCHOR + 137);
    expect(reset.worldGeneration).toBe(1);
    expect(reset.auditSequence).toBe(0);
    expect(reset.auditReviewSequence).toBe(0);
    expect(reset.dischargeRevisions).toEqual({});
    expect(reset.auditEvents).toEqual([]);
    expect(reset.auditReviews).toEqual([]);
  });
  it("knows what it is checking, so it cannot pass by scanning nothing", () => {
    // The canary. Both assertions below pass by finding agreement, which reads identically to two
    // empty sets or a file that failed to parse.
    expect(INSTANT_FIELDS.size).toBeGreaterThan(10);
    expect(declaredInstantFields().size).toBeGreaterThan(10);
  });

  it("shifts exactly the field names the model declares as instants", () => {
    expect(
      [...declaredInstantFields()].sort(),
      "ward-model.ts declares a different set of Instant fields than ward-reanchor.ts shifts. A " +
        "field the model calls an Instant and this list omits stays on the OLD anchor when the " +
        "demo clock re-anchors, so one timestamp on one screen disagrees with every other and " +
        "nothing goes red. Add it to INSTANT_FIELDS - or, if it is genuinely a duration rather " +
        "than a point in time, say so here beside clockOffsetMinutes rather than leaving the two " +
        "lists silently different.",
    ).toEqual([...INSTANT_FIELDS].sort());
  });

  it("moves both D-34 pause and producer-recorded re-clearance times while preserving their interval", () => {
    let state = seedWardFlowState();
    state = wardFlowReducer(state, {
      type: "RAISE_REFERRAL",
      role: "ed",
      now: NOW_ANCHOR,
      edId: "jhc-ed",
      draft: {
        cohort: "Adult",
        security: "Open",
        sex: "Female",
        gender: "Female",
        specialling: false,
        highAcuity: false,
        legalStatus: "Voluntary",
        urgency: 2,
        legalFormCode: null,
      },
    });
    const movementId = state.movements.at(-1)!.id;
    state = wardFlowReducer(state, {
      type: "REFER_TO_UNITS",
      role: "coordinator",
      now: NOW_ANCHOR,
      movementId,
      unitIds: ["scgh-adult-open"],
    });
    state = wardFlowReducer(state, {
      type: "ACCEPT_IN_PRINCIPLE",
      role: "ward",
      now: NOW_ANCHOR,
      movementId,
      unitId: "scgh-adult-open",
    });
    state = wardFlowReducer(state, {
      type: "RECORD_ED_MEDICAL_DETERIORATION",
      role: "ed",
      now: NOW_ANCHOR,
      movementId,
      actingPlaceId: "jhc-ed",
    });
    state = wardFlowReducer(state, {
      type: "RECORD_MOVEMENT_MEDICAL_CLEARANCE",
      role: "ed",
      now: NOW_ANCHOR + 15,
      movementId,
      cleared: true,
    });
    expect(state.rejections).toEqual([]);
    const before = state.movements.at(-1)!.medicalDeterioration!;
    expect(before.resumedAt).toBe(NOW_ANCHOR + 15);
    const after = shiftInstants(state, 137).movements.at(-1)!.medicalDeterioration!;
    expect(after.at).toBe(before.at + 137);
    expect(after.resumedAt).toBe(before.resumedAt! + 137);
    expect(after.resumedAt! - after.at).toBe(15);
  });

  it("preserves every relative offset, which is the whole property", () => {
    const state = seedWardFlowState();
    const shifted = shiftInstants(state, 137);

    const opened = state.movements.map((movement) => movement.openedAt);
    const openedShifted = shifted.movements.map((movement) => movement.openedAt);

    expect(opened.length, "no movements to compare - the fixture is empty").toBeGreaterThan(30);
    expect(
      openedShifted.map((instant, index) => instant - opened[index]),
      "re-anchoring moved the seeded movements by inconsistent amounts. Every instant must move by " +
        "the same offset or the fixture's shape changes: waits, gaps and overdue-ness are all " +
        "differences, and only a uniform shift leaves them alone.",
    ).toEqual(opened.map(() => 137));
  });

  it("keeps appointment, contact, paper and audit times aligned while preserving appointment versions", () => {
    let state = seedWardFlowState();
    const admission = state.admissions.find((a) => a.state === "occupied" && a.patientId)!;
    const changes: CareChange[] = [
      {
        kind: "follow_up",
        contactId: "demo-adult-clinician",
        serviceId: COMMUNITY_TEAM_PAGES[0].id,
        appointmentAt: NOW_ANCHOR,
        mode: "telephone",
      },
      { kind: "contact", outcome: "completed", contactedAt: NOW_ANCHOR },
      { kind: "legal", authority: "revocation", writtenAt: NOW_ANCHOR, paperChecked: true },
    ];
    for (const change of changes) {
      state = wardFlowReducer(state, {
        type: "RECORD_ADMISSION_CARE",
        role: "coordinator",
        now: NOW_ANCHOR,
        admissionId: admission.id,
        patientId: admission.patientId!,
        expectedGeneration: state.worldGeneration,
        expectedRevision: state.dischargeRevisions[admission.id] ?? 0,
        change,
      });
    }
    expect(state.rejections).toEqual([]);
    const shifted = shiftInstants(state, 137);
    const care = shifted.admissions.find((a) => a.id === admission.id)!.careJourney!;
    expect(care.followUp?.appointmentAt).toBe(NOW_ANCHOR + 137);
    expect(care.contacts[0]?.contactedAt).toBe(NOW_ANCHOR + 137);
    expect(care.legal?.writtenAt).toBe(NOW_ANCHOR + 137);
    expect(care.legal?.recordedAt).toBe(NOW_ANCHOR + 137);
    expect(care.followUp?.appointmentVersion).toBe(1);
    expect(care.contacts[0]?.appointmentVersion).toBe(1);
    expect(shifted.auditEvents.at(-1)).toMatchObject({
      at: NOW_ANCHOR + 137,
      details: { kind: "care", recorded: { writtenAt: NOW_ANCHOR + 137 } },
    });
    expect(state.admissions.find((a) => a.id === admission.id)!.careJourney?.followUp?.appointmentAt).toBe(NOW_ANCHOR);
  });
  it("leaves durations and counts where they are", () => {
    const shifted = shiftInstants(seedWardFlowState(), 137);
    expect(
      shifted.clockOffsetMinutes,
      "clockOffsetMinutes is a DURATION the advance-clock control has added, not a point in time. " +
        "Shifting it double-counts the re-anchor and the demo clock jumps twice.",
    ).toBe(0);
    expect(shifted.referralSequence, "referralSequence is a counter, not a time").toBe(0);
  });

  it("is a copy, so the pinned path and the live path differ only in the offset", () => {
    const state = seedWardFlowState();
    const copy = shiftInstants(state, 0);
    expect(copy).toEqual(state);
    expect(copy).not.toBe(state);
    expect(copy.movements[0]).not.toBe(state.movements[0]);
  });
});
