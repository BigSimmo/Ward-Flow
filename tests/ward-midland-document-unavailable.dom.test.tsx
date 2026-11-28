import "@testing-library/jest-dom/vitest";
import { cleanup, configure, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReferralPage } from "@/components/ward-management/community/team-2026/team-referrals";

configure({
  getElementError: () => new Error("Midland document query failed; record-bearing diagnostics suppressed."),
});
afterEach(cleanup);

describe("Midland sample document download", () => {
  it("offers no download, and marks the document as a sample", () => {
    render(<ReferralPage index={0} go={vi.fn()} back={vi.fn()} />);
    fireEvent.click(screen.getAllByRole("button", { name: /^View/u })[0]!);
    const dialog = screen.getByRole("dialog");
    // r10 dropped the dead Download button (it only ever said "Not wired in this prototype"), so the
    // sample document offers no download at all: no button, no link, and it says it is a sample.
    expect(within(dialog).queryByRole("button", { name: "Download" })).toBeNull();
    expect(within(dialog).getByText("SAMPLE · NOT A REAL RECORD")).toBeInTheDocument();
    expect(document.querySelector("a[download]")).toBeNull();
  });
});
