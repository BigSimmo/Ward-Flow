import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow",
  useRouter: () => ({ back: vi.fn(), replace: vi.fn() }),
}));

import { ShortlistPanel } from "@/components/ward-management/coordinator/shortlist-panel";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import type { MovementId } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { wardAdmissions } from "@/components/ward-management/ward-admissions-seed";

/** P125 (audit 27 Oct 2026): "Pulled" stays (D-81), and the shortlist explains it once with a glossary link. */
function Harness({ movementId }: { movementId: MovementId }) {
  const { movements, units, bedReleases, leaveBeds, referrals, now, dispatch, configuration } = useWardFlow();
  return (
    <ShortlistPanel
      movement={movements.find((candidate) => candidate.id === movementId)}
      now={now}
      units={units}
      bedReleases={bedReleases}
      leaveBeds={leaveBeds}
      admissions={wardAdmissions}
      referrals={referrals}
      selectedUnitId={undefined}
      onSelectUnit={() => {}}
      dispatch={dispatch}
      parallelReferralCap={configuration.parallelReferralCap}
    />
  );
}

describe("P125: Pulled is explained on the shortlist, with a glossary link", () => {
  it("keeps the word Pulled in the bed lines and says once what it means", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Harness movementId={"WF-009" as MovementId} />
      </WardFlowProvider>,
    );
    expect(screen.getAllByText(/Pulled \d+/).length).toBeGreaterThan(0);
    const note = screen.getByTestId("ward-shortlist-pulled-note");
    expect(note.textContent).toContain(
      "Pulled means a bed kept for one named, accepted incoming patient, for a set time.",
    );
    const seen: unknown[] = [];
    const listener = (event: Event) => seen.push((event as CustomEvent).detail);
    window.addEventListener("ward-flow-open-help", listener);
    fireEvent.click(within(note).getByRole("button", { name: "Help glossary" }));
    window.removeEventListener("ward-flow-open-help", listener);
    expect(seen).toEqual([{ view: "glossary" }]);
  });
});
