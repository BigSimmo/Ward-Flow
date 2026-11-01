import { fireEvent, render, screen } from "@testing-library/react";
import { useState, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow",
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { ShortlistPanel } from "@/components/ward-management/coordinator/shortlist-panel";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { ToastProvider } from "@/components/wf";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { wardAdmissions } from "@/components/ward-management/ward-admissions-seed";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";

/**
 * Audit S-8: Placement's "Accept for this ward" offers Undo on the toast, like the ward's own
 * acceptance (`UNDO_ACCEPT_IN_PRINCIPLE`), instead of recording silently.
 */
function Harness() {
  const { movements, units, bedReleases, leaveBeds, referrals, now, dispatch, configuration } = useWardFlow();
  const [movementId] = useState(
    () =>
      movements.find(
        (movement) =>
          movement.stage === "destination_review" &&
          !movement.acceptedUnitId &&
          movement.referredUnitIds.some((id) => units.some((unit) => unit.id === id)),
      )?.id,
  );
  const [selectedUnitId, setSelectedUnitId] = useState<string | undefined>(undefined);
  const movement = movements.find((candidate) => candidate.id === movementId);
  const patientOf = usePatientOf();
  return (
    <>
      <output data-testid="accepted">{movement?.acceptedUnitId ?? "none"}</output>
      <output data-testid="who">{movementId ? patientOf({ movementId }).formalName : ""}</output>
      <ShortlistPanel
        movement={movement}
        now={now}
        units={units}
        bedReleases={bedReleases}
        leaveBeds={leaveBeds}
        admissions={wardAdmissions}
        referrals={referrals}
        selectedUnitId={selectedUnitId}
        onSelectUnit={setSelectedUnitId}
        dispatch={dispatch}
        parallelReferralCap={configuration.parallelReferralCap}
      />
    </>
  );
}

describe("Accept for this ward (coordinator Placement)", () => {
  it("accepts with an Undo that takes the acceptance back", () => {
    render(
      <ToastProvider>
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <Harness />
        </WardFlowProvider>
      </ToastProvider>,
    );
    const [accept] = screen.getAllByTestId(/^ward-shortlist-accept-for-ward-/u);
    const unitId = accept!.dataset.testid!.replace("ward-shortlist-accept-for-ward-", "");
    fireEvent.click(accept!);
    expect(screen.getByTestId("accepted")).toHaveTextContent(unitId);
    // The toast names the person, surname first, so stacked toasts never Undo the wrong one.
    const who = screen.getByTestId("who").textContent!;
    expect(who).toMatch(/^\S.*, \S/u);
    expect(screen.getByText(`Accepted ${who} in principle for`, { exact: false })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.getByTestId("accepted")).toHaveTextContent("none");
    expect(screen.getByText(`Acceptance undone for ${who}.`, { exact: false })).toBeInTheDocument();
  });
});
