import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Hero } from "@/components/wf";
import { PatientFlightHeader } from "@/components/ward-management/patients/patient-flight-header";

/*
 * Phone audit (Josh, 1 Nov 2026, Q153): the kit Hero hides a repeated eyebrow on a phone. A hero
 * whose eyebrow says something the header does not opts back in with phoneEyebrow="show". The
 * patient hero's phone eyebrow carries the movement's tier, bed type and observation chip, so it
 * must stay drawn. Synthetic data only.
 */

vi.mock("@/components/wf", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/wf")>()),
  useIsPhone: () => true,
}));

afterEach(cleanup);

function heroOf(text: string): HTMLElement {
  const hero = screen.getByText(text).closest<HTMLElement>("[data-wf-hero]");
  if (!hero) throw new Error("no hero");
  return hero;
}

describe("Hero phone eyebrow", () => {
  it("hides the eyebrow on a phone by default and keeps it when asked", () => {
    render(
      <>
        <Hero eyebrow="Repeated page name" title="Default hero" />
        <Hero eyebrow="Shift only" title="Opted-in hero" phoneEyebrow="show" />
        <Hero title="No eyebrow hero" />
      </>,
    );
    expect(heroOf("Default hero").dataset.phoneEyebrow).toBe("hide");
    expect(heroOf("Opted-in hero").dataset.phoneEyebrow).toBe("show");
    expect(heroOf("No eyebrow hero").hasAttribute("data-phone-eyebrow")).toBe(false);
  });

  it("keeps the patient hero's movement eyebrow drawn on a phone", () => {
    render(
      <PatientFlightHeader
        displayName="Test, Synthetic"
        displayToday={new Date("2026-11-01T00:00:00Z")}
        isLiveBedflow
        statusDetail="Synthetic movement"
        phoneEyebrow={<span>Movement · Urgent · Secure · 1:1 observation</span>}
        tabs={null}
      />,
    );
    expect(screen.getByText("Movement · Urgent · Secure · 1:1 observation")).toBeTruthy();
    expect(heroOf("Test, Synthetic").dataset.phoneEyebrow).toBe("show");
  });
});
