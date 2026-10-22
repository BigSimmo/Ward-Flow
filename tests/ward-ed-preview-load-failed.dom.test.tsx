import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

describe("All EDs — the lazily loaded preview fails to load", () => {
  it("says so with a Try again control, and Try again loads the preview", async () => {
    // The preview body loads lazily (phone script budget). The shared test setup may already have
    // loaded the real module, so start from fresh modules. The idle preload is switched off so the
    // first fetch is the one the preview makes when an ED is chosen.
    vi.resetModules();
    let offline = true;
    vi.doMock("@/components/ward-management/preload-when-idle", () => ({ preloadWhenIdle: () => {} }));
    vi.doMock("@/components/ward-management/ed/ed-preview", async (importOriginal) => {
      if (offline) throw new Error("offline");
      return importOriginal();
    });
    const { EdIndex } = await import("@/components/ward-management/ed/ed-index");
    const { WardFlowProvider } = await import("@/components/ward-management/ward-flow-provider");
    const { NOW_ANCHOR } = await import("@/components/ward-management/ward-sites");
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <EdIndex />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByTestId("ed-index-preview-arm-ed"));
    const notice = await screen.findByTestId("ward-ed-preview-load-failed");
    expect(notice).toHaveTextContent("The ED details did not load.");
    expect(screen.queryByTestId("ed-index-preview-body")).not.toBeInTheDocument();

    offline = false;
    fireEvent.click(within(notice).getByRole("button", { name: "Try again" }));
    expect(await screen.findByTestId("ed-index-preview-body")).toBeInTheDocument();
    expect(screen.queryByTestId("ward-ed-preview-load-failed")).not.toBeInTheDocument();
    // The footer shares the one load, so it draws too.
    expect(screen.getByTestId("ed-index-preview-enter")).toBeInTheDocument();
  });
});
