import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

import { recordExtrasFor } from "@/components/ward-management/patients/patient-record-extras";
import { DESK_PERSONAS } from "@/components/ward-management/shell/ward-desk-personas";
import { SETTINGS_DEMO_PROFILE } from "@/components/ward-management/settings/settings-profile";
import { signerName } from "@/components/ward-management/triage/triage-signer";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { GENERATED_GIVEN_NAMES_BY_SEX } from "@/components/ward-management/ward-generated-names-seed";
import { DELIBERATE_LOOKALIKE_PATIENT_IDS } from "@/components/ward-management/ward-patients-seed";
import { seededReferralDossier } from "@/components/ward-management/ward-referral-dossier-seed";
import {
  ALL_STAFF,
  GENERAL_PRACTITIONERS,
  SIGNED_IN_COORDINATOR_NAME,
  generalPractitionerLine,
  staffFullName,
  staffInitialName,
  staffListName,
  type StaffMember,
} from "@/components/ward-management/ward-staff-names-seed";

/**
 * Package A1 of the 13 Nov 2026 fix round (Audit 16 A16-01, A16-02, A16-03, A16-11, A16-21; Audit 15
 * A15-06). Synthetic data only: every name here is invented.
 */

// With the worked examples on, so the examples' people are checked too (they are opt-in since A16-14).
const state = seedWardFlowState("standard", { workedExamples: true });
const patients = state.patients;
const fold = (text: string) => text.toLowerCase().replace(/[^a-z]/g, "");
const patientFullNames = new Set(patients.map((patient) => fold(`${patient.givenName} ${patient.familyName}`)));
const patientSurnames = new Set(patients.map((patient) => fold(patient.familyName)));

/** Every way the app writes a staff member's name. */
function writtenForms(member: StaffMember): string[] {
  const forms = [staffFullName(member), staffInitialName(member), staffListName(member)];
  // "K. Vance RN": a nurse's title written after the name.
  if (member.title) forms.push(`${member.given[0]}. ${member.family} ${member.title}`);
  return forms;
}
const STAFF_FORMS = new Set(ALL_STAFF.flatMap(writtenForms));

function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = row[0]!;
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const above = row[j]!;
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = above;
    }
  }
  return row[b.length]!;
}

