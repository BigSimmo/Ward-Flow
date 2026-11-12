import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LeaveScreen } from "@/components/ward-management/leave/leave-screen";
import { LegalFormsScreen } from "@/components/ward-management/legal-forms/legal-forms-screen";
import { MovementsScreen } from "@/components/ward-management/movements/movements-screen";
import { unitHref } from "@/components/ward-management/shell/ward-facade";
import { WardFlowOverride, WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { admittedOnAForm } from "@/components/ward-management/legal-forms/legal-forms-admitted";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { seedWardFlowState, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { LeaveBed } from "@/components/ward-management/ward-model";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

// Leave page (Open ward, Print) and Print and Export on Legal forms and Movements (feature 44).
// Synthetic seed only. Exports carry record numbers and UMRNs, never names (D-102), and legal
// times only as typed (D-93).
const { createObjectURL, revokeObjectURL } = URL;
afterEach(() => {
  URL.createObjectURL = createObjectURL;
  URL.revokeObjectURL = revokeObjectURL;
  vi.restoreAllMocks();
});

function wrap(children: ReactNode) {
  return render(<WardFlowProvider initialNow={NOW_ANCHOR}>{children}</WardFlowProvider>);
}

/** Clicks Export and returns the downloaded CSV's text. */
async function exportedCsv(testId: string): Promise<string> {
  let file: Blob | undefined;
  URL.createObjectURL = (blob: Blob) => {
    file = blob;
    return "blob:synthetic-export";
  };
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  fireEvent.click(screen.getByTestId(testId));
  await waitFor(() => expect(file).toBeDefined(), { timeout: 10_000 });
  return file!.text();
}

function expectNoNames(csv: string) {
  const state = seedWardFlowState();
  const cells = new Set(csv.split("\r\n").flatMap((line) => line.split(",").map((c) => c.replace(/^"'?|"$/gu, ""))));
  for (const movement of state.movements) {
    const person = resolveSubjectPatient(movement, state);
    if (person.patient) {
      expect(csv).not.toContain(person.patient.familyName);
      expect(cells).not.toContain(person.patient.givenName);
    }
    if (person.initials) expect(cells).not.toContain(person.initials);
  }
}

/** A legal time column never carries a count ("2h 05m", "left", "ago", "overdue"). */
const COUNT = /\b\d+\s*[dhm]\b|\bleft\b|\bago\b|\boverdue\b/u;

describe("Leave page", () => {
  const leave = (id: string, unitId: string, expectedReturn: number, extra: Partial<LeaveBed> = {}): LeaveBed => ({
    id,
    unitId,
    admissionId: `adm-${id}`,
    expectedReturn,
    confirmedAt: 0,
    confirmedBy: "Ward nurse",
    ...extra,
  });
  function WithLeave() {
    const flow = useWardFlow();
    const [a, b] = [flow.units[0]!.id, flow.units[1]!.id];
    const leaveBeds = [
      leave("l-over", a, flow.now - 30),
      leave("l-away", b, flow.now + 10, { absentWithoutLeave: { since: flow.now - 60, steps: [] } }),
      leave("l-later", b, flow.now + 3 * 1440),
    ];
    return (
      <WardFlowOverride value={{ ...flow, leaveBeds }}>
        <LeaveScreen />
      </WardFlowOverride>
    );
  }

  it("offers Open ward on overdue and absent rows only, opening the ward's leave view", () => {
    wrap(<WithLeave />);
    const over = screen.getByTestId("ward-leave-row-l-over");
    const link = within(over).getByRole("link", { name: /^Open ward/u });
    const seed = seedWardFlowState();
    expect(link.getAttribute("href")).toBe(`${unitHref(seed.units[0]!.id)}#ward-leave-bed-form`);
    expect(within(screen.getByTestId("ward-leave-row-l-away")).getByRole("link", { name: /^Open ward/u })).toBeTruthy();
    expect(
      within(screen.getByTestId("ward-leave-row-l-later")).queryByRole("link", { name: /^Open ward/u }),
    ).toBeNull();
  });

  it("prints with the browser's own print and says on paper what the list holds", () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    wrap(<WithLeave />);
    fireEvent.click(screen.getByRole("button", { name: "Print this list" }));
    expect(print).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("ward-leave-print-scope").textContent).toMatch(/^Everyone on leave · As at .+ AWST/u);
  });
});

