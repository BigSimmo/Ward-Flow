// Audit P123: the top bar's Tools button and its dialog say what Tools holds, not only
// "Tools" and "Whole network".
import { fireEvent, render, screen } from "@testing-library/react";
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

describe("the Tools button and dialog explain themselves (audit P123)", () => {
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

  it("the dialog says what the sheet covers, not only 'Whole network'", async () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardBar primaryAction={{ kind: "none" }} />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByTestId("ward-bar-tools-trigger"));
    const dialog = await screen.findByRole("dialog", { name: "Tools" });
    expect(dialog).toHaveAccessibleDescription(/Quick actions and look ups for the whole network/);
  });
});
