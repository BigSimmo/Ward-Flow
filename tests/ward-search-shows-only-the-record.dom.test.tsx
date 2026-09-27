import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { PatientSearchPage } from "@/components/ward-management/search/patient-search";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * **PATIENT SEARCH SHOWS ONLY WHAT THE RECORD HOLDS.**
 *
 * The search page used to fill every gap with an invention: an age of 38 or 34, a sex of "Male" or
 * "Female", a legal status looked up in a table keyed by movement id (or "Voluntary" by default),
 * a "VOLUNTARY" badge for any status that was not Form 1A, 4A or 5A, a clinical note, "Consent
 * verified", prior admissions, a last discharge, and a risk flag of "Close Observation · Aggression
 * Alert" for every tier 1 patient (25 September 2026 audit, A5). Josh chose "All of it" on
 * 25 September 2026: every value comes from the record or says "Not recorded".
 */

function pageText(): string {
  const { container } = render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <PatientSearchPage />
    </WardFlowProvider>,
  );
  return container.textContent ?? "";
}

describe("patient search shows only what the record holds", () => {
  it("never invents a risk flag, a history, consent or a clinical note", () => {
    const text = pageText();
    expect(text.length).toBeGreaterThan(500);
    for (const invented of [
      "Aggression Alert",
      "Low elopement",
      "Consent verified",
      "Severe acute psychiatric presentation",
      "18 days ago · RPH Ward 8",
      "2 admissions (Total 14 days)",
      "Operational state verified by Bed Coordinator",
    ]) {
      expect(text, invented).not.toContain(invented);
    }
  });

  it("never guesses an age or sex the record does not hold", () => {
    const text = pageText();
    // Every seeded movement now names a real record (Josh, 25 September 2026: demo data only as
    // linked patients), so the "not recorded" wording is checked on a movement linked to nobody in
    // ward-unlinked-movement-says-not-recorded.dom.test.tsx. Here, the old invented ages stay gone.
    expect(text).not.toMatch(/\b38y\b|\b34y\b/);
  });

  it("labels a form the record holds by its own code, never as voluntary", () => {
    const text = pageText();
    // WF-009 is recorded on a Form 3B; that badge used to read "VOLUNTARY".
    expect(text).toContain("FORM 3B");
  });
});
