import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WardGlobalSearch } from "@/components/ward-management/ward-global-search-lazy";
import { installMatchMediaStub } from "./setup/jsdom.setup";

vi.unmock("next/dynamic");

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  usePathname: () => "/ward-flow",
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => {
  cleanup();
  vi.doUnmock("@/components/ward-management/ward-global-search-help");
});

describe("phone search code loading", () => {
  it("announces failure and offers retry without losing the query or focus hand-off", async () => {
    installMatchMediaStub(true);
    let rejectLoad!: (reason: Error) => void;
    const pending = new Promise<never>((_, reject) => {
      rejectLoad = reject;
    });
    const load = vi.fn(() => pending);
    vi.doMock("@/components/ward-management/ward-global-search-help", load);
    render(<WardGlobalSearch movements={[]} patients={[]} units={[]} />);
    const field = screen.getByTestId("ward-global-search-input");
    expect(screen.getByRole("status")).toHaveTextContent("Loading search…");
    expect(field).toHaveAccessibleDescription("Loading search…");
    fireEvent.change(field, { target: { value: "Synthetic query" } });
    await waitFor(() => expect(load).toHaveBeenCalledOnce());
    await act(async () => rejectLoad(new Error("ChunkLoadError")));
    expect(screen.getByRole("status")).toHaveTextContent("Search did not load. Check the connection.");
    expect(field).toHaveValue("Synthetic query");

    vi.doMock("@/components/ward-management/ward-global-search-help", async () =>
      vi.importActual("@/components/ward-management/ward-global-search-help"),
    );
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() =>
      expect(screen.getByTestId("ward-global-search-input")).toHaveAttribute("aria-haspopup", "listbox"),
    );
    expect(screen.getByTestId("ward-global-search-input")).toHaveValue("Synthetic query");
    expect(screen.getByTestId("ward-global-search-input")).toHaveFocus();
    expect(screen.queryByText("Loading search…")).toBeNull();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });
});
