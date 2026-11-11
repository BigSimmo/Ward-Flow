import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EdScreen } from "@/components/ward-management/ed/ed-screen";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/*
 * Item 9 (police and ambulance handover times, D-93). WF-009 was brought to Peel's emergency
 * department by police (synthetic seed). Its record shows the police crew's three typed times in
 * place of "Police in attendance", and the board counts the crew while it waits.
 */
function CrewProbe() {
  const { movements } = useWardFlow();
  const movement = movements.find((m) => m.id === "WF-009");
  return (
    <p data-testid="probe">
      {[movement?.crewArrivedAt, movement?.crewHandedOverAt, movement?.crewReleasedAt].map(String).join("|")}
    </p>
  );
}

function openPolicePatient() {
  fireEvent.click(screen.getByTestId("ward-ed-row-name-WF-009"));
  fireEvent.click(
    within(screen.getByTestId("ward-ed-phone-sheet-WF-009")).getByRole("button", { name: "Open patient" }),
  );
  return screen.findByTestId("ward-ed-crew-times");
}

describe("ED patient record — police and ambulance crew times", () => {
  it("shows an old record's crew as not recorded, with empty boxes and no wait", async () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <EdScreen edId="peel-ed" />
      </WardFlowProvider>,
    );
    const crew = await openPolicePatient();
    expect(within(crew).getByRole("heading", { name: "Police crew" })).toBeInTheDocument();
    expect(within(crew).getAllByText("Not recorded")).toHaveLength(3);
    for (const box of within(crew).getAllByRole("textbox")) expect(box).toHaveValue("");
    expect(screen.queryByText("Police in attendance")).toBeNull();
    expect(screen.queryByTestId("ward-ed-crews-waiting")).toBeNull();
  });

  it("saves only the typed time and counts the crew as waiting until it is released", async () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <EdScreen edId="peel-ed" />
        <CrewProbe />
      </WardFlowProvider>,
    );
    const crew = await openPolicePatient();
    const typedArrival = NOW_ANCHOR - 40;
    const clock = (at: number) =>
      `${String(Math.floor((at % 1440) / 60)).padStart(2, "0")}:${String(at % 60).padStart(2, "0")}`;
    fireEvent.change(within(crew).getByTestId("ward-ed-crew-time-crewArrivedAt"), {
      target: { value: clock(typedArrival) },
    });
    fireEvent.click(within(crew).getByTestId("ward-ed-crew-times-save"));
    await waitFor(() => expect(screen.getByTestId("probe")).toHaveTextContent(`${typedArrival}|undefined|undefined`));
    expect(await screen.findByTestId("ward-ed-crews-waiting")).toHaveTextContent("Crews waiting: 1, longest 40m");

    fireEvent.change(within(crew).getByTestId("ward-ed-crew-time-crewReleasedAt"), {
      target: { value: clock(NOW_ANCHOR - 5) },
    });
    fireEvent.click(within(crew).getByTestId("ward-ed-crew-times-save"));
    await waitFor(() =>
      expect(screen.getByTestId("probe")).toHaveTextContent(`${typedArrival}|undefined|${NOW_ANCHOR - 5}`),
    );
    expect(screen.queryByTestId("ward-ed-crews-waiting")).toBeNull();
  });

  it("will not save until a time is typed", async () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <EdScreen edId="peel-ed" />
        <CrewProbe />
      </WardFlowProvider>,
    );
    const crew = await openPolicePatient();
    const save = within(crew).getByTestId("ward-ed-crew-times-save");
    expect(save).toHaveAttribute("aria-disabled", "true");
    expect(within(crew).getByText("Type at least one time from the paper.")).toBeInTheDocument();
    fireEvent.click(save);
    expect(screen.getByTestId("probe")).toHaveTextContent("undefined|undefined|undefined");
  });
});

/*
 * D-141 (Josh, 11 Nov 2026): "Brought by: Police / Ambulance" on an ED arrival with no seeded mode.
 * WF-005 is a synthetic Peel arrival with no arrival mode. Nothing is chosen for the person; once
 * marked and saved, the crew section appears.
 */
function ModeProbe() {
  const { movements } = useWardFlow();
  return <p data-testid="mode-probe">{String(movements.find((m) => m.id === "WF-005")?.arrivalMode)}</p>;
}

describe("ED patient record — brought by police or ambulance (D-141)", () => {
  it("starts with nothing chosen, saves the choice, then shows the crew times", async () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <EdScreen edId="peel-ed" />
        <ModeProbe />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByTestId("ward-ed-row-name-WF-005"));
    fireEvent.click(
      within(screen.getByTestId("ward-ed-phone-sheet-WF-005")).getByRole("button", { name: "Open patient" }),
    );
    const block = await screen.findByTestId("ward-ed-brought-by");
    const group = within(block).getByRole("radiogroup", { name: "Brought by" });
    for (const radio of within(group).getAllByRole("radio")) expect(radio).toHaveAttribute("aria-checked", "false");
    expect(screen.queryByTestId("ward-ed-crew-times")).toBeNull();
    expect(within(block).queryByTestId("ward-ed-brought-by-save")).toBeNull();

    // Choosing alone records nothing.
    fireEvent.click(within(group).getByRole("radio", { name: "Ambulance" }));
    expect(screen.getByTestId("mode-probe")).toHaveTextContent("undefined");
    fireEvent.click(within(block).getByTestId("ward-ed-brought-by-save"));
    await waitFor(() => expect(screen.getByTestId("mode-probe")).toHaveTextContent("ambulance"));
    const crew = await screen.findByTestId("ward-ed-crew-times");
    expect(within(crew).getByRole("heading", { name: "Ambulance crew" })).toBeInTheDocument();
    expect(within(group).getByRole("radio", { name: "Ambulance" })).toHaveAttribute("aria-checked", "true");
  });

  it("shows a seeded police arrival as marked Police", async () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <EdScreen edId="peel-ed" />
      </WardFlowProvider>,
    );
    await openPolicePatient();
    const block = screen.getByTestId("ward-ed-brought-by");
    expect(within(block).getByRole("radio", { name: "Police" })).toHaveAttribute("aria-checked", "true");
  });
});
