import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useState } from "react";
import { DischargeFollowUp } from "@/components/ward-management/discharges/discharge-follow-up";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

// Open only on explicit activation, never as a render side effect.
function Workspace() {
  const { admissions, readDischargeRecord, openDischargeRecord } = useWardFlow();
  const [handle, setHandle] = useState<ReturnType<typeof openDischargeRecord> | null>(null);
  const admission = admissions.find((row) => row.state === "occupied" && row.patientId)!;
  const actor = { role: "coordinator" } as const;
  const read = readDischargeRecord(actor, admission.id, handle);
  return (
    <>
      <button onClick={() => setHandle(openDischargeRecord(actor, admission.id))}>Open record</button>
      {read.status === "allowed" && <DischargeFollowUp record={read.value} actor={actor} />}
    </>
  );
}

describe("follow-up arrangement form uses actual provider state", () => {
  it("starts unknown and records both statuses with attribution", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Workspace />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open record" }));
    expect(screen.getByTestId("ward-discharge-follow-up-status")).toHaveTextContent("Not recorded");
    expect(screen.getByRole("button", { name: "Record follow-up status" })).toBeDisabled();
    for (const [value, label] of [
      ["arranged", "Arranged"],
      ["not_arranged", "Not arranged"],
    ]) {
      fireEvent.change(screen.getByRole("combobox", { name: "Arrangement status" }), { target: { value } });
      fireEvent.click(screen.getByRole("button", { name: "Record follow-up status" }));
      expect(screen.getByTestId("ward-discharge-follow-up-status")).toHaveTextContent(`${label} · Flow coordinator`);
    }
    expect(screen.getByText(/does not confirm that follow-up occurred/)).toBeInTheDocument();
  });
});
