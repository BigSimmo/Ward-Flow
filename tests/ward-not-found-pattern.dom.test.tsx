// shell-11 and shell-12 (13 Oct 2026): one not-found pattern. A plain sentence that never echoes an
// internal WF- or PT- id, one link to the right list, and the patient search.
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/mockups/ward-flow/movements/nope",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { WardMovementNotFound } from "@/components/ward-management/ward-management-console";

describe("the one not-found pattern", () => {
  it.each([
    ["nope", "not-a-movement-id"],
    ["WF-999", "no-such-movement"],
  ] as const)("movement %s says no movement matches the link, with no WF- id", (requestedId, reason) => {
    render(<WardMovementNotFound requestedId={requestedId} reason={reason} />);
    const main = screen.getByRole("main");
    expect(main).toHaveTextContent("No movement matches this link");
    expect(main).not.toHaveTextContent("WF-");
    expect(screen.getByRole("link", { name: "All movements" })).toHaveAttribute("href", "/mockups/ward-flow/movements");
    expect(screen.getByRole("link", { name: "Search patients" })).toHaveAttribute("href", "/mockups/ward-flow/search");
  });

  it("sends a patient-record link on to the record without quoting its internal id", () => {
    render(<WardMovementNotFound requestedId="PT-004" reason="not-a-movement-id" />);
    const main = screen.getByRole("main");
    expect(main).not.toHaveTextContent("PT-004");
    expect(screen.getByRole("link", { name: "Open their patient record" })).toHaveAttribute(
      "href",
      "/mockups/ward-flow/people/PT-004",
    );
  });
});
