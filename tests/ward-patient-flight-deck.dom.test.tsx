import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { PatientNowScreen } from "@/components/ward-management/patients/patient-now-screen";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { GENDER_PLACEMENT_REASONS, RELEASE_PULL_REASONS } from "@/components/ward-management/ward-change-reasons";
import { STEP_BACK_REASONS } from "@/components/ward-management/ward-model";
vi.mock("next/navigation", () => ({
  usePathname: () => "/mockups/ward-flow/people/WF-012",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));
function StateProbe() {
  const { movements, units } = useWardFlow();
  const m = movements.find((m) => m.id === "WF-012")!;
  return (
    <>
      <output data-testid="live-stage">{m.stage}</output>
      <output data-testid="live-bed-count">{units.find((u) => u.id === m.acceptedUnitId)?.allocatable.value}</output>
      <output data-testid="live-cad">{m.transport?.cadNumber}</output>
    </>
  );
}
function setup() {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <PatientNowScreen movementId="WF-012" />
      <StateProbe />
    </WardFlowProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Coordinate placement" }));
}
function referAndAccept() {
  const shortlist = screen.getByRole("region", { name: "Network ward shortlist" });
  const candidate = within(shortlist).getAllByRole("article")[0];
  fireEvent.click(within(candidate).getByRole("checkbox"));
  const refer = screen.getByRole("button", { name: "Refer to selected wards" });
  expect(refer).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Ward placement reason"), { target: { value: GENDER_PLACEMENT_REASONS[0] } });
  fireEvent.click(screen.getByLabelText("Placement checked with the ward"));
  fireEvent.click(refer);
  expect(screen.getByTestId("live-stage")).toHaveTextContent("destination_review");
  fireEvent.click(screen.getByRole("button", { name: "Accept bed" }));
  expect(screen.getByTestId("live-stage")).toHaveTextContent("accepted_awaiting_bed");
}
describe("unified Patient Now clinical flight deck", () => {
  it("keeps the local toolbar, focus, and five dossier tabs", () => {
    setup();
    expect(screen.queryByRole("link", { name: "Open the movement" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("tab")).toHaveLength(5);
    expect(screen.getByRole("heading", { name: "Transit operations" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clinical overview" }));
    expect(screen.getByRole("heading", { name: /This presentation/ })).toBeInTheDocument();
  });
  it("refers, accepts, pulls, books, dispatches and arrives through shared reducer state", () => {
    setup();
    referAndAccept();
    fireEvent.click(screen.getByRole("button", { name: "Pull patient into bed" }));
    expect(screen.getByTestId("live-stage")).toHaveTextContent("pulled");
    expect(screen.getByTestId("live-bed-count")).toHaveTextContent("0");
    fireEvent.click(screen.getByRole("button", { name: "Record transport booking" }));
    expect(screen.getByLabelText("Clinical escort required?")).toHaveValue("");
    fireEvent.change(screen.getByLabelText("Transport provider"), { target: { value: "Ambulance service" } });
    fireEvent.change(screen.getByLabelText("CAD number"), { target: { value: "CAD-SYNTHETIC-42" } });
    fireEvent.change(screen.getByLabelText("Quoted ETA (minutes from now)"), { target: { value: "45" } });
    fireEvent.change(screen.getByLabelText("Transport legal status"), { target: { value: "involuntary" } });
    fireEvent.change(screen.getByLabelText("Clinical escort required?"), { target: { value: "yes" } });
    fireEvent.click(screen.getByRole("button", { name: "Save booking" }));
    expect(screen.getByTestId("live-cad")).toHaveTextContent("CAD-SYNTHETIC-42");
    fireEvent.click(screen.getByRole("button", { name: "Mark handover ready · sending team" }));
    expect(screen.getByRole("button", { name: "Mark moving · patient collected" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Provider accepted job" }));
    fireEvent.click(screen.getByRole("button", { name: "Vehicle en route" }));
    fireEvent.click(screen.getByRole("button", { name: "Mark moving · patient collected" }));
    expect(screen.getByTestId("live-stage")).toHaveTextContent("moving");
    fireEvent.click(screen.getByRole("button", { name: "Confirm arrival · receiving ward" }));
    expect(screen.getByTestId("live-stage")).toHaveTextContent("arrived");
    expect(screen.queryByRole("button", { name: "Confirm arrival · receiving ward" })).not.toBeInTheDocument();
  });
  it("requires a step-back reason and preserves the reserved bed when correcting only the stage", () => {
    setup();
    referAndAccept();
    fireEvent.click(screen.getByRole("button", { name: "Pull patient into bed" }));
    fireEvent.click(screen.getByText("Step back with recorded reason"));
    expect(screen.getByRole("button", { name: "Record step-back" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Earlier journey stage"), { target: { value: "accepted_awaiting_bed" } });
    expect(screen.getByRole("button", { name: "Record step-back" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Clinical / operational reason"), {
      target: { value: STEP_BACK_REASONS[0] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Record step-back" }));
    expect(screen.getByTestId("live-stage")).toHaveTextContent("accepted_awaiting_bed");
    expect(screen.getByTestId("live-bed-count")).toHaveTextContent("0");
  });
  it("releases the pull only after an explicit reason and restores capacity", () => {
    setup();
    referAndAccept();
    fireEvent.click(screen.getByRole("button", { name: "Pull patient into bed" }));
    fireEvent.click(screen.getByText("Release bed pull"));
    expect(screen.getByRole("button", { name: "Release pull" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Release reason"), { target: { value: RELEASE_PULL_REASONS[0] } });
    fireEvent.click(screen.getByRole("button", { name: "Release pull" }));
    expect(screen.getByTestId("live-stage")).toHaveTextContent("accepted_awaiting_bed");
    expect(screen.getByTestId("live-bed-count")).toHaveTextContent("1");
  });
  it("legacy movement route renders the same dossier", async () => {
    const { default: Page } = await import("@/app/mockups/ward-flow/movements/[movementId]/page");
    const page = await Page({ params: Promise.resolve({ movementId: "WF-012" }) });
    render(<WardFlowProvider initialNow={NOW_ANCHOR}>{page}</WardFlowProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Coordinate placement" }));
    expect(screen.getByRole("heading", { name: "Transit operations" })).toBeInTheDocument();
  });
});
