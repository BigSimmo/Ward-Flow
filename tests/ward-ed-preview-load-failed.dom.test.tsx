import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EdIndex } from "@/components/ward-management/ed/ed-index";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

// The preview body loads lazily (phone script budget). Here its fetch always fails.
vi.mock("@/components/ward-management/ed/ed-preview", () => {
  throw new Error("offline");
});

describe("All EDs — the lazily loaded preview fails to load", () => {
  it("says so with a Try again control instead of leaving the preview blank", async () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <EdIndex />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByTestId("ed-index-preview-arm-ed"));
    const notice = await screen.findByTestId("ward-ed-preview-load-failed");
    expect(notice).toHaveTextContent("The ED details did not load.");
    fireEvent.click(within(notice).getByRole("button", { name: "Try again" }));
    expect(await screen.findByTestId("ward-ed-preview-load-failed")).toBeInTheDocument();
    expect(screen.queryByTestId("ed-index-preview-body")).not.toBeInTheDocument();
  });
});
