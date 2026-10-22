import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EdIndex } from "@/components/ward-management/ed/ed-index";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/ward-flow/ed",
  useSearchParams: () => new URLSearchParams(),
}));

describe("All EDs — desktop wait lanes", () => {
  it("shows the picked person's strip with links to the patient and the ED", async () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <EdIndex />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByRole("radio", { name: /Lanes/u }));
    const mark = screen.getAllByRole("button", { pressed: false }).find((button) => button.className.includes("mark"));
    expect(mark).toBeDefined();
    fireEvent.click(mark!);
    // The strip's body loads lazily with the ED preview (phone script budget).
    expect(await screen.findByRole("link", { name: "Open patient" })).toHaveAttribute("href");
    expect(screen.getByRole("link", { name: /^Open (?!patient).+/u })).toHaveAttribute(
      "href",
      expect.stringMatching(/^\/ward-flow\/ed\//u),
    );
  });
});
