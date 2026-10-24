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

describe.each(["bed-summary", "contacts"])("repeat copy feedback (%s)", (tool) => {
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
    const copy = within(panel).getAllByRole("button", { name: /^Copy / })[0]!;
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
