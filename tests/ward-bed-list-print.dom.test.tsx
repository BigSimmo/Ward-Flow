import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { render, screen, within } from "@testing-library/react";

import { WardBedListPrint } from "@/components/ward-management/ward/ward-bed-list-print";
import { WardBedListPrint as ImmediateWardPrint } from "@/components/ward-management/ward/ward-screen-lazy";
import type { WardScreenBed } from "@/components/ward-management/ward/ward-screen-derivations";
import { NOW_ANCHOR, unitById } from "@/components/ward-management/ward-sites";

vi.mock("next/navigation", () => ({ usePathname: () => "/ward-flow/ward/rph-adult-secure" }));

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

/** A fixed synthetic calendar day for instant 0, so printed dates are stable. */
const DAY_ZERO = new Date("2026-11-02T00:00:00+08:00");

describe("printed bed list", () => {
  it("lists every bed with who is in it, the legal status and the form's end time as typed", () => {
    render(<WardBedListPrint unit={unit} beds={beds} now={NOW_ANCHOR} dayZero={DAY_ZERO} />);
    expect(screen.getByRole("heading", { name: `${unit.name} bed list` })).toBeInTheDocument();
    const first = within(screen.getByTestId("ward-bed-list-print-1"));
    expect(first.getByText("Testwood, Ada")).toBeInTheDocument();
    expect(first.getByText("UM900001")).toBeInTheDocument();
    expect(first.getByText("Held up, Awaiting accommodation")).toBeInTheDocument();
    expect(first.getByText("Form 6A Involuntary inpatient")).toBeInTheDocument();
    // Dated, never "tomorrow": the sheet outlives the day it was printed (review: Codex).
    expect(first.getByText(/^Ends Mon, 2 Nov, 12:42 as typed$/u)).toBeInTheDocument();
    expect(screen.getByText(/^As at Mon, 2 Nov 2026, \d{2}:\d{2} AWST\./u)).toBeInTheDocument();
    expect(first.getByText("General, hourly")).toBeInTheDocument();
  });

  it("names nobody on a free or closed bed", () => {
    render(<WardBedListPrint unit={unit} beds={beds} now={NOW_ANCHOR} dayZero={DAY_ZERO} />);
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
    render(<WardBedListPrint unit={unit} beds={[moved]} now={NOW_ANCHOR} dayZero={DAY_ZERO} />);
    expect(screen.getByTestId("ward-bed-list-print-4")).not.toHaveTextContent("as typed");
  });
});

describe("printed bed list audit boundaries", () => {
  it("marks only the hydrated table ready for printing", () => {
    const props = { unit, beds, now: NOW_ANCHOR, dayZero: DAY_ZERO };
    expect(renderToString(<WardBedListPrint {...props} />)).not.toContain("data-print-ready");
    render(<WardBedListPrint {...props} />);
    expect(screen.getByTestId("ward-bed-list-print")).toHaveAttribute("data-print-ready");
  });

  it("has its complete table on first render without waiting for a lazy module", () => {
    render(<ImmediateWardPrint unit={unit} beds={beds} now={NOW_ANCHOR} dayZero={DAY_ZERO} />);
    expect(screen.getAllByRole("row")).toHaveLength(beds.length + 1);
  });

  it.each([
    ["On leave", "On leave"],
    ["Absent without leave", "Absent without leave"],
  ])("preserves the leave distinction %s", (statusText, expected) => {
    render(
      <WardBedListPrint
        unit={unit}
        beds={[bed({ bedNumber: 5, status: "leave", statusText })]}
        now={NOW_ANCHOR}
        dayZero={DAY_ZERO}
      />,
    );
    expect(screen.getByTestId("ward-bed-list-print-5")).toHaveTextContent(expected);
  });

  it.each([
    [undefined, "Pulled"],
    [0, "Arrived at ward"],
  ])("distinguishes typed delivery %s from a pull", (deliveredAt, expected) => {
    render(
      <WardBedListPrint
        unit={unit}
        beds={[bed({ bedNumber: 5, status: "incoming", deliveredAt })]}
        now={NOW_ANCHOR}
        dayZero={DAY_ZERO}
      />,
    );
    expect(screen.getByTestId("ward-bed-list-print-5")).toHaveTextContent(expected);
  });

  it.each([0, 1440])("retains the expected calendar date at minute %s", (expectedDischargeAt) => {
    render(
      <WardBedListPrint
        unit={unit}
        beds={[bed({ bedNumber: 5, status: "occupied", expectedDischargeAt })]}
        now={NOW_ANCHOR}
        dayZero={DAY_ZERO}
      />,
    );
    expect(screen.getByTestId("ward-bed-list-print-5")).toHaveTextContent(
      expectedDischargeAt === 0 ? "Mon, 2 Nov, 00:00" : "Tue, 3 Nov, 00:00",
    );
  });

  it("does not print a historical end for an explicitly ended form", () => {
    const ended = { code: "1A", dueAt: 0, endedBy: "revoked" as const };
    render(
      <WardBedListPrint
        unit={unit}
        beds={[bed({ bedNumber: 5, status: "occupied", legalStatusLabel: "Form 1A", legalForm: ended })]}
        now={NOW_ANCHOR}
        dayZero={DAY_ZERO}
      />,
    );
    expect(screen.getByTestId("ward-bed-list-print-5")).not.toHaveTextContent("as typed");
  });
});
