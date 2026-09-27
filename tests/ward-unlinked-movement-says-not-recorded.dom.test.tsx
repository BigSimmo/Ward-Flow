import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

/**
 * **A MOVEMENT LINKED TO NOBODY SAYS SO, ON THE SEARCH PAGE AND ON THE HANDOVER SHEET.**
 *
 * These two checks used to run on the live seed, which held open movements naming a `PT-G-` person
 * with no record behind them. Josh's rule of 25 September 2026 (demo data only as patients and
 * their linked records) gave every one of them a real record, so the seed no longer has a movement
 * linked to nobody, and the checks moved here. A real ward can still hold one (a movement recorded
 * before the person is), so the state is built by unlinking one seeded movement.
 *
 * `vi.mock` hoists to the top of the file, so this lives in a file of its own, as
 * `ward-capacity-network-fold-empty-service.dom.test.tsx` does, and spreads the seeded state rather
 * than hand-listing the context's fields.
 */
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/ward-management/ward-flow-provider", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/ward-management/ward-flow-provider")>();
  return { ...actual, useWardFlow: () => mockContext, useWardFlowClock: () => mockContext.now };
});

import { HandoverPage } from "@/components/ward-management/handover/handover-page";
import { PatientSearchPage } from "@/components/ward-management/search/patient-search";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const seeded = seedWardFlowState();
const UNLINKED = seeded.movements.find(
  (movement) => movement.patientId?.startsWith("PT-G-") && !movement.referralId && movement.stage !== "arrived",
);
if (!UNLINKED) throw new Error("no seeded movement with a generated person and no referral to unlink");
const movements = seeded.movements.map((movement) =>
  movement.id === UNLINKED.id ? { ...movement, patientId: undefined } : movement,
);

const mockContext = {
  ...seeded,
  movements,
  now: NOW_ANCHOR,
  dayZero: new Date(0),
  dispatch: vi.fn(),
  focusMovementId: undefined,
  setFocusMovementId: vi.fn(),
};

describe("a movement linked to nobody says so", () => {
  it("really is linked to nobody, and was linked to a record before", () => {
    const state = { patients: seeded.patients, referrals: seeded.referrals, movements };
    const unlinked = movements.find((movement) => movement.id === UNLINKED.id);
    expect(resolveSubjectPatient(unlinked, state).displayName).toBe("Unknown Patient");
    expect(resolveSubjectPatient(UNLINKED, state).displayName).not.toBe("Unknown Patient");
  });

  it("patient search says an unrecorded age or sex is not recorded instead of guessing one", () => {
    const { container } = render(<PatientSearchPage />);
    const text = container.textContent ?? "";
    expect(text).toMatch(/Age not recorded/);
    expect(text).toMatch(/Sex not recorded/);
    expect(text).not.toMatch(/\b38y\b|\b34y\b/);
  });

  it("the handover card for that movement says the patient is unknown and the record number is not recorded", () => {
    render(<HandoverPage />);
    fireEvent.click(screen.getByRole("radio", { name: /ISBAR Cards/ }));
    const card = screen.getByTestId(`patient-card-${UNLINKED.id}`);
    expect(card.textContent).toContain("Unknown Patient");
    expect(card.textContent).toContain("UMRN not recorded");
  });
});
