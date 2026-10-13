/** @vitest-environment jsdom */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const writeText = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/copy-to-clipboard", () => ({
  copyTextToClipboard: (value: string) => writeText(value),
}));

import { RouteErrorBoundary } from "@/components/route-error-boundary";

describe("RouteErrorBoundary Copy Diagnostics privacy", () => {
  afterEach(() => {
    writeText.mockClear();
    vi.restoreAllMocks();
  });

  it("redacts clinical query text from the clipboard payload", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(window, "location", "get").mockReturnValue({
      href: "https://psychiatry.tools/dsm?q=clozapine%20ANC%20threshold",
    } as Location);

    const user = userEvent.setup();
    render(<RouteErrorBoundary error={new Error("boom at /users/patient/source.pdf")} reset={() => undefined} />);

    await user.click(screen.getByRole("button", { name: /Copy Diagnostics/i }));

    await waitFor(() => expect(writeText).toHaveBeenCalled());
    const copied = String(writeText.mock.calls[0]?.[0] ?? "");
    expect(copied).not.toContain("clozapine");
    expect(copied).not.toContain("/users/patient/source.pdf");
    expect(copied).toContain("[url]");
    expect(copied).toContain("[path]");
  });

  it("A4-10: redacts hospital record numbers (UMRN), Medicare numbers, and phone numbers from diagnostic clipboard payload", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(window, "location", "get").mockReturnValue({
      href: "https://prototype.health.wa.gov.au/patient?id=WF-001",
    } as Location);

    const user = userEvent.setup();
    render(
      <RouteErrorBoundary
        error={new Error("Error for patient UMRN: 1234567, Medicare 2123 45678 1, contact 0412 345 678")}
        reset={() => undefined}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Copy Diagnostics/i }));

    await waitFor(() => expect(writeText).toHaveBeenCalled());
    const copied = String(writeText.mock.calls[0]?.[0] ?? "");
    expect(copied).not.toContain("1234567");
    expect(copied).not.toContain("2123 45678 1");
    expect(copied).not.toContain("0412 345 678");
    expect(copied).toContain("[record-id]");
    expect(copied).toContain("[medicare]");
    expect(copied).toContain("[phone]");
  });
});
