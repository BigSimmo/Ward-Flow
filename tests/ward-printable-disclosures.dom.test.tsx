/** @vitest-environment jsdom */

import { act, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { usePrintableDisclosures } from "@/components/ward-management/use-printable-disclosures";

function PrintableDisclosures() {
  usePrintableDisclosures();
  return (
    <>
      <details className="source-print" name="ward-source" open data-testid="originally-open">
        <summary>Originally open</summary>
        Open content
      </details>
      <details className="source-print" name="ward-source" data-testid="originally-closed">
        <summary>Originally closed</summary>
        Closed content
      </details>
      <details name="document-viewer-section" data-testid="outside-ward-scope">
        <summary>Other feature</summary>
        Other content
      </details>
    </>
  );
}

describe("Ward printable disclosures", () => {
  it("opens only source-print details and restores each open and name state after printing", () => {
    const { getByTestId } = render(<PrintableDisclosures />);
    const originallyOpen = getByTestId("originally-open") as HTMLDetailsElement;
    const originallyClosed = getByTestId("originally-closed") as HTMLDetailsElement;
    const outsideWardScope = getByTestId("outside-ward-scope") as HTMLDetailsElement;

    act(() => window.dispatchEvent(new Event("beforeprint")));

    expect(originallyOpen.open).toBe(true);
    expect(originallyClosed.open).toBe(true);
    expect(originallyOpen).not.toHaveAttribute("name");
    expect(originallyClosed).not.toHaveAttribute("name");
    expect(outsideWardScope.open).toBe(false);
    expect(outsideWardScope).toHaveAttribute("name", "document-viewer-section");

    act(() => window.dispatchEvent(new Event("afterprint")));

    expect(originallyOpen.open).toBe(true);
    expect(originallyClosed.open).toBe(false);
    expect(originallyOpen).toHaveAttribute("name", "ward-source");
    expect(originallyClosed).toHaveAttribute("name", "ward-source");
  });
});
