import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { COMMUNITY_TEAM_PAGES } from "@/components/ward-management/community/community-derivations";
import { useState } from "react";
import { describe, it, expect } from "vitest";
import { DischargeCareJourney } from "@/components/ward-management/discharges/discharge-care-journey";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
function Workspace() {
  const { admissions, openDischargeRecord, readDischargeRecord, dayZero } = useWardFlow();
  const [handle, setHandle] = useState<ReturnType<typeof openDischargeRecord> | null>(null);
  const admission = admissions.find((a) => a.state === "occupied" && a.patientId)!;
  const actor = { role: "coordinator" } as const;
  const read = readDischargeRecord(actor, admission.id, handle);
  const date = new Date(dayZero.getTime() + NOW_ANCHOR * 60_000);
  const local = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  return (
    <>
      <button onClick={() => setHandle(openDischargeRecord(actor, admission.id))}>Open care record</button>
      <output data-testid="appointment-time">{local}</output>
      {read.status === "allowed" && <DischargeCareJourney record={read.value} actor={actor} />}
    </>
  );
}
function start() {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <Workspace />
    </WardFlowProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Open care record" }));
}
describe("care journey controls use the actual guarded provider", () => {
  it("records a chosen clinician and appointment then an actual contact outcome", () => {
    start();
    fireEvent.change(screen.getByRole("combobox", { name: "Responsible clinician" }), {
      target: { value: "demo-adult-clinician" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Responsible community service" }), {
      target: { value: COMMUNITY_TEAM_PAGES[0].id },
    });
    fireEvent.change(screen.getByLabelText("Appointment date and time"), {
      target: { value: screen.getByTestId("appointment-time").textContent },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Appointment mode" }), { target: { value: "telephone" } });
    fireEvent.click(screen.getByRole("button", { name: "Record appointment" }));
    expect(screen.getByRole("region", { name: "Care journey" })).toHaveTextContent("Dr Alex Taylor");
    fireEvent.change(screen.getByRole("combobox", { name: "Contact outcome" }), { target: { value: "completed" } });
    fireEvent.change(screen.getByLabelText("Contact date and time"), {
      target: { value: screen.getByTestId("appointment-time").textContent },
    });
    fireEvent.click(screen.getByRole("button", { name: "Record contact outcome" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Care journey" })).toHaveTextContent("recorded Flow coordinator");
  });
  it("records a planning fact and filters adult-only forms out of CAMHS", () => {
    start();
    fireEvent.change(screen.getByRole("combobox", { name: "Planning item" }), { target: { value: "crisis_plan" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Planning status" }), { target: { value: "completed" } });
    fireEvent.click(screen.getByRole("button", { name: "Record planning item" }));
    expect(screen.getByRole("region", { name: "Care journey" })).toHaveTextContent(
      "crisis plan: completed · Flow coordinator",
    );
    fireEvent.change(screen.getByRole("combobox", { name: "Document cohort" }), { target: { value: "camhs" } });
    expect(
      within(screen.getByRole("combobox", { name: "Document" })).queryByRole("option", { name: "physical" }),
    ).not.toBeInTheDocument();
  });
  it("shows a failed contact action without displaying completion", () => {
    start();
    fireEvent.change(screen.getByRole("combobox", { name: "Contact outcome" }), { target: { value: "completed" } });
    fireEvent.change(screen.getByLabelText("Contact date and time"), {
      target: { value: screen.getByTestId("appointment-time").textContent },
    });
    fireEvent.click(screen.getByRole("button", { name: "Record contact outcome" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Record responsibility and an appointment first");
    expect(screen.getByRole("region", { name: "Care journey" })).not.toHaveTextContent("recorded Flow coordinator");
  });
});
