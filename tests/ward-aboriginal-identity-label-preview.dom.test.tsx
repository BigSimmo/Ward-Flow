import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Same stand-in as the sibling preview suites: jsdom has no App Router context for next/link.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { RecordPreview } from "@/components/ward-management/search/record-preview";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * M119 (D-123): the record preview shows the recorded identity, in both the person and the
 * movement branch, and shows nothing for "Neither", "Not stated", empty or missing answers.
 * Synthetic seed records only.
 */
const seed = seedWardFlowState();
type Patient = (typeof seed.patients)[number];
const movement = seed.movements.find((candidate) => candidate.patientId !== undefined)!;
const basePatient = seed.patients.find((candidate) => candidate.id === movement.patientId)!;
const PILL_LABELS = ["Aboriginal", "Torres Strait Islander", "Aboriginal and Torres Strait Islander"];

const CASES: ReadonlyArray<[string | undefined, string | undefined]> = [
  ["Aboriginal, not Torres Strait Islander", "Aboriginal"],
  ["Torres Strait Islander, not Aboriginal", "Torres Strait Islander"],
  ["Aboriginal and Torres Strait Islander", "Aboriginal and Torres Strait Islander"],
  ["Neither Aboriginal nor Torres Strait Islander", undefined],
  ["Not stated", undefined],
  ["", undefined],
  [undefined, undefined],
];

function renderPreview(kind: "person" | "movement", status: string | undefined) {
  const patient = { ...basePatient, aboriginalOrTorresStraitIslanderStatus: status } as Patient;
  render(
    <RecordPreview
      selection={kind === "person" ? { kind, patient } : { kind, movement }}
      referrals={[]}
      movements={[movement]}
      patients={[patient]}
      units={allUnits()}
      now={NOW_ANCHOR}
      onClose={() => {}}
    />,
  );
}

afterEach(cleanup);

describe("record preview identity label (M119, D-123)", () => {
  expect(movement, "fixture needs a person-linked movement").toBeDefined();
  expect(basePatient, "the movement's patientId must resolve").toBeDefined();

  for (const kind of ["person", "movement"] as const) {
    for (const [status, label] of CASES) {
      it(`${kind} branch: ${JSON.stringify(status)} shows ${label ?? "no label"}`, () => {
        renderPreview(kind, status);
        for (const candidate of PILL_LABELS) {
          if (candidate === label) expect(screen.getByText(candidate, { exact: true })).toBeInTheDocument();
          else expect(screen.queryByText(candidate, { exact: true })).not.toBeInTheDocument();
        }
        expect(screen.queryByText("Aboriginal (ATSI)")).not.toBeInTheDocument();
      });
    }
  }
});
