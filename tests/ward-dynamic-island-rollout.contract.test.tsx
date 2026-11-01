/**
 * Live screen guardrails kept from the Dynamic Island rollout suite.
 *
 * The Dynamic Island component itself was deleted on 1 Nov 2026 (owner approval Q96): its one route
 * use left the ED page on 11 Oct 2026. Its contract, boundary and stress cases went with it. What
 * stays here is the part that never rendered the island: the live screens it was meant to sit on
 * still mount, and keep the test ids, filters and summaries other screens and journeys rely on.
 * The file keeps its name because the test runner's population and lease-mode tests name it.
 *
 * Verifiable via:
 *   node scripts/run-vitest.mjs run tests/ward-dynamic-island-rollout.contract.test.tsx
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ReactNode } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Mock next/link to standard <a> anchors to allow testing in jsdom without Next.js App Router context
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR, allUnits } from "@/components/ward-management/ward-sites";
import { wardAdmissions } from "@/components/ward-management/ward-admissions-seed";
import { wardMovements } from "@/components/ward-management/ward-movements";
import { bedKindGaps } from "@/components/ward-management/capacity/capacity-derivations";
import { shortNeed } from "@/components/ward-management/capacity/capacity-mismatch-band";
import { DischargeBoard } from "@/components/ward-management/discharges/discharge-board";
import { CapacityScreen } from "@/components/ward-management/capacity/capacity-screen";
import { HandoverPage } from "@/components/ward-management/handover/handover-page";
import { LegalFormsScreen } from "@/components/ward-management/legal-forms/legal-forms-screen";

afterEach(() => {
  vi.restoreAllMocks();
});

// ============================================================================
// TRACK B: INTEGRATION READINESS & NON-DEGRADATION GUARDRAILS (10 TESTS)
// ============================================================================

describe("Track B: Integration Readiness & Non-Degradation Guardrails", () => {
  it("Integration Screen 1: Shift Handover component source preserves verbatim text strings", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/components/ward-management/handover/handover-page.tsx"),
      "utf8",
    );
    // Refined Handover A (9 Oct 2026): the hero counts are the meeting-order groups.
    expect(source).toContain("ward-handover-kpi-strip");
    expect(source).toContain("Act now");
    expect(source).toContain("Finding a ward");
    expect(source).toContain("Moving");
  });

  it("Integration Screen 2: DischargeBoard mounts with WardFlowProvider and renders KPI testIds", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <DischargeBoard />
      </WardFlowProvider>,
    );

    // Preserves required testIds for KPI strip and cards
    expect(screen.getByTestId("ward-discharge-kpi-blocked")).toBeDefined();
    expect(screen.getByTestId("ward-discharge-kpi-confirmed")).toBeDefined();
    expect(screen.getByTestId("ward-discharge-kpi-expected")).toBeDefined();
    expect(screen.getByTestId("ward-discharge-kpi-departed")).toBeDefined();
  });

  it("Integration Screen 3: Referral Board component preserves ward-referral-kpis container contract", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/components/ward-management/referrals/referral-board.tsx"),
      "utf8",
    );
    expect(source).toContain("ward-referral-kpis");
  });

  it("Integration Screen 4: Settings component preserves operational settings contracts", () => {
    // Settings by login (31 Oct 2026): the rule editor lives in its own pane beside the screen.
    const source = ["settings-screen.tsx", "settings-rules-pane.tsx"]
      .map((file) => readFileSync(resolve(process.cwd(), "src/components/ward-management/settings", file), "utf8"))
      .join("\n");
    expect(source).toContain(`raise("SET_CONFIGURATION"`);
    expect(source).toContain("edAccessTargetMinutes");
    expect(source).toContain("morningRollupDeadlineMinutes");
  });

  it("Integration Screen 5: Ward bed board preserves unit status telemetry", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/components/ward-management/ward/ward-answer-view.tsx"),
      "utf8",
    );
    expect(source).toContain("ward-unit-screen");
  });

  it("Integration Screen 6: CapacityScreen mounts with WardFlowProvider and preserves the Mismatch band", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <CapacityScreen />
      </WardFlowProvider>,
    );

    // CRITICAL: the mismatch by bed type must NEVER be removed or broken by HUD rollout. Since the
    // Capacity redesign (31 Oct 2026) it is the Mismatch band, one tile per bed type.
    const mismatch = within(screen.getByRole("region", { name: "Mismatch" }));
    const tiles = within(mismatch.getByRole("list", { name: "Bed types, now and tomorrow" })).getAllByRole("listitem");
    const gapRows = bedKindGaps(wardMovements, allUnits(), NOW_ANCHOR, wardAdmissions);
    expect(tiles.map((tile) => within(tile).getByRole("heading").textContent)).toEqual(
      gapRows.map((row) => shortNeed(row.need)),
    );
  });

  it("Integration Screen 7: Emergency Department component preserves ED access target contracts", () => {
    const source = readFileSync(resolve(process.cwd(), "src/components/ward-management/ed/ed-screen.tsx"), "utf8");
    expect(source).toContain("edAccessTargetMinutes");
  });

  it("Integration Screen 8: On-Call management preserves Tier 3 escalation action contract", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/components/ward-management/on-call/on-call-screen.tsx"),
      "utf8",
    );
    expect(source).toContain("Tier 3");
  });

  it("Integration Screen 9: Transport screen preserves transport dispatch contracts", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/components/ward-management/officer/officer-screen.tsx"),
      "utf8",
    );
    expect(source).toContain("ward-officer-screen");
  });

  it("Integration Screen 10: Legal Forms screen mounts with WardFlowProvider and preserves sr-only legal forms summary <dl>", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <LegalFormsScreen />
      </WardFlowProvider>,
    );

    // CRITICAL: Assistive tech summary dl must NEVER be removed
    const summaryDl = screen.getByLabelText("Legal forms summary");
    expect(summaryDl).toBeDefined();
    expect(summaryDl.tagName.toLowerCase()).toBe("dl");
  });
});

// ============================================================================
// LIVE TARGET SCREEN MOUNTS (moved from the deleted island stress suite)
// ============================================================================
describe("5. Live Target Screen Component Mounts", () => {
  it("Mounts HandoverPage with WardFlowProvider and renders live Handover HUD", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <HandoverPage />
      </WardFlowProvider>,
    );

    const hud = screen.getByTestId("ward-handover-kpi-strip");
    expect(hud).toBeDefined();
    expect(within(hud).getByRole("button", { name: /Act now/ })).toBeDefined();
    expect(within(hud).getByRole("button", { name: /Finding a ward/ })).toBeDefined();
  });

  it("Mounts DischargeBoard with WardFlowProvider and tests interactive filter clicking", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <DischargeBoard />
      </WardFlowProvider>,
    );

    const blockedFilterBtn = screen.getByTestId("ward-discharge-kpi-blocked");
    expect(blockedFilterBtn).toBeDefined();

    // Click the filter button in the real component tree
    fireEvent.click(blockedFilterBtn);
    expect(blockedFilterBtn.getAttribute("aria-pressed")).toBe("true");

    // Click again to toggle back to all
    fireEvent.click(blockedFilterBtn);
    expect(blockedFilterBtn.getAttribute("aria-pressed")).toBe("false");
  });

  it("Mounts LegalFormsScreen with WardFlowProvider and tests urgency filter clicking", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <LegalFormsScreen />
      </WardFlowProvider>,
    );

    // Forms hero (9 Oct 2026): the view switch (Clocks / Checklist / History) and the urgency
    // pills, which highlight rows and never hide them.
    const checklistBtn = screen.getByRole("radio", { name: /^Checklist/u });
    fireEvent.click(checklistBtn);
    expect(checklistBtn.getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("region", { name: "Checklist" })).toBeInTheDocument();

    // Every count names its noun (Josh, 30 Oct 2026): "forms to act on".
    const actNow = screen.getByRole("button", { name: /to act on/u });
    fireEvent.click(actNow);
    expect(actNow.getAttribute("aria-pressed")).toBe("true");
  });

  it("Mounts CapacityScreen with WardFlowProvider and verifies co-existence of HUD and Mismatch band", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <CapacityScreen />
      </WardFlowProvider>,
    );

    // Capacity redesign (31 Oct 2026): the hero's chip row is the HUD and the Mismatch band
    // replaces the gap table.
    const hud = screen.getByRole("group", { name: "Network beds" });
    const mismatch = screen.getByRole("region", { name: "Mismatch" });

    expect(hud).toBeDefined();
    expect(mismatch).toBeDefined();
    // v6: the hero carries the Live chip with its pause control, and the counts are hero stats.
    expect(screen.getByRole("button", { name: /pause demo updates$/ })).toBeDefined();
    expect(within(hud).getByRole("button", { name: /^\d+\s*locked (?:beds )?ready$/iu })).toBeDefined();
  });
});
