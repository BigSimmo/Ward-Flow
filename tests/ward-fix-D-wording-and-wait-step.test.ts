import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { edJourneyState, edJourneyWords } from "@/components/ward-management/ed/ed-bed-search-step";
import { GLOSSARY } from "@/components/ward-management/help/ward-help-content";
import { DESK_JOBS } from "@/components/ward-management/help/ward-help-howto-desks";
import { nightEdWaits } from "@/components/ward-management/night-view-figures";
import { STOP_TRANSPORT_REASONS } from "@/components/ward-management/ward-change-reasons";
import {
  EXAMINATION_REVOKED_WHILE_BED_HELD_NOTICE,
  examinationBedHeldNotice,
} from "@/components/ward-management/ward-derivations";
import { edWaitStep } from "@/components/ward-management/ward-ed-wait-steps";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import {
  EXAMINATION_OUTCOME_LABEL,
  examinationOutcomeLabel,
  examinationOutcomeShort,
} from "@/components/ward-management/ward-legal-forms";
import type { Movement } from "@/components/ward-management/ward-model";
import {
  ED_ELEVATED_PRESSURE_WAIT_MINUTES,
  ED_SEVERE_PRESSURE_WAIT_MINUTES,
  LONG_WAIT_MINUTES,
  VERY_LONG_WAIT_MINUTES,
} from "@/components/ward-management/ward-operational-defaults";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { TRANSPORT_EXCEPTION_GAP_LABELS } from "@/components/ward-management/ward-transport-checks";

/**
 * Package D, items 4 to 7 (D-170 items 3, 5 and 7, clinical check pack E1 and D1, and 3.1;
 * Josh, 13 Nov 2026). Each block fails if the old wording or behaviour comes back. The whole-tree
 * check that the Act is never shortened lives in `tests/ward-word-list.test.ts`, and the ED board and
 * night view are rendered in `tests/ward-fix-D-wait-step-screens.dom.test.tsx`.
 */

describe("D-170 item 3: the examination outcome never says revoked", () => {
  it("lists, chips and notices the outcome in Josh's words", () => {
    expect(EXAMINATION_OUTCOME_LABEL.revoked).toBe("No order made, does not proceed");
    expect(examinationOutcomeLabel("revoked")).toBe("No order made, does not proceed");
    expect(examinationOutcomeShort("revoked")).toBe("No order made");
    expect(EXAMINATION_REVOKED_WHILE_BED_HELD_NOTICE).toBe(
      "The examination made no order and this movement still has a bed pulled.",
    );
    expect(examinationBedHeldNotice({ examination: { at: 0, outcome: "community_order" } })).toBe(
      "The examination made a community treatment order and this movement still has a bed pulled.",
    );
  });

  it("keeps the word out of every outcome label, notice, stop reason and the how-to answer", () => {
    const outcomes = ["inpatient_order", "community_order", "revoked", "further_examination_ordered"] as const;
    const words = [
      ...outcomes.flatMap((outcome) => [examinationOutcomeLabel(outcome), examinationOutcomeShort(outcome)]),
      EXAMINATION_REVOKED_WHILE_BED_HELD_NOTICE,
      examinationBedHeldNotice({ examination: { at: 0, outcome: "revoked" } }),
      ...STOP_TRANSPORT_REASONS,
      DESK_JOBS.find((entry) => entry.id === "ed-examination")!.answer,
    ];
    expect(words.filter((text) => /revok/iu.test(text))).toEqual([]);
  });
});

describe("D-170 item 5: the transport order gap", () => {
  it("names a transport or transfer order", () => {
    // D-189 item 8(b): the same words, labelled not signed until Josh signs the Q28 table.
    expect(TRANSPORT_EXCEPTION_GAP_LABELS.transport_order_missing).toBe(
      "Transport or transfer order not uploaded · rule not signed",
    );
  });
});

describe("E1 and D1: the Act in full, and SMHMR unexpanded", () => {
  it("names the Act's full title in the glossary and says what SMHMR is without expanding it", () => {
    expect(GLOSSARY.some((entry) => entry.term === "Criminal Law (Mental Impairment) Act 2023")).toBe(true);
    expect(GLOSSARY.find((entry) => entry.term === "SMHMR")?.meaning).toBe(
      "The form-number prefix for WA's statewide standardised mental health documents.",
    );
    const wordList = readFileSync("docs/ward-flow/word-list.md", "utf8");
    expect(wordList).toContain("The form-number prefix for WA's statewide standardised mental health documents.");
    expect(wordList).toContain("**Criminal Law (Mental Impairment) Act 2023** is always written in full");
  });
});

describe("3.1: the ED wait step reads the journey", () => {
  const STARTS = [
    ED_ELEVATED_PRESSURE_WAIT_MINUTES,
    ED_SEVERE_PRESSURE_WAIT_MINUTES,
    LONG_WAIT_MINUTES,
    VERY_LONG_WAIT_MINUTES,
  ];

  it("keeps the thresholds and wording: the journey changes only actionDone", () => {
    for (const minutes of STARTS) {
      const plain = edWaitStep(minutes)!;
      expect(plain.actionDone).toBe(false);
      for (const journey of ["accepted", "pulled", "asked", "not_asked", "closed"] as const) {
        const read = edWaitStep(minutes, journey)!;
        expect({ ...read, actionDone: false }).toEqual(plain);
      }
    }
    expect(edWaitStep(ED_ELEVATED_PRESSURE_WAIT_MINUTES - 1, "accepted")).toBeUndefined();
  });

  it("treats Ask wards as done once a ward is asked or has accepted, and later calls as still owed", () => {
    const step1 = ED_ELEVATED_PRESSURE_WAIT_MINUTES;
    for (const journey of ["asked", "accepted", "pulled", "transport_booked", "closed", "left"] as const)
      expect(edWaitStep(step1, journey)!.actionDone).toBe(true);
    expect(edWaitStep(step1, "not_asked")!.actionDone).toBe(false);
    for (const minutes of STARTS.slice(1)) {
      for (const journey of ["asked", "accepted", "pulled", "transport_booked", "not_asked"] as const)
        expect(edWaitStep(minutes, journey)!.actionDone).toBe(false);
      expect(edWaitStep(minutes, "closed")!.actionDone).toBe(true);
    }
  });

  it("reads Keira's accepted journey as accepted, in the row's own words", () => {
    const keira = seedWardFlowState().movements.find((movement) => movement.id === "WF-003")!;
    expect(edJourneyState(keira, false)).toBe("accepted");
    expect(edJourneyWords("accepted")).toBe("Accepted, awaiting bed");
    expect(edJourneyWords("asked")).toBe("Waiting on a ward");
    expect(edJourneyWords("not_asked")).toBeUndefined();
  });

  it("counts, on the night view, the people at a step whose action is already recorded", () => {
    const keira = seedWardFlowState().movements.find((movement) => movement.id === "WF-003")!;
    const atStep1: Movement = { ...keira, openedAt: NOW_ANCHOR - ED_ELEVATED_PRESSURE_WAIT_MINUTES - 1 };
    const notAsked: Movement = {
      ...atStep1,
      id: "WF-D-NOT-ASKED",
      acceptedUnitId: undefined,
      stage: "destination_review",
    };
    const waits = nightEdWaits([atStep1, notAsked], NOW_ANCHOR);
    const step1 = waits.steps.find((step) => step.step === 1)!;
    expect(step1.count).toBe(2);
    expect(step1.actionDoneCount).toBe(1);
    for (const step of waits.steps) expect(step.actionDoneCount).toBeLessThanOrEqual(step.count);
  });
});
