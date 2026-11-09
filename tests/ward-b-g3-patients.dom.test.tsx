import { render, screen } from "@testing-library/react";
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

// Category B, group G3 (audit 27 Oct 2026): P140 Add patient placement.

describe("B-G3 patients", () => {
  // Page tops (Josh, 9 Nov 2026): Add patient sits at the end of the search row, a row below the Demo pill.
  it("P140: Add patient is not beside the live/Demo chip", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <PatientSearchPage />
      </WardFlowProvider>,
    );
    const add = screen.getByTestId("ward-patient-search-add");
    const live = document.querySelector("[data-wf-live]");
    expect(live).not.toBeNull();
    expect(add.parentElement?.contains(live)).toBe(false);
    expect(add.parentElement?.querySelector('form[role="search"]')).not.toBeNull();
  });
});