describe("generated patient names (A16-01)", () => {
  const generated = patients.filter((patient) => patient.id.startsWith("PT-G-"));

  it("takes the given name from the list for the recorded sex", () => {
    expect(generated.length).toBeGreaterThan(200);
    const wrong = generated.filter((patient) => {
      const list: readonly string[] =
        patient.sex === "Female" || patient.sex === "Male"
          ? GENERATED_GIVEN_NAMES_BY_SEX[patient.sex]
          : GENERATED_GIVEN_NAMES_BY_SEX["Not recorded"];
      return !list.includes(patient.givenName);
    });
    expect(wrong.map((patient) => `${patient.id} ${patient.sex ?? "no sex"} ${patient.givenName}`)).toEqual([]);
  });

  it("puts one surname on no more than four beds of one ward", () => {
    const byPatient = new Map(patients.map((patient) => [patient.id, patient]));
    const counts = new Map<string, number>();
    for (const admission of state.admissions) {
      if (admission.state === "departed" || !admission.patientId) continue;
      const patient = byPatient.get(admission.patientId);
      if (!patient) continue;
      const key = `${admission.unitId}: ${patient.familyName}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    expect(counts.size).toBeGreaterThan(100);
    expect([...counts].filter(([, count]) => count > 4).map(([key, count]) => `${key} x${count}`)).toEqual([]);
  });

  it("gives every seeded person a full name nobody else has", () => {
    const seen = new Map<string, string>();
    const clashes: string[] = [];
    for (const patient of patients) {
      const name = fold(`${patient.givenName} ${patient.familyName}`);
      const other = seen.get(name);
      if (other) clashes.push(`${patient.givenName} ${patient.familyName}: ${other} and ${patient.id}`);
      else seen.set(name, patient.id);
    }
    expect(clashes).toEqual([]);
  });

  it("allows near-miss surnames only between patients marked as deliberate look-alikes", () => {
    const surnames = [...new Map(patients.map((patient) => [fold(patient.familyName), patient])).values()];
    const accidental: string[] = [];
    for (let i = 0; i < surnames.length; i += 1)
      for (let j = i + 1; j < surnames.length; j += 1) {
        const [a, b] = [surnames[i]!, surnames[j]!];
        if (editDistance(fold(a.familyName), fold(b.familyName)) > 2) continue;
        const marked = (family: string) =>
          patients.some((patient) => patient.familyName === family && DELIBERATE_LOOKALIKE_PATIENT_IDS.has(patient.id));
        if (!marked(a.familyName) || !marked(b.familyName)) accidental.push(`${a.familyName} / ${b.familyName}`);
      }
    // Found by this check on 13 Nov 2026 and reported for renaming: Vallowen (PT-RD06) is typed in
    // `ward-rulings-demo.ts`, which this package does not own. Remove the entry once it is renamed.
    const reported = new Set(["Hallowin / Vallowen"]);
    expect(accidental.filter((pair) => !reported.has(pair))).toEqual([]);
  });
});

describe("staff names (A16-02, A16-21, A15-06)", () => {
  it("gives no staff member a patient's full name or surname", () => {
    const fullClash = ALL_STAFF.filter((member) => patientFullNames.has(fold(`${member.given} ${member.family}`)));
    const surnameClash = ALL_STAFF.filter(
      (member) =>
        // The desk personas predate the list and keep their surnames; the full-name rule still holds.
        !Object.values(DESK_PERSONAS).some((persona) => persona.name.includes(member.family)) &&
        patientSurnames.has(fold(member.family)),
    );
    expect(fullClash.map(staffFullName)).toEqual([]);
    expect(surnameClash.map(staffFullName)).toEqual([]);
  });

  it("names no next of kin or support person with a patient's full name", () => {
    const kin: string[] = [];
    for (const movement of state.movements) {
      const dossier = seededReferralDossier(movement.id);
      for (const row of dossier?.supports ?? []) if (row.label === "NOK") kin.push(row.detail.split(",")[0]!.trim());
    }
    for (const patient of patients)
      for (const support of recordExtrasFor(patient.id)?.supports ?? []) {
        const [family, given] = support.name.split(",").map((part) => part.trim());
        kin.push(`${given} ${family}`);
      }
    expect(kin.length).toBeGreaterThan(8);
    expect(kin.filter((name) => patientFullNames.has(fold(name)))).toEqual([]);
  });

  it("takes every patient's GP from the list, and the signed-in coordinator is nobody's GP", () => {
    const lines = new Set(GENERAL_PRACTITIONERS.map(generalPractitionerLine));
    const withGp = patients.filter((patient) => patient.generalPractitioner);
    expect(withGp.length).toBeGreaterThan(30);
    expect(withGp.filter((patient) => !lines.has(patient.generalPractitioner!)).map((patient) => patient.id)).toEqual(
      [],
    );
    expect(withGp.filter((patient) => patient.generalPractitioner!.includes(SIGNED_IN_COORDINATOR_NAME))).toEqual([]);
    expect(SIGNED_IN_COORDINATOR_NAME).not.toBe("Dr S. Chen");
  });

  it("names every seeded referrer and ED contact from the list, never a numbered placeholder", () => {
    const named: string[] = [];
    for (const movement of state.movements) {
      const dossier = seededReferralDossier(movement.id);
      if (!dossier) continue;
      named.push(dossier.referrer.name);
      if (dossier.medicalClearance.contact) named.push(dossier.medicalClearance.contact.split(/[,·]/)[0]!.trim());
    }
    for (const referral of state.referrals) if (referral.intake?.referrer) named.push(referral.intake.referrer.name);
    expect(named.length).toBeGreaterThan(14);
    expect(named.filter((name) => /synthetic clinician/i.test(name))).toEqual([]);
    expect([...new Set(named.filter((name) => !STAFF_FORMS.has(name)))]).toEqual([]);
  });

  it("signs in, signs triage and fills Settings as one person from the list", () => {
    for (const persona of Object.values(DESK_PERSONAS))
      if (persona.role !== "Demo desk") expect(STAFF_FORMS.has(persona.name), persona.name).toBe(true);
    expect(DESK_PERSONAS.coordinator.name).toBe(SIGNED_IN_COORDINATOR_NAME);
    expect(SETTINGS_DEMO_PROFILE.name).toBe(SIGNED_IN_COORDINATOR_NAME);
    // Go question 4 (Josh, 14 Nov 2026): a triage names the desk that signed it, not its persona.
    expect(signerName("coordinator")).toBe("Bed coordinator");
  });
});

/** Source text with comments taken out, so a dated ruling in a comment is not read as content. */
function sourceWithoutComments(path: string): string {
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\s)\/\/.*$/gm, "$1");
}

const WARD = join(process.cwd(), "src", "components", "ward-management");
const TITLED_NAME = /\b(?:(?:Dr|RN|CNS|Sr) [A-Z][a-z]*\.? ?[A-Z][A-Za-z'-]+|[A-Z]\. [A-Z][A-Za-z'-]+ RN)\b/g;

/**
 * Files that still type their own staff names. A15-06 approved the persona now and the shared list
 * after the demo, so these move onto the list in a later round. The list must only shrink: a new file
 * that types a "Dr", "RN", "CNS" or "Sr" name fails here.
 */
const NOT_YET_ON_THE_LIST = new Set([
  "community/community-demo-cohort.ts",
  "community/community-screen-drawer.tsx",
  "community/community-screen-modals.tsx",
  "community/community-screen-panels.tsx",
  "community/team-2026/midland-demo.ts",
  "triage/triage-risk-decision.tsx",
  "ward-care-journey.ts",
]);

describe("titled staff names in the source (A15-06)", () => {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (/\.tsx?$/.test(entry.name)) files.push(path);
    }
  };
  walk(WARD);

  it("finds every Dr, RN, CNS or Sr name on the staff list, outside the files not yet moved", () => {
    expect(files.length).toBeGreaterThan(200);
    const off: string[] = [];
    for (const path of files) {
      const file = relative(WARD, path).split("\\").join("/");
      if (NOT_YET_ON_THE_LIST.has(file)) continue;
      for (const match of sourceWithoutComments(path).matchAll(TITLED_NAME))
        if (!STAFF_FORMS.has(match[0])) off.push(`${file}: ${match[0]}`);
    }
    expect(off).toEqual([]);
  });

  it("keeps the not-yet-moved list honest: each file on it still types a name", () => {
    const stale = [...NOT_YET_ON_THE_LIST].filter((file) => {
      const text = sourceWithoutComments(join(WARD, file));
      return ![...text.matchAll(TITLED_NAME)].some((match) => !STAFF_FORMS.has(match[0]));
    });
    expect(stale).toEqual([]);
  });
});

describe("referral letters (A16-03)", () => {
  it("are never timed before a document they report", () => {
    let checked = 0;
    const early: string[] = [];
    for (const movement of state.movements) {
      const dossier = seededReferralDossier(movement.id);
      if (!dossier) continue;
      const letter = dossier.documents.find((document) => /referral letter/i.test(document.title));
      if (!letter) continue;
      checked += 1;
      for (const document of dossier.documents)
        if (document !== letter && document.addedAfterMinutes > letter.addedAfterMinutes)
          early.push(
            `${movement.id}: letter ${letter.addedAfterMinutes} before ${document.title} ${document.addedAfterMinutes}`,
          );
    }
    expect(checked).toBeGreaterThan(4);
    expect(early).toEqual([]);
  });
});

describe("sample dates move with the board day (root cause 2.3)", () => {
  const MONTH = "(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*";
  const MONTH_DATE = new RegExp(`\\b(?:\\d{1,2} ${MONTH} \\d{4}|${MONTH} \\d{4})\\b`, "g");
  const SAMPLE_FILES = [
    "ward-patients-seed.ts",
    "ward-referral-dossier-seed.ts",
    "ward-staff-names-seed.ts",
    "patients/patient-record-extras.ts",
  ];

  it("types no month-name date into the sample files", () => {
    const typed = SAMPLE_FILES.flatMap((file) =>
      [...sourceWithoutComments(join(WARD, file)).matchAll(MONTH_DATE)].map((match) => `${file}: ${match[0]}`),
    );
    expect(typed).toEqual([]);
  });

  it("types no calendar date into a sample patient other than a date of birth", () => {
    const lines = sourceWithoutComments(join(WARD, "ward-patients-seed.ts")).split("\n");
    const typed = lines.filter((line) => /"\d{4}-\d{2}-\d{2}"/.test(line) && !/dateOfBirth:/.test(line));
    expect(typed).toEqual([]);
  });
});
