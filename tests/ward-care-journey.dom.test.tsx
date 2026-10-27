import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { COMMUNITY_TEAM_PAGES } from "@/components/ward-management/community/community-derivations";
import { useState } from "react";
import { describe, it, expect, vi } from "vitest";

const download = vi.hoisted(() => ({ blob: vi.fn<(blob: Blob, filename: string) => void>() }));
vi.mock("@/components/ward-management/ward-download", () => ({ downloadBlob: download.blob }));

import { DischargeCareJourney } from "@/components/ward-management/discharges/discharge-care-journey";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { emptyCareJourney, type CareJourney } from "@/components/ward-management/ward-care-journey";
function Workspace({ role = "coordinator", unlinked = false }: { role?: "coordinator" | "ward"; unlinked?: boolean }) {
  const { admissions, openDischargeRecord, readDischargeRecord, dayZero, dispatch, rejections } = useWardFlow();
  const [handle, setHandle] = useState<ReturnType<typeof openDischargeRecord> | null>(null);
  const admission = admissions.find((a) => a.state === "occupied" && a.patientId)!;
  const actor = role === "ward" ? ({ role, actingUnitId: admission.unitId } as const) : ({ role } as const);
  const read = readDischargeRecord(actor, admission.id, handle);
  const date = new Date(dayZero.getTime() + NOW_ANCHOR * 60_000);
  const local = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  return (
    <>
      <button onClick={() => setHandle(openDischargeRecord(actor, admission.id))}>Open care record</button>
      <button
        onClick={() =>
          dispatch({ type: "CLEAR_EXPECT_FLAG", role: "coordinator", now: NOW_ANCHOR, movementId: "missing" })
        }
      >
        Unrelated rejected command
      </button>
      <output data-testid="global-rejection-count">{rejections.length}</output>
      <output data-testid="appointment-time">{local}</output>
      {read.status === "allowed" && (
        <DischargeCareJourney
          record={unlinked ? { ...read.value, identity: { kind: "unresolved-link" } } : read.value}
          actor={actor}
        />
      )}
    </>
  );
}
function start(role?: "coordinator" | "ward") {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <Workspace role={role} />
    </WardFlowProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Open care record" }));
}
describe("care journey controls use the actual guarded provider", () => {
  it("tells the user to link the patient before any revocation or care step can be recorded", () => {
    // Owner, 20 Oct 2026: care records (a revocation included) need a linked patient.
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Workspace unlinked />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open care record" }));
    expect(screen.getByTestId("care-journey-link-first")).toHaveTextContent(/Link the patient to their record first/);
    expect(screen.queryByRole("button", { name: "Record community legal transition" })).not.toBeInTheDocument();
  });
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
    expect(screen.getByRole("region", { name: "Care journey" })).toHaveTextContent("recorded Bed coordinator");
    expect(screen.getByText("completed · appointment 1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Record appointment" }));
    expect(screen.getByText("No contact recorded for the current appointment")).toBeInTheDocument();
    expect(screen.queryByText("completed · appointment 1")).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Care journey" })).toHaveTextContent("appointment 1 (previous)");
  });
  it("records a planning fact and filters adult-only forms out of CAMHS", () => {
    start();
    fireEvent.change(screen.getByRole("combobox", { name: "Planning item" }), { target: { value: "crisis_plan" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Planning status" }), { target: { value: "completed" } });
    fireEvent.click(screen.getByRole("button", { name: "Record planning item" }));
    expect(screen.getByRole("region", { name: "Care journey" })).toHaveTextContent(
      "crisis plan: completed · Bed coordinator",
    );
    fireEvent.change(screen.getByRole("combobox", { name: "Document cohort" }), { target: { value: "camhs" } });
    expect(
      within(screen.getByRole("combobox", { name: "Document" })).queryByRole("option", { name: "Physical" }),
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
    expect(screen.getByRole("region", { name: "Care journey" })).not.toHaveTextContent("recorded Bed coordinator");
  });
});

describe("care action rejection attribution", () => {
  it("keeps a successful care save successful after an unrelated command rejection", () => {
    start();
    fireEvent.change(screen.getByRole("combobox", { name: "Planning item" }), { target: { value: "crisis_plan" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Planning status" }), { target: { value: "completed" } });
    fireEvent.click(screen.getByRole("button", { name: "Record planning item" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Unrelated rejected command" }));
    expect(screen.getByTestId("global-rejection-count")).toHaveTextContent("1");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Care journey" })).toHaveTextContent("crisis plan: completed");
  });
});

describe("D-30 transfer acceptance controls", () => {
  const stepOptions = () =>
    within(screen.getByRole("combobox", { name: "Transfer step" }))
      .getAllByRole("option")
      .map((o) => o.getAttribute("value"))
      .filter(Boolean);
  it("offers the coordinator acceptance, handover and arrival", () => {
    start("coordinator");
    expect(stepOptions()).toEqual(["accepted", "handover", "arrived"]);
  });
  it("does not offer a ward user transfer acceptance", () => {
    start("ward");
    expect(stepOptions()).toEqual(["handover"]);
    expect(screen.getByRole("region", { name: "Care journey" })).toHaveTextContent(
      "Only the central bed coordinator accepts a transfer",
    );
  });
});

describe("coding review handoff download (H-0356)", () => {
  function CodedWorkspace() {
    const { admissions, openDischargeRecord, readDischargeRecord } = useWardFlow();
    const [handle, setHandle] = useState<ReturnType<typeof openDischargeRecord> | null>(null);
    const admission = admissions.find((a) => a.state === "occupied" && a.patientId)!;
    const actor = { role: "coordinator" } as const;
    const read = readDischargeRecord(actor, admission.id, handle);
    // Synthetic departed stay coded 60 (left against advice), which separationHandoff accepts.
    const coding = {
      kind: "coding",
      receivingClass: "not_applicable",
      separationCode: "60",
      dischargedFromLeave: false,
      recordedAt: NOW_ANCHOR,
      recordedBy: "coordinator",
    } as unknown as NonNullable<CareJourney["coding"]>;
    return (
      <>
        <button onClick={() => setHandle(openDischargeRecord(actor, admission.id))}>Open care record</button>
        {read.status === "allowed" && (
          <DischargeCareJourney
            record={{
              ...read.value,
              admissionState: "departed",
              leftAt: NOW_ANCHOR,
              leavingDestination: "left-against-advice",
              careJourney: { ...emptyCareJourney(), coding },
            }}
            actor={actor}
          />
        )}
      </>
    );
  }

  it("names the file synthetic and marks the file itself synthetic", async () => {
    download.blob.mockReset();
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <CodedWorkspace />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open care record" }));
    fireEvent.click(screen.getByRole("button", { name: "Download coding review handoff" }));
    expect(download.blob).toHaveBeenCalledTimes(1);
    const [blob, filename] = download.blob.mock.calls[0]!;
    expect(filename).toMatch(/synthetic/);
    expect(JSON.parse(await blob.text())).toMatchObject({ synthetic: true, kind: "separation-review" });
  });
});
