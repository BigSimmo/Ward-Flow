import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));

import { HandoverPage } from "@/components/ward-management/handover/handover-page";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

describe("Handover illustrative briefing disclosure", () => {
  it("keeps the example boundary visible and restores the reader's disclosure state after printing", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <HandoverPage />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByRole("tab", { name: /Coordinator Briefing/ }));

    const disclosure = screen.getByTestId("ward-handover-example-briefing") as HTMLDetailsElement;
    const notice = screen.getByText(/These examples do not follow the selected scope/);
    expect(notice).toBeVisible();
    expect(notice.closest("details")).toBeNull();
    expect(disclosure.open).toBe(false);
    expect(disclosure.querySelector("summary")).toHaveTextContent("Example ISBAR briefing");
    expect(disclosure).toHaveTextContent("Recommendation:");

    act(() => window.dispatchEvent(new Event("beforeprint")));
    expect(disclosure.open).toBe(true);
    act(() => window.dispatchEvent(new Event("afterprint")));
    expect(disclosure.open).toBe(false);

    disclosure.open = true;
    act(() => window.dispatchEvent(new Event("beforeprint")));
    act(() => window.dispatchEvent(new Event("afterprint")));
    expect(disclosure.open).toBe(true);
  });
});
