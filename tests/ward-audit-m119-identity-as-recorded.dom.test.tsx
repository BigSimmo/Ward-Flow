import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { PatientDetailsTab } from "@/components/ward-management/patients/patient-details-tab";
import { interpreterLanguageRequired } from "@/components/ward-management/patients/patient-interpreter";
import { RecordPreview } from "@/components/ward-management/search/record-preview";
import { ABORIGINAL_OR_TORRES_STRAIT_ISLANDER_STATUSES } from "@/components/ward-management/ward-patient-aboriginal-status";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { GENDERS, type Patient } from "@/components/ward-management/ward-patients";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * M119 (master audit list, 10 Nov 2026): identity and cultural facts shown exactly as recorded.
 *
 * Aboriginal and Torres Strait Islander status, sex and gender, and interpreter need must read as the
 * recorded answer, never shortened into a different meaning or inferred. Each of the five recorded
 * statuses and each gender value is put on a synthetic seed person and rendered on:
 *
 *   - the patient record's Details tab (`PatientDetailsTab`);
 *   - the search record preview, for a person and for their movement (`RecordPreview`).
 *
 * PR #1591 (D-123) fixed the search record preview's identity tag: it now shows the answer as
 * recorded, and nothing for "Neither" or "Not stated". The tests below pin that.
 */

afterEach(cleanup);

const seed = seedWardFlowState();
const base = seed.patients.find((patient) =>
  seed.movements.some((movement) => movement.patientId === patient.id && !movement.closure),
);
if (!base) throw new Error("the seed has no patient with an open movement");
const movement = seed.movements.find((candidate) => candidate.patientId === base.id && !candidate.closure)!;

function person(overrides: Partial<Patient>): Patient {
  return { ...base!, ...overrides };
}

function details(patient: Patient) {
  render(<PatientDetailsTab patient={patient} movement={movement} displayName="Synthetic Person" />);
  return within(screen.getByRole("region", { name: "Patient details" }));
}

function preview(patient: Patient, kind: "person" | "movement") {
  render(
    <RecordPreview
      selection={kind === "person" ? { kind: "person", patient } : { kind: "movement", movement }}
      referrals={seed.referrals}
      movements={[movement]}
      patients={[patient]}
      units={allUnits()}
      now={NOW_ANCHOR}
      onClose={() => {}}
    />,
  );
  return within(screen.getByTestId("ward-patient-search-preview"));
}

describe("M119: the Details tab shows each recorded answer word for word", () => {
  for (const status of ABORIGINAL_OR_TORRES_STRAIT_ISLANDER_STATUSES) {
    it(`shows "${status}"`, () => {
      const pane = details(person({ aboriginalOrTorresStraitIslanderStatus: status }));
      expect(pane.getByText("Aboriginal or Torres Strait Islander status")).toBeInTheDocument();
      expect(pane.getByText(status)).toBeInTheDocument();
      // Never a shortened tag with another meaning.
      expect(pane.queryByText(/\bATSI\b/)).not.toBeInTheDocument();
    });
  }

  for (const gender of GENDERS) {
    it(`shows gender "${gender}" as recorded`, () => {
      const pane = details(person({ gender }));
      const label = pane.getByText("Gender");
      expect(label.parentElement ?? label).toHaveTextContent(gender);
    });
  }

  it("shows the interpreter answer as recorded", () => {
    const pane = details(person({ interpreterLanguage: "Karen — interpreter required" }));
    expect(pane.getByText("Karen — interpreter required")).toBeInTheDocument();
  });
});

describe("M119: the interpreter tag reads the recorded words", () => {
  it("names the recorded language only when the record says an interpreter is required", () => {
    expect(interpreterLanguageRequired({ interpreterLanguage: "Karen — interpreter required" })).toBe("Karen");
    expect(interpreterLanguageRequired({ interpreterLanguage: "English — no interpreter required" })).toBeUndefined();
    expect(interpreterLanguageRequired({ interpreterLanguage: undefined })).toBeUndefined();
  });
});

describe("M119: the search record preview shows the identity as recorded (fixed by #1591, D-123)", () => {
  const LABELS: Record<string, string | null> = {
    "Aboriginal, not Torres Strait Islander": "Aboriginal",
    "Torres Strait Islander, not Aboriginal": "Torres Strait Islander",
    "Aboriginal and Torres Strait Islander": "Aboriginal and Torres Strait Islander",
    "Neither Aboriginal nor Torres Strait Islander": null,
    "Not stated": null,
  };
  for (const kind of ["person", "movement"] as const) {
    for (const status of ABORIGINAL_OR_TORRES_STRAIT_ISLANDER_STATUSES) {
      it(`${kind}: "${status}" shows ${LABELS[status] ? `"${LABELS[status]}"` : "no identity tag"}, never "Aboriginal (ATSI)"`, () => {
        const pane = preview(person({ aboriginalOrTorresStraitIslanderStatus: status }), kind);
        expect(pane.queryByText("Aboriginal (ATSI)")).not.toBeInTheDocument();
        const label = LABELS[status];
        if (label) expect(pane.getByText(label)).toBeInTheDocument();
        else expect(pane.queryByText(/\bATSI\b|^Aboriginal$|^Torres Strait Islander$/u)).not.toBeInTheDocument();
      });
    }
    it(`${kind}: no recorded answer shows no identity tag`, () => {
      const pane = preview(person({ aboriginalOrTorresStraitIslanderStatus: undefined }), kind);
      expect(pane.queryByText("Aboriginal (ATSI)")).not.toBeInTheDocument();
    });
  }

  it.todo(
    "M119 gap: the search record preview shows sex only ('Sex unrecorded' when absent), never the recorded gender; Josh to say whether gender belongs there",
  );
});
