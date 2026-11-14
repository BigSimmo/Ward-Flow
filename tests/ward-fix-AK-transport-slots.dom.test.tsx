import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import {
  BLANK_TRANSPORT_BOOKING,
  TransportBookingForm,
} from "@/components/ward-management/transport/transport-booking-form";
import type { TransportBookingAnswers } from "@/components/ward-management/ward-transport-checks";
import type { Movement, TransportExceptionReason } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/*
 * F-106 (Audit 14 A14-P2): on the Transport panel, choosing Ambulance, +30m, No escort and
 * Involuntary moved the controls below by 25 to 50 px each time. The lines that come and go keep
 * their space: the top lines' box never shrinks, "CAD to follow" takes the help line's place, and the
 * pull time limit warning keeps an empty slot while it is not needed. Synthetic data only.
 */
type Record = Pick<Movement, "legalStatus" | "legalForm"> &
  Partial<Pick<Movement, "pullExpiresAt" | "medicalClearance">>;

function Form({ record }: { record: Record }) {
  const [answers, setAnswers] = useState<TransportBookingAnswers>(BLANK_TRANSPORT_BOOKING);
  const [reason, setReason] = useState<TransportExceptionReason | "">("");
  return (
    <div data-testid="host">
      <TransportBookingForm
        answers={answers}
        onAnswers={setAnswers}
        legalReason={reason}
        onLegalReason={setReason}
        record={record}
        patientName="Synthetic, Person"
        now={NOW_ANCHOR}
        testIds={{ prefix: "t" }}
        onSubmit={() => {}}
        onCancel={() => {}}
      />
    </div>
  );
}

/** The form's rows in order, each named by its test id (or its tag), with the controls that matter. */
function layout() {
  const form = screen.getByTestId("host").firstElementChild!;
  return Array.from(form.children).map((child) => {
    const id = child.getAttribute("data-testid") ?? child.querySelector("[data-testid]")?.getAttribute("data-testid");
    return `${child.tagName.toLowerCase()}:${(id ?? "").replace(/-slot$/u, "")}`;
  });
}

// D-187 item 10: cleared, so this pins the layout alone; an uncleared booking also asks for a reason.
const involuntary: Record = {
  legalStatus: "Involuntary inpatient",
  legalForm: undefined,
  medicalClearance: { cleared: true, at: NOW_ANCHOR - 30 },
};

describe("F-106: the Transport panel's controls keep their places as answers are chosen", () => {
  it("keeps every row, in the same order, through Ambulance, +30m, No escort and Involuntary", () => {
    render(<Form record={{ ...involuntary, pullExpiresAt: NOW_ANCHOR + 20 }} />);
    const host = screen.getByTestId("host");
    const before = layout();
    const escort = screen.getByTestId("t-transport-escort");
    const legal = screen.getByTestId("t-transport-legal");
    const save = screen.getByTestId("t-book-transport-confirm");
    // The warning's slot is there, empty and hidden, before any time is picked.
    const slot = screen.getByTestId("t-transport-eta-hold-slot");
    expect(slot).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByTestId("t-transport-eta-hold")).toBeNull();

    fireEvent.change(screen.getByTestId("t-transport-provider"), { target: { value: "Ambulance (St John)" } });
    expect(screen.getByTestId("t-transport-cad-to-follow")).toBeInTheDocument();
    expect(layout()).toEqual(before);

    fireEvent.click(within(screen.getByTestId("t-transport-eta-presets")).getByRole("button", { name: "+30m" }));
    // The time is after the pull limit, so the warning now fills the same slot, not a new line.
    const hold = screen.getByTestId("t-transport-eta-hold");
    expect(hold).toBe(slot);
    expect(hold).not.toHaveAttribute("aria-hidden");
    expect(hold).toHaveTextContent("Arrives after the pull time limit ends");
    expect(layout()).toEqual(before);

    fireEvent.click(screen.getByTestId("t-transport-escort-no"));
    expect(layout()).toEqual(before);
    fireEvent.click(screen.getByTestId("t-transport-legal-involuntary"));
    expect(layout()).toEqual(before);

    // The same controls, never re-created, so nothing under the pointer is swapped.
    expect(screen.getByTestId("t-transport-escort")).toBe(escort);
    expect(screen.getByTestId("t-transport-legal")).toBe(legal);
    expect(screen.getByTestId("t-book-transport-confirm")).toBe(save);
    expect(host).toHaveTextContent("Every required answer given");
  });

  it("adds no empty slot when the record has no pull time limit", () => {
    render(<Form record={involuntary} />);
    expect(screen.queryByTestId("t-transport-eta-hold-slot")).toBeNull();
    expect(screen.queryByTestId("t-transport-eta-hold")).toBeNull();
  });

  it("CSS guard: the empty slot takes its line's space and shows nothing; the top box is a grid", () => {
    const css = readFileSync(
      join(process.cwd(), "src/components/ward-management/transport/transport-booking-form.module.css"),
      "utf8",
    );
    expect(css).toMatch(/\.slotEmpty\s*\{[^}]*visibility:\s*hidden/u);
    expect(css).not.toMatch(/\.slotEmpty\s*\{[^}]*display:\s*none/u);
    expect(css).toMatch(/\.status\s*\{[^}]*display:\s*grid/u);
  });
});
