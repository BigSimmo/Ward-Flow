// Repo score follow-up (16 Oct 2026): phones load the header search after the page. These pin the
// hand-over from the plain field the server draws to the real search, and that desktop is unchanged.
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WardGlobalSearch } from "@/components/ward-management/ward-global-search-lazy";
import { installMatchMediaStub } from "./setup/jsdom.setup";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  usePathname: () => "/mockups/ward-flow",
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(cleanup);

function renderSearch() {
  return render(<WardGlobalSearch movements={[]} patients={[]} units={[]} placeholder="Search" />);
}

const input = () => screen.getByTestId("ward-global-search-input");

describe("header search on a phone", () => {
  it("draws the plain field first, then the real search in its place", async () => {
    installMatchMediaStub(true);
    renderSearch();
    expect(input()).not.toHaveAttribute("aria-haspopup");
    expect(input()).toHaveAttribute("placeholder", "Search");
    await waitFor(() => expect(input()).toHaveAttribute("aria-haspopup", "listbox"));
    expect(screen.getAllByTestId("ward-global-search")).toHaveLength(1);
  });

  it("keeps the typed text and the focus when the real search arrives", async () => {
    installMatchMediaStub(true);
    renderSearch();
    const field = input() as HTMLInputElement;
    act(() => {
      field.focus();
      field.value = "Hal";
    });
    await waitFor(() => expect(input()).toHaveAttribute("aria-haspopup", "listbox"));
    expect(input()).not.toBe(field);
    expect(input()).toHaveValue("Hal");
    expect(input()).toHaveFocus();
  });
});

describe("header search on desktop", () => {
  it("is the real search from the first render", () => {
    installMatchMediaStub(false);
    renderSearch();
    expect(input()).toHaveAttribute("aria-haspopup", "listbox");
  });
});
