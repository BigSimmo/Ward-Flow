import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EventFacts } from "@/components/ward-management/governance-event-facts";
import type { AuditEvent } from "@/components/ward-management/ward-audit";
import {
  observationWithReview,
  WardObservationControl,
} from "@/components/ward-management/ward/ward-observation-control";
import type { Observation } from "@/components/ward-management/ward-observation";

/**
 * Time audit T7 (13 Nov 2026): an observation review time that has passed says so — "Review was
 * due 09:00" with a warning glyph — rather than reading like one still to come.
 */
const NOW = 3 * 24 * 60 + 10 * 60 + 42;
const passed: Observation = { level: "intermittent", intervalMinutes: 15, reviewAt: NOW - 102 };
const ahead: Observation = { level: "intermittent", intervalMinutes: 15, reviewAt: NOW + 78 };

describe("observation review time (T7)", () => {
  it("says a passed review was due, and a future one plainly", () => {
    expect(observationWithReview(passed, NOW)).toBe("Intermittent, every 15 minutes. Review was due 09:00");
    expect(observationWithReview(ahead, NOW)).toBe("Intermittent, every 15 minutes. Review 12:00");
  });

  it("marks the passed review in the control in warning tone", () => {
    const { rerender } = render(<WardObservationControl observation={passed} now={NOW} />);
    const line = screen.getByTestId("ward-observation-current");
    expect(line).toHaveTextContent("Review was due 09:00");
    expect(line.querySelector('[data-wf-glyph="warning"]')).not.toBeNull();
    rerender(<WardObservationControl observation={ahead} now={NOW} />);
    expect(screen.getByTestId("ward-observation-current").querySelector('[data-wf-glyph="warning"]')).toBeNull();
  });

  it("says the same in the governance facts", () => {
    const event = {
      id: "evt-synthetic",
      category: "patient-record",
      action: "RECORD_OBSERVATION_LEVEL",
      at: NOW - 200,
      details: { before: ahead, requested: passed, after: passed },
    } as unknown as AuditEvent;
    const { container } = render(<EventFacts event={event} units={[]} now={NOW} />);
    expect(container.textContent).toContain("review was due 09:00");
    expect(container.textContent).toContain("review 12:00");
  });
});
