import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { PatientNowScreen } from "@/components/ward-management/patients/patient-now-screen";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { GENDER_PLACEMENT_REASONS } from "@/components/ward-management/ward-change-reasons";

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  },
  usePathname: () => "/ward-flow/people/WF-012",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

// A ward answering no. The coordinator records it for the ward, as the engine allows. A no_bed
// answer would waitlist the ward instead, and a waitlisted ward is still waiting.
function DeclineFirstAsked() {
  const { movements, dispatch, now } = useWardFlow();
  const movement = movements.find((m) => m.id === "WF-012")!;
  const unitId = movement.referredUnitIds[0];
  return (
    <button
      type="button"
      onClick={() =>
        dispatch({
          type: "DECLINE",
          role: "coordinator",
          now,
          movementId: "WF-012",
          unitId,
          reason: "capability_mismatch",
        })
      }
    >
      First ward declines
    </button>
  );
}

// Another coordinator asking a ward on the same movement while this pane holds ticks.
function AskElsewhere({ unitId }: { unitId: () => string }) {
  const { dispatch, now } = useWardFlow();
  return (
    <button
      type="button"
      onClick={() =>
        dispatch({
          type: "REFER_TO_UNITS",
          role: "coordinator",
          now,
          movementId: "WF-012",
          unitIds: [unitId()],
          genderPlacementReason: GENDER_PLACEMENT_REASONS[0],
          genderPlacementChecked: true,
        })
      }
    >
      Someone else asks a ward
    </button>
  );
}

function enabledBoxes(region: HTMLElement) {
  return within(region)
    .getAllByRole("checkbox")
    .filter((box) => !box.hasAttribute("disabled"));
}

describe("Ask wards (D-77): the list holds at the cap of wards still waiting (D-76)", () => {
  it("refuses a fourth tick, counts wards already asked, and frees a slot when a ward declines", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <PatientNowScreen movementId="WF-012" />
        <DeclineFirstAsked />
      </WardFlowProvider>,
    );
    fireEvent.click(within(screen.getByTestId("ward-patient-gate-bed")).getByRole("button"));
    const region = screen.getByRole("region", { name: "Ask wards" });
    expect(screen.getByTestId("ward-ask-count")).toHaveTextContent("0 of 3 chosen");
    expect(screen.getByRole("button", { name: "Pick up to 3 wards" })).toHaveAttribute("aria-disabled", "true");

    const fits = enabledBoxes(region);
    expect(fits.length).toBeGreaterThan(3);
    fits.slice(0, 3).forEach((box) => fireEvent.click(box));
    expect(screen.getByTestId("ward-ask-count")).toHaveTextContent("3 of 3 chosen");
    expect(fits[3]).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Ward placement reason"), {
      target: { value: GENDER_PLACEMENT_REASONS[0] },
    });
    fireEvent.click(screen.getByLabelText("Placement checked with the ward"));
    fireEvent.click(screen.getByRole("button", { name: "Ask 3 wards" }));

    // Three wards are waiting, so nothing more can be ticked.
    const asked = screen.getByRole("region", { name: "Ask wards" });
    expect(within(asked).getByRole("list", { name: "Wards asked" }).children).toHaveLength(3);
    expect(enabledBoxes(asked)).toHaveLength(0);
    expect(screen.getByRole("button", { name: "3 wards already asked" })).toHaveAttribute("aria-disabled", "true");

    // A declined ward is no longer waiting, so its slot comes back.
    fireEvent.click(screen.getByRole("button", { name: "First ward declines" }));
    expect(
      within(screen.getByRole("region", { name: "Ask wards" })).getByRole("list", { name: "Wards asked" }).children,
    ).toHaveLength(2);
    expect(screen.getByTestId("ward-ask-count")).toHaveTextContent("0 of 1 chosen");
    expect(screen.getByRole("button", { name: "Pick up to 1 ward" })).toBeInTheDocument();
    expect(enabledBoxes(screen.getByRole("region", { name: "Ask wards" })).length).toBeGreaterThan(0);
  });

  it("holds the Ask button when someone else asks a ward and leaves fewer slots than ticks", () => {
    let otherUnitId = "";
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <PatientNowScreen movementId="WF-012" />
        <AskElsewhere unitId={() => otherUnitId} />
      </WardFlowProvider>,
    );
    fireEvent.click(within(screen.getByTestId("ward-patient-gate-bed")).getByRole("button"));
    const fits = enabledBoxes(screen.getByRole("region", { name: "Ask wards" }));
    otherUnitId = fits[3]
      .closest("[data-testid^='ward-ask-ward-']")!
      .getAttribute("data-testid")!
      .slice("ward-ask-ward-".length);
    fits.slice(0, 3).forEach((box) => fireEvent.click(box));
    fireEvent.change(screen.getByLabelText("Ward placement reason"), {
      target: { value: GENDER_PLACEMENT_REASONS[0] },
    });
    fireEvent.click(screen.getByLabelText("Placement checked with the ward"));
    expect(screen.getByRole("button", { name: "Ask 3 wards" })).not.toHaveAttribute("aria-disabled");

    fireEvent.click(screen.getByRole("button", { name: "Someone else asks a ward" }));
    expect(screen.getByTestId("ward-ask-count")).toHaveTextContent("3 of 2 chosen");
    expect(screen.getByRole("button", { name: "Pick up to 2 wards" })).toHaveAttribute("aria-disabled", "true");
  });
});
