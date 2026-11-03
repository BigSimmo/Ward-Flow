/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { WardToolsSheet } from "@/components/ward-management/tools/ward-tools-sheet";
import { copyTextToClipboard } from "@/components/ward-management/ward-clipboard";

vi.mock("@/components/ward-management/ward-clipboard", () => ({ copyTextToClipboard: vi.fn() }));
beforeEach(() => {
  vi.mocked(copyTextToClipboard).mockReset();
});

// Tools overhaul (2 Nov 2026): Copy bed summary became Messages, with one Copy button; On-call's
// Call button copies the number (calling is not wired), so both still renew their status.
const COPY_BUTTON = {
  messages: (panel: HTMLElement) => within(panel).getByRole("button", { name: "Copy" }),
  contacts: (panel: HTMLElement) => within(panel).getAllByRole("button", { name: /^Call / })[0]!,
} as const;

describe.each(["messages", "contacts"] as const)("repeat copy feedback (%s)", (tool) => {
  it.each([true, false])("renews the status content for repeated outcomes (success: %s)", async (success) => {
    if (success) vi.mocked(copyTextToClipboard).mockResolvedValue(undefined);
    else vi.mocked(copyTextToClipboard).mockRejectedValue(new Error("Clipboard unavailable"));
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardToolsSheet
          isPhone={false}
          roleLabel="Demonstration coordinator"
          onNavigate={() => {}}
          onNewReferral={() => {}}
        />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByTestId(`ward-tools-toggle-${tool}`));
    const panel = screen.getByTestId(`ward-tools-${tool}`);
    const copy = COPY_BUTTON[tool](panel);
    const status = within(panel).getByRole("status");
    fireEvent.click(copy);
    await waitFor(() => expect(status.textContent?.length).toBeGreaterThan(0));
    const firstContent = status.firstChild;
    const firstText = status.textContent;
    fireEvent.click(copy);
    await waitFor(() => expect(status.firstChild).not.toBe(firstContent));
    expect(status.textContent).toBe(firstText);
    expect(copyTextToClipboard).toHaveBeenCalledTimes(2);
  });
});
