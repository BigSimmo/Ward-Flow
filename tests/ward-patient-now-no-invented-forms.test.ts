import { describe, expect, it } from "vitest";

import { resolvePatientNowRecord } from "@/components/ward-management/patients/patient-now-adapter";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * The person-now page shows a legal document only from the record. PT-042 and PT-043 used to get a
 * Form 1A and a Form 3A typed in by patient id, the 3A "running to" three hours from whenever the
 * page was opened (invented-figures sweep, 26 Sept 2026; Josh: no computed legal limits).
 *
 * Which people have a recorded form is the seed's business, not this test's: since the linked demo
 * data (26 Sept 2026) PT-043 has a real one, the Form 3A on WF-RD09-3A. So the people checked for
 * "no document" are taken from the seed (everyone linked to a movement, none of whose movements
 * records a form), and anyone who does have a recorded form is checked to show that form and
 * nothing else.
 */
const seed = seedWardFlowState();
const INSTANTS = [NOW_ANCHOR, NOW_ANCHOR + 600];

type Document = { code?: string; status: string };

function documentsFor(id: string, now: number): readonly Document[] {
  const resolved = resolvePatientNowRecord(id, seed.patients, seed.movements, seed.referrals, seed.units, now);
  expect(resolved, `${id} did not resolve`).toBeDefined();
  return (resolved!.record as { documents?: readonly Document[] }).documents ?? [];
}

function recordedForms(id: string) {
  return seed.movements.flatMap((movement) =>
    movement.patientId === id && movement.legalForm ? [movement.legalForm] : [],
  );
}

const linkedIds = [...new Set(seed.movements.flatMap((movement) => (movement.patientId ? [movement.patientId] : [])))];
const formlessIds = linkedIds.filter((id) => recordedForms(id).length === 0);

describe("the person-now page invents no legal document", () => {
  it("the seed has people with a movement but no recorded form, so the check below is not vacuous", () => {
    expect(formlessIds.length).toBeGreaterThan(0);
  });

  it("everyone whose movements record no form shows no document", () => {
    for (const id of formlessIds) {
      for (const now of INSTANTS) {
        expect(documentsFor(id, now), `${id} at ${now}`).toEqual([]);
      }
    }
  });

  for (const id of ["PT-042", "PT-043"]) {
    it(`${id}, one of the two people the old code typed a form in for, shows only what the record holds`, () => {
      const forms = recordedForms(id);
      const atFirst = documentsFor(id, INSTANTS[0]);
      if (forms.length === 0) expect(atFirst).toEqual([]);
      const recordedCodes = new Set<string>(forms.map((form) => form.code));
      for (const document of atFirst) {
        expect(recordedCodes.has(document.code ?? ""), `${id} shows ${document.code}, which no movement records`).toBe(true);
        const form = forms.find((candidate) => candidate.code === document.code);
        // A form with no typed due time never shows one: "Runs to" only when the record carries it.
        if (form?.dueAt === undefined) expect(document.status).toBe("Active");
      }
      // Nothing moves with the clock: opening the page ten hours later shows the same documents.
      for (const now of INSTANTS.slice(1)) {
        expect(documentsFor(id, now)).toEqual(atFirst);
      }
    });
  }
});
