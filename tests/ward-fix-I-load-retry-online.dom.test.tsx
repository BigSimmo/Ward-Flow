import { act, fireEvent, render, screen } from "@testing-library/react";
import dynamic from "next/dynamic";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CONNECTION_LINE, RELOAD_LINE, withLoadRetry } from "@/components/ward-management/load-retry";

function Panel({ label }: { label: string }) {
  return <p>{label} loaded</p>;
}

/*
 * Audit 4 A4-07 (13 Nov 2026): "This part did not load" stayed after the connection came back, and
 * still blamed the connection when a release had removed the old file. The stand-in now tries again
 * by itself when the browser comes back online, and after a second failure while online says to
 * reload the page.
 */
describe("withLoadRetry after the connection returns (A4-07)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads the part by itself when the browser comes back online", async () => {
    const load = vi
      .fn<() => Promise<typeof Panel>>()
      .mockRejectedValueOnce(new Error("ChunkLoadError"))
      .mockResolvedValue(Panel);
    const Lazy = dynamic(withLoadRetry(load, "Tools did not load"), { loading: () => null });
    render(<Lazy label="Tools" />);
    expect(await screen.findByRole("alert")).toHaveTextContent(CONNECTION_LINE);

    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });
    expect(await screen.findByText("Tools loaded")).toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("says to reload the page after a second failure while online", async () => {
    const load = vi.fn<() => Promise<typeof Panel>>().mockRejectedValue(new Error("ChunkLoadError"));
    const Lazy = dynamic(withLoadRetry(load, "Tools did not load"), { loading: () => null });
    render(<Lazy label="Tools" />);
    expect(await screen.findByRole("alert")).toHaveTextContent(CONNECTION_LINE);

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Try again" })));
    expect(screen.getByRole("alert")).toHaveTextContent(RELOAD_LINE);
    expect(screen.getByRole("alert")).not.toHaveTextContent(CONNECTION_LINE);
  });

  it("keeps pointing at the connection while the browser is still offline", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    const load = vi.fn<() => Promise<typeof Panel>>().mockRejectedValue(new Error("ChunkLoadError"));
    const Lazy = dynamic(withLoadRetry(load, "Tools did not load"), { loading: () => null });
    render(<Lazy label="Tools" />);
    await screen.findByRole("alert");
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Try again" })));
    expect(screen.getByRole("alert")).toHaveTextContent(CONNECTION_LINE);
  });

  it("shares one fetch between two open stand-ins", async () => {
    let resolve: (panel: typeof Panel) => void = () => {};
    const load = vi
      .fn<() => Promise<typeof Panel>>()
      .mockRejectedValueOnce(new Error("ChunkLoadError"))
      .mockImplementationOnce(
        () =>
          new Promise((done) => {
            resolve = done;
          }),
      );
    const Lazy = dynamic(withLoadRetry(load, "Tools did not load"));
    render(
      <>
        <Lazy label="First" />
        <Lazy label="Second" />
      </>,
    );
    expect(await screen.findAllByRole("alert")).toHaveLength(2);
    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });
    await act(async () => resolve(Panel));
    expect(await screen.findByText("First loaded")).toBeInTheDocument();
    expect(screen.getByText("Second loaded")).toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(2);
  });
});
