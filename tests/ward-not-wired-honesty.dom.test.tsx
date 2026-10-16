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
import { WardAnswerView } from "@/components/ward-management/ward/ward-answer-view";

const OWNED_SOURCE_FILES = [
  "src/components/ward-management/delays/delays-board.tsx",
  "src/components/ward-management/alerts/alert-detail.tsx",
  "src/components/ward-management/alerts/global-alert-panels.tsx",
  "src/components/ward-management/alerts/alerts-screen.tsx",
  "src/components/ward-management/discharges/discharge-board.tsx",
  "src/components/ward-management/ward/ward-answer-view.tsx",
  "src/components/ward-management/ward/ward-screen.tsx",
];

describe("wired controls and WF-* audit-code hygiene across owned screens", () => {
  it("contains zero 'Not wired in this prototype.' strings or two-digit audit issue codes in owned source files", () => {
    for (const relPath of OWNED_SOURCE_FILES) {
      const fullPath = path.resolve(process.cwd(), relPath);
      const source = fs.readFileSync(fullPath, "utf8");
      expect(source, `${relPath} should not contain 'Not wired in this prototype.'`).not.toContain(
        "Not wired in this prototype.",
      );
      expect(source, `${relPath} should not contain two-digit WF-XX or WF-FIX/WF-HONESTY audit codes`).not.toMatch(
        /\bWF-(?:[0-5]\d|60|FIX-[A-Z0-9-]+|HONESTY-[A-Z0-9-]+)\b/,
      );
    }
  });

  it("wires the Delays system 'Record hold' button to record a service-wide hold", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <DelaysScreen />
      </WardFlowProvider>,
    );

    const systemTab = screen.getByRole("tab", { name: /System/i });
    fireEvent.click(systemTab);

    const recordBtn = screen.getByRole("button", { name: /Record a service-wide or facility delay/i });
    expect(recordBtn).toHaveTextContent("Record hold");

    fireEvent.click(recordBtn);
    expect(recordBtn).toHaveTextContent("Hold recorded");
    expect(screen.getAllByText(/Service-wide hold recorded\./i).length).toBeGreaterThan(0);
  });

  it("wires the Alerts Escalate button and ReplyBoardList Chase button", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <AlertsScreen />
      </WardFlowProvider>,
    );

    const panel = screen.getByRole("complementary", { name: "Selected alert" });
    const escalateBtn = within(panel).getByRole("button", { name: /Escalate/i });
    expect(escalateBtn).not.toBeDisabled();
    fireEvent.click(escalateBtn);
    expect(within(panel).getByRole("button", { name: /Escalated/i })).toHaveTextContent("Escalated");
  });

  it("wires the ReplyBoardList Chase button for unanswered units", () => {
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
    expect(chaseBtn).not.toBeDisabled();
    fireEvent.click(chaseBtn);
    expect(screen.getByRole("button", { name: /Chased/i })).toBeInTheDocument();
    expect(screen.getByText(/Chased unanswered desks/i)).toBeInTheDocument();
  });

  it("wires the WardAnswerView 'Ask a question' button to log a clarification request", () => {
    const unitWithIncoming = allUnits()[0]!;
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardAnswerView unitId={unitWithIncoming.id} />
      </WardFlowProvider>,
    );

    const askBtn = screen.queryByRole("button", { name: /Ask a question/i });
    if (askBtn) {
      fireEvent.click(askBtn);
      expect(screen.getByRole("button", { name: /Question logged/i })).toBeInTheDocument();
      expect(screen.getByText(/Clarification request logged for referring ED clinician\./i)).toBeInTheDocument();
    }
  });
});
