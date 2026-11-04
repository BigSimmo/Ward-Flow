import "@testing-library/jest-dom/vitest";
import { cleanup, configure, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReferralPage } from "@/components/ward-management/community/team-2026/team-referrals";

configure({
  getElementError: () => new Error("Midland document query failed; record-bearing diagnostics suppressed."),
});
afterEach(cleanup);

describe("Midland sample document download", () => {
  it("explains the unavailable action to pointer, keyboard and assistive technology users", () => {
    render(<ReferralPage index={0} go={vi.fn()} back={vi.fn()} />);
    fireEvent.click(screen.getAllByRole("button", { name: /^View/u })[0]!);
    const dialog = screen.getByRole("dialog");
    const download = within(dialog).getByRole("button", { name: "Download" });
    expect(download).toHaveAttribute("aria-disabled", "true");
    expect(download).toHaveAccessibleDescription("Not wired in this prototype.");
    download.focus();
    expect(download).toHaveFocus();
    fireEvent.click(download);
    fireEvent.keyDown(download, { key: "Enter" });
    fireEvent.keyUp(download, { key: "Enter" });
    fireEvent.keyDown(download, { key: " " });
    fireEvent.keyUp(download, { key: " " });
    expect(dialog).toBeInTheDocument();
    expect(document.querySelector("a[download]")).toBeNull();
  });
});
