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

    const user = userEvent.setup();
    render(<RouteErrorBoundary error={new Error("boom at /users/patient/source.pdf")} retry={() => undefined} />);

    await user.click(screen.getByRole("button", { name: /Copy Diagnostics/i }));

    await waitFor(() => expect(writeText).toHaveBeenCalled());
    const copied = String(writeText.mock.calls[0]?.[0] ?? "");
    expect(copied).not.toContain("clozapine");
    expect(copied).not.toContain("/users/patient/source.pdf");
    expect(copied).toContain("[url]");
  });

  it("A4-10: redacts hospital record numbers (UMRN), Medicare numbers, and phone numbers from diagnostic clipboard payload", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const user = userEvent.setup();
    render(
      <RouteErrorBoundary
        error={new Error("Error for patient UMRN: 1234567, Medicare 2123 45678 1, contact 0412 345 678")}
        retry={() => undefined}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Copy Diagnostics/i }));

    await waitFor(() => expect(writeText).toHaveBeenCalled());
    const copied = String(writeText.mock.calls[0]?.[0] ?? "");
    expect(copied).not.toContain("1234567");
    expect(copied).not.toContain("2123 45678 1");
    expect(copied).not.toContain("0412 345 678");
  });

  it("owner ruling 13 Oct: copies IDs only, never the error message (no patient names)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const error = Object.assign(new Error("Failed for Jane Smith in bed 4"), { digest: "DIGEST-123" });

    const user = userEvent.setup();
    render(<RouteErrorBoundary error={error} retry={() => undefined} />);
    await user.click(screen.getByRole("button", { name: /Copy Diagnostics/i }));

    await waitFor(() => expect(writeText).toHaveBeenCalled());
    const payload = JSON.parse(String(writeText.mock.calls[0]?.[0] ?? "{}"));
    expect(JSON.stringify(payload)).not.toMatch(/Jane|Smith/);
    expect(payload.message).toBeUndefined();
    expect(payload.digest).toBe("DIGEST-123");
  });

  it("TE-12: logs only the error type and digest in production, never the message", () => {
    vi.stubEnv("NODE_ENV", "production");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const error = Object.assign(new Error("Synthetic Person Example has no bed"), { digest: "digest-1" });
      render(<RouteErrorBoundary error={error} retry={() => undefined} logLabel="Shared label:" />);
      const ours = consoleError.mock.calls.filter((call) => call[0] === "Shared label:");
      expect(ours).toHaveLength(1);
      expect(ours[0][1]).toEqual({ name: "Error", digest: "digest-1" });
      expect(JSON.stringify(consoleError.mock.calls)).not.toContain("Synthetic Person Example");
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
