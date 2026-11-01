import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

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

// The Patients census search is the kit's one page search field (D-91, Patients redesign).
const SEARCH_LABEL = "Find a person by name, UMRN or place";

afterEach(() => cleanup());

/**
 * Josh, 1 Nov 2026 (Q92, same ruling as Search on 31 Oct): the Patients empty state no longer offers
 * "Did you mean?" names. A typo match on a person risks choosing the wrong patient.
 */
describe("Patients empty state offers no near spellings", () => {
  it("lists no one-keystroke-away name, and still offers Clear search and Add patient", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <PatientSearchPage />
      </WardFlowProvider>,
    );
    const box = screen.getByLabelText(SEARCH_LABEL);
    fireEvent.change(box, { target: { value: "Hallowey" } });
    expect(screen.getByText("No patient matches “Hallowey”")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Did you mean?" })).toBeNull();
    expect(screen.queryByRole("link", { name: /Talia Halloway/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Clear search" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Add patient/ }).length).toBeGreaterThan(0);
  });
});
