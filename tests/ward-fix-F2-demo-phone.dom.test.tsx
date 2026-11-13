import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DemoPhoneNumber } from "@/components/ward-management/demo-phone-number";

// A15-14 (Josh, 13 Nov 2026): demo numbers are copy only. Synthetic number from the fiction range.
const writeText = vi.fn<(text: string) => Promise<void>>();

beforeEach(() => {
  writeText.mockReset();
  writeText.mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
});

describe("the shared demo phone control", () => {
  it("shows the number, copies it on a tap, says so, and never makes a dial link", async () => {
    const { container } = render(<DemoPhoneNumber number="08 5550 2001" who="the referrer" />);
    const button = screen.getByRole("button", { name: "Copy the referrer's number, 08 5550 2001" });
    expect(button).toHaveTextContent("08 5550 2001");
    expect(container.querySelector("a[href^='tel:']")).toBeNull();
    fireEvent.click(button);
    await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
    expect(writeText.mock.calls[0]![0]).toContain("08 5550 2001");
    expect(await screen.findByRole("status")).toHaveTextContent("Number copied. Demo numbers do not dial.");
  });

  it("keeps visible words in the button's name when it shows words instead of the number", () => {
    render(<DemoPhoneNumber number="08 5550 0603" label="Copy referrer's number" />);
    expect(screen.getByRole("button", { name: "Copy referrer's number, 08 5550 0603" })).toHaveTextContent(
      "Copy referrer's number",
    );
  });

  it("says when the copy did not happen", async () => {
    writeText.mockRejectedValue(new Error("blocked"));
    Object.defineProperty(document, "execCommand", { value: () => false, configurable: true });
    render(<DemoPhoneNumber number="08 5550 0101" />);
    fireEvent.click(screen.getByRole("button", { name: "Copy the number, 08 5550 0101" }));
    expect(await screen.findByText("Not copied. Select the number instead.")).toBeInTheDocument();
  });
});
