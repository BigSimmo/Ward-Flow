import fs from "node:fs";
import path from "node:path";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/mockups/ward-flow",
  useSearchParams: () => new URLSearchParams(),
}));

import { AlertsScreen } from "@/components/ward-management/alerts/alerts-screen";
import { ReplyBoardList } from "@/components/ward-management/alerts/global-alert-panels";
import type { BroadcastAlert } from "@/components/ward-management/alerts/ward-broadcast-model";
import { DelaysScreen } from "@/components/ward-management/delays/delays-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const OWNED_SOURCE_FILES = [
  "src/components/ward-management/delays/delays-board.tsx",
  "src/components/ward-management/alerts/alert-detail.tsx",
  "src/components/ward-management/alerts/global-alert-panels.tsx",
  "src/components/ward-management/alerts/alerts-screen.tsx",
  "src/components/ward-management/discharges/discharge-board.tsx",
  "src/components/ward-management/ward/ward-answer-view.tsx",
  "src/components/ward-management/ward/ward-screen.tsx",
];

describe("wired controls and audit-code hygiene across owned screens", () => {
  it("contains zero two-digit audit issue codes in owned source files", () => {
    for (const relPath of OWNED_SOURCE_FILES) {
      const fullPath = path.resolve(process.cwd(), relPath);
      const source = fs.readFileSync(fullPath, "utf8");
      expect(source, `${relPath} should not contain two-digit audit codes`).not.toMatch(
        /\bWF-(?:[0-5]\d|60|FIX-[A-Z0-9-]+|HONESTY-[A-Z0-9-]+)\b/,
      );
    }
  });

  it("keeps the Delays system 'Record hold' control honest: it says it is not wired and records nothing", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <DelaysScreen />
      </WardFlowProvider>,
    );

    const systemTab = screen.getByRole("tab", { name: /System/i });
    fireEvent.click(systemTab);

    const recordBtn = screen.getByRole("button", { name: /Record a service-wide or facility delay/i });
    expect(recordBtn).toHaveAccessibleName(/Not wired in this prototype\./);

    fireEvent.click(recordBtn);
    expect(screen.queryByText(/Service-wide hold recorded/i)).not.toBeInTheDocument();
  });

  it("wires the Alerts Escalate button", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <AlertsScreen />
      </WardFlowProvider>,
    );

    fireEvent.click(screen.getAllByRole("button", { name: /^Open No eligible bed/ })[0]!);
    const panel = screen.getByRole("complementary", { name: "Selected alert" });
    const escalateBtn = within(panel).getByRole("button", { name: /Escalate/i });
    expect(escalateBtn).not.toBeDisabled();
    fireEvent.click(escalateBtn);
    expect(within(panel).getByRole("button", { name: /Escalated/i })).toHaveTextContent("Escalated");
  });

  it("keeps the ReplyBoardList Chase button unavailable until a follow-up action exists", () => {
    const units = allUnits().slice(0, 3);
    const alert: BroadcastAlert = {
      id: "BC-TEST-1",
      kind: "bed_call",
      title: "Bed call test",
      message: "Need one acute bed",
      severity: "warning",
      category: "capacity_gridlock",
      targetScope: "all",
      targetScopeLabel: "All units",
      dispatchedAt: NOW_ANCHOR - 10,
      expiresAt: NOW_ANCHOR + 50,
      durationMinutes: 60,
      status: "active",
      dispatchedByRole: "coordinator",
      dispatchedByName: "State Flow Coordinator",
      acknowledgedUnits: [],
      replies: [{ unitId: units[0]!.id, answer: "can_take", at: NOW_ANCHOR - 5, role: "ward" }],
    };

    render(<ReplyBoardList alert={alert} units={units} now={NOW_ANCHOR} />);
    const chaseBtn = screen.getByRole("button", { name: /Chase/i });
    expect(chaseBtn).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(chaseBtn);
    expect(screen.queryByText(/Chased unanswered desks/i)).not.toBeInTheDocument();
  });
});