/** A person admitted on a Form 1A, still in an occupied bed (same shape as WT-03). */
function arrivedOnA1A(clearOpenForms: boolean): { state: WardFlowState; movementId: string } {
  const seed = seedWardFlowState();
  const stay = seed.admissions.find((admission) => admission.state === "occupied" && admission.patientId !== null)!;
  const journey = seed.movements.find((movement) => !movement.closure)!;
  const arrived = {
    ...journey,
    stage: "arrived" as const,
    acceptedUnitId: stay.unitId,
    admissionId: stay.id,
    patientId: stay.patientId ?? undefined,
    legalStatus: "Involuntary inpatient" as const,
    legalForm: { code: "1A" as const, kind: "examination" as const },
    closure: { at: NOW_ANCHOR - 60, outcome: "arrived" as const, reason: "Patient arrived at the accepting unit" },
  };
  let movements = seed.movements.map((movement) => (movement.id === journey.id ? arrived : movement));
  if (clearOpenForms) {
    movements = movements.map((movement) =>
      movement.id === journey.id || !isOpen(movement) ? movement : { ...movement, legalForm: undefined },
    );
  }
  return { state: { ...seed, movements }, movementId: journey.id };
}

function FormsWith({ state }: { state: WardFlowState }) {
  const flow = useWardFlow();
  return (
    <WardFlowOverride value={{ ...flow, movements: state.movements, admissions: state.admissions }}>
      <LegalFormsScreen />
    </WardFlowOverride>
  );
}

describe("Legal forms Print and Export", () => {
  it("exports everyone on a form without names, each end exactly as typed", async () => {
    wrap(<LegalFormsScreen />);
    expect(screen.getByTestId("ward-legal-print")).toBeTruthy();
    const csv = await exportedCsv("ward-legal-export");
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe('"Data","Synthetic, not clinical records"');
    const header = lines.findIndex((line) => line.startsWith('"Record","UMRN","Form"'));
    expect(header).toBeGreaterThan(0);
    const rows = lines.slice(header + 1);
    expect(rows.length).toBeGreaterThan(0);
    const ends = rows.map((line) => line.split('","')[6] ?? "");
    expect(ends.some((cell) => / as typed$/u.test(cell))).toBe(true);
    for (const cell of ends) expect(cell).not.toMatch(COUNT);
    expectNoNames(csv);
  });

  it("includes a person admitted on a form in the export, and Print stays available (D-155)", async () => {
    const { state, movementId } = arrivedOnA1A(false);
    expect(admittedOnAForm(state.movements, state.admissions).map((movement) => movement.id)).toContain(movementId);
    wrap(<FormsWith state={state} />);
    expect(screen.getByTestId("ward-legal-print")).not.toBeDisabled();
    expect(screen.getByTestId("ward-legal-export")).not.toBeDisabled();
    const csv = await exportedCsv("ward-legal-export");
    expect(csv).toContain(movementId);
    expect(csv).toMatch(/including admitted on a form/);
    expectNoNames(csv);
  });

  it("keeps Print and Export available when only admitted-on-a-form people are on the list (D-155)", async () => {
    const { state, movementId } = arrivedOnA1A(true);
    expect(state.movements.filter((movement) => isOpen(movement) && movement.legalForm !== undefined)).toHaveLength(0);
    wrap(<FormsWith state={state} />);
    expect(screen.getByTestId("ward-legal-print")).not.toBeDisabled();
    expect(screen.getByTestId("ward-legal-export")).not.toBeDisabled();
    const csv = await exportedCsv("ward-legal-export");
    expect(csv).toContain(movementId);
    const header = csv.split("\r\n").findIndex((line) => line.startsWith('"Record","UMRN","Form"'));
    const data = csv
      .split("\r\n")
      .slice(header + 1)
      .filter((line) => line.length > 0);
    expect(data.some((line) => line.includes(movementId))).toBe(true);
    expectNoNames(csv);
  });

  it("disables Print and Export when nobody is on a form", () => {
    const seed = seedWardFlowState();
    const state = {
      ...seed,
      movements: seed.movements.map((movement) => ({ ...movement, legalForm: undefined })),
    };
    wrap(<FormsWith state={state} />);
    expect(screen.getByTestId("ward-legal-print")).toBeDisabled();
    expect(screen.getByTestId("ward-legal-export")).toBeDisabled();
  });
});

describe("Movements Print and Export", () => {
  it("exports the worklist without names", async () => {
    wrap(<MovementsScreen />);
    expect(screen.getByTestId("ward-movements-print")).toBeTruthy();
    const csv = await exportedCsv("ward-movements-export");
    const lines = csv.split("\r\n");
    expect(lines.some((line) => line.startsWith('"Record","UMRN","Stage","ED"'))).toBe(true);
    expect(lines.length).toBeGreaterThan(8);
    expectNoNames(csv);
  });
});
