import { act, fireEvent, render, screen } from "@testing-library/react";
import dynamic from "next/dynamic";
import { describe, expect, it, vi } from "vitest";

import { withLoadRetry } from "@/components/ward-management/load-retry";

// Exercise Next's real loadable lifetime rather than the suite's eager dynamic stand-in.
vi.unmock("next/dynamic");

function Panel({ label }: { label: string }) {
  return <p>{label} loaded</p>;
}

// Offline Tools crash (22 Oct 2026): a panel whose code could not be fetched threw to the route
// error boundary. With `withLoadRetry` it shows an error line with Try again instead.
describe("withLoadRetry", () => {
  it("shows Try again when the code does not load, then the panel once a retry fetches it", async () => {
    const load = vi
      .fn<() => Promise<typeof Panel>>()
      .mockRejectedValueOnce(new Error("ChunkLoadError"))
      .mockRejectedValueOnce(new Error("ChunkLoadError"))
      .mockResolvedValue(Panel);
    const Lazy = dynamic(withLoadRetry(load, "Tools did not load"), { loading: () => null });

    const { unmount } = render(<Lazy label="Tools" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Tools did not load");
    expect(screen.getByRole("alert")).toHaveTextContent("Check the connection, then try again.");

    // Still offline: the line stays and nothing throws.
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Try again" })));
    expect(screen.getByRole("alert")).toHaveTextContent("Tools did not load");

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Try again" })));
    expect(await screen.findByText("Tools loaded")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();

    // A later open draws the panel straight away, without another fetch.
    unmount();
    render(<Lazy label="Tools" />);
    expect(await screen.findByText("Tools loaded")).toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(3);
  });

  it("adds Close when the panel takes onClose, for drawers that draw their own header", async () => {
    const onClose = vi.fn();
    const Lazy = dynamic(
      withLoadRetry<{ onClose: () => void }>(
        () => Promise.reject(new Error("ChunkLoadError")),
        "Referrals did not load",
      ),
    );
    render(<Lazy onClose={onClose} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Referrals did not load");
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("updates a reopened fallback when an earlier open's retry succeeds, using the current props", async () => {
    let complete!: (panel: typeof Panel) => void;
    const pending = new Promise<typeof Panel>((resolve) => {
      complete = resolve;
    });
    const load = vi
      .fn<() => Promise<typeof Panel>>()
      .mockRejectedValueOnce(new Error("ChunkLoadError"))
      .mockReturnValue(pending);
    const Lazy = dynamic(withLoadRetry(load, "Tasks did not load"), { loading: () => null });

    const first = render(<Lazy label="Original" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Tasks did not load");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    first.unmount();
    const reopened = render(<Lazy label="Reopened" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Tasks did not load");
    // Repeated taps observe the existing load rather than starting competing requests.
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    reopened.rerender(<Lazy label="Current" />);
    await act(async () => complete(Panel));
    expect(await screen.findByText("Current loaded")).toBeInTheDocument();
    expect(screen.queryByText("Original loaded")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(load).toHaveBeenCalledTimes(2);
  });
});
