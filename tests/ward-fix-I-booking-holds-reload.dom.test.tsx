import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  BLANK_TRANSPORT_BOOKING,
  TransportBookingForm,
  transportBookingTestId,
} from "@/components/ward-management/transport/transport-booking-form";
import { unsavedWorkHoldsReload } from "@/components/ward-management/ward-chunk-load-error";
import { MINUTES_PER_DAY } from "@/components/ward-management/ward-clock";
import type { TransportExceptionReason } from "@/components/ward-management/ward-model";
import type { TransportBookingAnswers } from "@/components/ward-management/ward-transport-checks";

/*
 * Audit 4 A4-06 (13 Nov 2026): Reload on the "New version of Ward Flow ready" notice dropped a
 * half-filled booking on the patient page, whose form had no unsaved-work guard. The form itself now
 * raises the same signal every guarded form raises (`beforeunload`), so the reload waits.
 */
afterEach(cleanup);

const NOW = 3 * MINUTES_PER_DAY + 10 * 60 + 42;
const ids = { prefix: "t", suffix: "WF-1" };

function Harness() {
  const [answers, setAnswers] = useState<TransportBookingAnswers>(BLANK_TRANSPORT_BOOKING);
  const [reason, setReason] = useState<TransportExceptionReason | "">("");
  return (
    <TransportBookingForm
      answers={answers}
      onAnswers={setAnswers}
      legalReason={reason}
      onLegalReason={setReason}
      record={undefined}
      patientName="Synthetic Person"
      now={NOW}
      testIds={ids}
      onSubmit={vi.fn()}
    />
  );
}

describe("transport booking form holds a reload (A4-06)", () => {
  it("counts a typed CAD number as unsaved work, and lets go once it is cleared", () => {
    render(<Harness />);
    expect(unsavedWorkHoldsReload()).toBe(false);

    const cad = screen.getByTestId(transportBookingTestId(ids, "cad"));
    fireEvent.change(cad, { target: { value: "CAD-48213" } });
    expect(unsavedWorkHoldsReload()).toBe(true);

    fireEvent.change(cad, { target: { value: "" } });
    expect(unsavedWorkHoldsReload()).toBe(false);
  });

  it("counts a chosen provider too, and lets go when the form closes", () => {
    const { unmount } = render(<Harness />);
    fireEvent.change(screen.getByTestId(transportBookingTestId(ids, "provider")), {
      target: { value: "Ambulance (St John)" },
    });
    expect(unsavedWorkHoldsReload()).toBe(true);
    unmount();
    expect(unsavedWorkHoldsReload()).toBe(false);
  });
});
