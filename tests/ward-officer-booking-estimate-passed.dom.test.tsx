import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { renderArrivalsCard } from "@/components/ward-management/officer/officer-arrivals-card";
import type { Movement } from "@/components/ward-management/ward-model";

afterEach(cleanup);

/**
 * P068 (approved by Josh in chat, 27 Oct 2026, 8:35 PM AWST): a booking estimate that has passed is the
 * transport provider's quoted time, not a ward ETA, so the Arrivals card says "Booking estimate passed
 * 13m ago" rather than calling the job overdue. Synthetic demo data only.
 */
function renderWith(eta: number, now: number) {
  const movement = { id: "m-p068" } as unknown as Movement;
  render(
    renderArrivalsCard({
      arrivals: [{ movement, eta, booked: true }],
      arrivalsLeft: () => "0%",
      destinationLabelFor: () => "Test Ward",
      firstUpcoming: -1,
      hourTicks: [],
      now,
      officerPatientName: () => "Test Patient",
      openJob: () => undefined,
      umrnFor: () => "U0000000",
      upcoming: 0,
    }),
  );
}

describe("Arrivals card: a passed booking estimate (P068)", () => {
  it("says how long ago the booking estimate passed", () => {
    renderWith(1000, 1013);
    expect(screen.getByText("Booking estimate passed 13m ago")).toBeTruthy();
    expect(screen.queryByText(/overdue/)).toBeNull();
  });

  it("keeps the time left for a booking estimate still to come", () => {
    renderWith(1013, 1000);
    expect(screen.queryByText(/Booking estimate passed/)).toBeNull();
    expect(screen.getByText(/^Booking estimate .* left$/)).toBeTruthy();
  });
});