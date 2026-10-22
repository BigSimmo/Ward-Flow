import { act, fireEvent, render, screen } from "@testing-library/react";
import dynamic from "next/dynamic";
import { describe, expect, it, vi } from "vitest";

import { withLoadRetry } from "@/components/ward-management/load-retry";

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

  it("fetches again when the browser comes back online", async () => {
    const load = vi
      .fn<() => Promise<typeof Panel>>()
      .mockRejectedValueOnce(new Error("ChunkLoadError"))
      .mockResolvedValue(Panel);
    const Lazy = dynamic(withLoadRetry(load, "Catchment lookup did not load"), { ssr: false });

    render(<Lazy label="Catchment" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Catchment lookup did not load");
    await act(async () => window.dispatchEvent(new Event("online")));
    expect(await screen.findByText("Catchment loaded")).toBeInTheDocument();
  });
});
