import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";

import { WardBedListPrint } from "@/components/ward-management/ward/ward-bed-list-print";
import type { WardScreenBed } from "@/components/ward-management/ward/ward-screen-derivations";
import { NOW_ANCHOR, unitById } from "@/components/ward-management/ward-sites";

/**
 * Tier 1 item 9 (Josh, 4 Nov 2026): the Ward page's printed bed list. Synthetic beds, only the fields
 * the list reads. Legal times are as typed and never a running figure.
 */
const unit = unitById("rph-adult-secure");
if (!unit) throw new Error("rph-adult-secure seed missing");

const bed = (fields: Partial<WardScreenBed>): WardScreenBed =>
  ({ bedLabel: "", statusText: "", ...fields }) as WardScreenBed;

const beds: WardScreenBed[] = [
  bed({
    bedNumber: 1,
    status: "occupied",
    patientAlias: "Testwood, Ada",
    umrn: "UM900001",
    stayDays: 12,
    legalStatusLabel: "Form 6A Involuntary inpatient",
    legalForm: { code: "6A", dueAt: NOW_ANCHOR + 120 },
    observation: { level: "general", intervalMinutes: null, reviewAt: null },
    expectedDischargeLabel: "Fri",
    blockReason: "Awaiting accommodation",
  }),
  bed({ bedNumber: 2, status: "ready", statusText: "Ready", patientAlias: "Old, Name" }),
  bed({ bedNumber: 3, status: "closed", statusText: "Closed" }),
];

describe("printed bed list", () => {
  it("lists every bed with who is in it, the legal status and the form's end time as typed", () => {
    render(<WardBedListPrint unit={unit} beds={beds} now={NOW_ANCHOR} />);
    expect(screen.getByRole("heading", { name: `${unit.name} bed list` })).toBeInTheDocument();
    const first = within(screen.getByTestId("ward-bed-list-print-1"));
    expect(first.getByText("Testwood, Ada")).toBeInTheDocument();
    expect(first.getByText("UM900001")).toBeInTheDocument();
    expect(first.getByText("Held up, Awaiting accommodation")).toBeInTheDocument();
    expect(first.getByText("Form 6A Involuntary inpatient")).toBeInTheDocument();
    expect(first.getByText(/^Ends 12:42 as typed$/u)).toBeInTheDocument();
    expect(first.getByText("General, hourly")).toBeInTheDocument();
  });

  it("names nobody on a free or closed bed", () => {
    render(<WardBedListPrint unit={unit} beds={beds} now={NOW_ANCHOR} />);
    const ready = screen.getByTestId("ward-bed-list-print-2");
    expect(ready).toHaveTextContent("Ready");
    expect(ready).not.toHaveTextContent("Old, Name");
    expect(ready).not.toHaveTextContent("Not recorded");
    expect(screen.getByTestId("ward-bed-list-print-3")).toHaveTextContent("Closed");
  });

  it("shows no form end once the label names a later form", () => {
    const moved = bed({
      bedNumber: 4,
      status: "occupied",
      patientAlias: "Testwood, Bea",
      legalStatusLabel: "Form 3A not recorded (Form 1A ended 09:00)",
      legalForm: { code: "1A", dueAt: NOW_ANCHOR - 60 },
    });
    render(<WardBedListPrint unit={unit} beds={[moved]} now={NOW_ANCHOR} />);
    expect(screen.getByTestId("ward-bed-list-print-4")).not.toHaveTextContent("as typed");
  });
});
