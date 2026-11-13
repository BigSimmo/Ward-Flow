import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { WardToolsSheet } from "@/components/ward-management/tools/ward-tools-sheet";
import { subscribeWardHelp, type HelpRequest } from "@/components/ward-management/help/ward-help-events";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/patients",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

function renderSheet(isPhone: boolean) {
  const onNavigate = vi.fn();
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardToolsSheet isPhone={isPhone} roleLabel="Bed coordinator" onNavigate={onNavigate} onNewReferral={vi.fn()} />
    </WardFlowProvider>,
  );
  return { onNavigate };
}

let stop: (() => void) | undefined;
afterEach(() => {
  stop?.();
  stop = undefined;
});

/**
 * Shared design parts items 8 and 11 (13 Nov 2026): phone Tools carries a Help row, so a page with
 * Back still reaches Help, and the coordinator's due list is headed "Needs you", never "Suggested".
 */
describe("Tools sheet Help row and Needs you", () => {
  it("opens the header Menu's Help from a phone Tools row, closing Tools first", () => {
    const requests: HelpRequest[] = [];
    stop = subscribeWardHelp((request) => requests.push(request));
    const { onNavigate } = renderSheet(true);
    fireEvent.click(screen.getByTestId("ward-tools-help"));
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(requests).toEqual([{ kind: "view", view: "tasks", task: undefined }]);
    expect(screen.getByTestId("ward-tools-help")).toHaveTextContent("How this screen works");
  });

  it("leaves Help to the desktop header", () => {
    renderSheet(false);
    expect(screen.queryByTestId("ward-tools-help")).toBeNull();
  });

  it("never says Suggested", () => {
    renderSheet(false);
    expect(screen.queryByText(/Suggested/u)).toBeNull();
    expect(screen.queryByRole("region", { name: "Suggested now" })).toBeNull();
    expect(screen.getByRole("region", { name: "Needs you" })).toHaveTextContent(/^Needs you/u);
  });
});
