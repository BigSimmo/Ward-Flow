// Tools keeps its accessible purpose and modal focus without repeating a subtitle
// above the named tool rows (owner copy cleanup, 28 October 2026).
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
}));

import { WardBar } from "@/components/ward-management/shell/ward-bar";
import { resetServiceScopeForTests } from "@/components/ward-management/shell/ward-service-store";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

afterEach(() => {
  window.history.replaceState(null, "", "/");
  resetServiceScopeForTests();
});

describe("the Tools button and dialog remain understandable", () => {
  it("the button describes what Tools holds and keeps its visible name", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardBar primaryAction={{ kind: "none" }} />
      </WardFlowProvider>,
    );
    const button = screen.getByTestId("ward-bar-tools-trigger");
    expect(button).toHaveAccessibleName("Tools");
    expect(button).toHaveAccessibleDescription(/Quick actions, look ups, print and share/);
  });

  it("keeps its name and modal focus without a redundant subtitle", async () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardBar primaryAction={{ kind: "none" }} />
      </WardFlowProvider>,
    );
    const trigger = screen.getByTestId("ward-bar-tools-trigger");
    fireEvent.click(trigger);
    const dialog = await screen.findByRole("dialog", { name: "Tools" });
    expect(dialog).toHaveAccessibleName("Tools");
    expect(dialog).not.toHaveAccessibleDescription();
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Tools" })).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});
