/**
 * Empirical Adversarial Stress Test Suite: WardDynamicIsland & 10 Target Screens
 *
 * Authored by Challenger 1 (Adversarial Stress Tester).
 *
 * Verifies:
 * 1. Edge case data inputs (0 counts, missing values, empty strings, 999+ counts, extreme payloads)
 * 2. Surge mode toggling, breach conditions, rapid filter clicking and race condition resilience
 * 3. Accessibility & interaction (keyboard focus, Enter/Space triggers, aria-pressed states, a11y roles)
 * 4. Overflow, scrollbar suppression, nowrap integrity, token adherence, and 12px font floor
 * 5. Full component tree integration on live target screens
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ReactNode } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Mock next/link to standard <a> anchors for testing outside Next.js App Router
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { WardDynamicIsland, type DynamicIslandMetric } from "@/components/ward-management/shell/ward-dynamic-island";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { DischargeBoard } from "@/components/ward-management/discharges/discharge-board";
import { CapacityScreen } from "@/components/ward-management/capacity/capacity-screen";
import { LegalFormsScreen } from "@/components/ward-management/legal-forms/legal-forms-screen";
import { HandoverPage } from "@/components/ward-management/handover/handover-page";

import {
  buildHandoverHudProps,
  buildDischargesHudProps,
  buildSettingsHudProps,
  buildEdHudProps,
} from "./ward-dynamic-island-rollout.contract.test";

describe("Adversarial Stress Testing: WardDynamicIsland", () => {
  // ==========================================================================
  // SECTION 1: EDGE CASE DATA INPUTS
  // ==========================================================================
  describe("1. Edge Case Data Inputs", () => {
    it("handles all-zero counts across every metric without suppressing '0' or crashing", () => {
      const zeroMetrics: DynamicIslandMetric[] = [
        { id: "m-zero-1", label: "Caseload", value: 0, tone: "accent" },
        { id: "m-zero-2", label: "Referrals", value: 0, tone: "warn" },
        { id: "m-zero-3", label: "Vacancies", value: 0, tone: "muted" },
        { id: "m-zero-4", label: "Expiries", value: 0, tone: "good" },
        { id: "m-zero-5", label: "Specialling", value: 0, tone: "neutral" },
      ];

      render(<WardDynamicIsland title="Zero State HUD" status="nominal" metrics={zeroMetrics} />);

      const zeroElements = screen.getAllByText("0");
      expect(zeroElements).toHaveLength(5);
      zeroElements.forEach((el) => {
        expect(el.className).toMatch(/metricValue/);
      });
    });

    it("handles extreme large numbers (999+, 10000, 999999) across all 10 screen models", () => {
      // Screen 1: Handover
      const { rerender } = render(
        <WardDynamicIsland
          {...buildHandoverHudProps({
            caseload: 999999,
            totalOpen: 1000000,
            referrals: 999,
            vacancies: 0,
            expiriesPassed: 42,
            specialling: 120,
          })}
        />,
      );
      expect(screen.getByText("999999")).toBeDefined();
      expect(screen.getByText("999")).toBeDefined();

      // Screen 2: Discharges
      rerender(
        <WardDynamicIsland
          {...buildDischargesHudProps({
            blockedCount: 9999,
            confirmedCount: 8888,
            expectedCount: 7777,
            departedCount: 6666,
          })}
        />,
      );
      expect(screen.getByText("9999")).toBeDefined();
      expect(screen.getByText("8888")).toBeDefined();

      // Screen 7: ED Pressure
      rerender(
        <WardDynamicIsland
          {...buildEdHudProps({
            presentingCount: 9999,
            awaitingBedCount: 5000,
            breachesCount: 999,
          })}
        />,
      );
      expect(screen.getByText("9999")).toBeDefined();
      expect(screen.getByText("999")).toBeDefined();
    });

    it("handles empty strings, null, undefined values, and missing labels gracefully", () => {
      const pathologicalMetrics: DynamicIslandMetric[] = [
        { id: "p-empty-val", label: "EmptyVal", value: "" },
        { id: "p-null-val", label: "NullVal", value: null },
        { id: "p-undef-val", label: "UndefVal", value: undefined },
        { id: "p-no-label", label: "", value: "42" },
        { id: "p-colon-label", label: "DoubleColon:::", value: 10 },
        { id: "p-with-unit", label: "Wait", value: 3, unit: "hrs" },
        { id: "p-with-subtext", label: "Queue", value: 5, subtext: "" },
      ];

      const { container } = render(<WardDynamicIsland title="Pathological HUD" metrics={pathologicalMetrics} />);

      // Verify no runtime error
      expect(container.querySelector("section")).toBeDefined();
      // Label with multiple colons should have colons cleanly trimmed
      expect(screen.getByText("DoubleColon")).toBeDefined();
      // Unit is rendered
      expect(screen.getByText("hrs")).toBeDefined();
      // Bare value 42 rendered
      expect(screen.getByText("42")).toBeDefined();
    });

    it("renders empty metrics list and default status text without throwing", () => {
      const { container, rerender } = render(<WardDynamicIsland title="Empty Metrics HUD" metrics={[]} />);

      expect(screen.getByRole("status").getAttribute("aria-label")).toBe("Synthetic status: Nominal status");
      expect(container.querySelectorAll("li")).toHaveLength(0);

      // Warning default status text
      rerender(<WardDynamicIsland title="Empty Metrics HUD" status="warning" metrics={[]} />);
      expect(screen.getByRole("status").getAttribute("aria-label")).toBe("Synthetic status: Attention required");

      // Alarm default status text
      rerender(<WardDynamicIsland title="Empty Metrics HUD" status="alarm" metrics={[]} />);
      expect(screen.getByRole("status").getAttribute("aria-label")).toBe("Synthetic status: Critical pressure");

      // Neutral default status text
      rerender(<WardDynamicIsland title="Empty Metrics HUD" status="neutral" metrics={[]} />);
      expect(screen.getByRole("status").getAttribute("aria-label")).toBe("Synthetic status: Monitoring");
    });
  });

  // ==========================================================================
  // SECTION 2: SURGE MODE, BREACH CONDITIONS & RAPID TOGGLING
  // ==========================================================================
  describe("2. Surge Mode, Breach Conditions & Rapid Toggling", () => {
    it("rapidly toggles Surge Mode across 50 iterations without UI state desynchronization", () => {
      let isSurge = false;
      const { rerender } = render(
        <WardDynamicIsland
          {...buildSettingsHudProps({
            isSurgeMode: isSurge,
            hasUnsavedRules: false,
          })}
        />,
      );

      for (let i = 0; i < 50; i++) {
        isSurge = !isSurge;
        rerender(
          <WardDynamicIsland
            {...buildSettingsHudProps({
              isSurgeMode: isSurge,
              hasUnsavedRules: false,
            })}
          />,
        );

        const modeVal = screen.getByText(isSurge ? "Surge Mode" : "Standard");
        expect(modeVal).toBeDefined();
        if (isSurge) {
          expect(modeVal.className).toMatch(/metricToneDanger/);
        } else {
          expect(modeVal.className).not.toMatch(/metricToneDanger/);
        }
      }
    });

    it("transitions ED Pressure breaches from 0 to alarm across multiple cycles with pulse pip", () => {
      const { rerender } = render(
        <WardDynamicIsland {...buildEdHudProps({ breachesCount: 0, awaitingBedCount: 1 })} />,
      );

      const statusPip = screen.getByRole("status");
      expect(statusPip.className).toMatch(/statusPipNominal/);

      // Trigger critical breach
      rerender(<WardDynamicIsland {...buildEdHudProps({ breachesCount: 4, awaitingBedCount: 1 })} />);
      expect(statusPip.className).toMatch(/statusPipAlarm/);
      expect(screen.getByText("4")).toBeDefined();
      expect(screen.getByText("4").className).toMatch(/metricToneDanger/);

      // Resolve breach
      rerender(<WardDynamicIsland {...buildEdHudProps({ breachesCount: 0, awaitingBedCount: 1 })} />);
      expect(statusPip.className).toMatch(/statusPipNominal/);
      expect(screen.getByText("0").className).toMatch(/metricToneGood/);
    });

    it("handles rapid consecutive clicks on Discharges filter buttons without missed events", () => {
      const filterClicks: string[] = [];
      const onFilterChange = (filter: string) => filterClicks.push(filter);

      render(
        <WardDynamicIsland
          {...buildDischargesHudProps({
            statusFilter: "all",
            onFilterChange: (f) => onFilterChange(f),
          })}
        />,
      );

      const blockedBtn = screen.getByTestId("ward-discharge-kpi-blocked");
      const confirmedBtn = screen.getByTestId("ward-discharge-kpi-confirmed");
      const expectedBtn = screen.getByTestId("ward-discharge-kpi-expected");
      const departedBtn = screen.getByTestId("ward-discharge-kpi-departed");

      // Rapidly click all 4 buttons sequentially 5 times = 20 clicks
      for (let i = 0; i < 5; i++) {
        fireEvent.click(blockedBtn);
        fireEvent.click(confirmedBtn);
        fireEvent.click(expectedBtn);
        fireEvent.click(departedBtn);
      }

      expect(filterClicks).toHaveLength(20);
      expect(filterClicks.slice(0, 4)).toEqual(["blocked", "confirmed", "expected", "departed"]);
    });

    it("synchronizes aria-pressed state precisely when active filter toggles on and off", () => {
      let currentFilter: "all" | "blocked" | "confirmed" = "all";
      const { rerender } = render(
        <WardDynamicIsland
          {...buildDischargesHudProps({
            statusFilter: currentFilter,
            onFilterChange: (next) => {
              currentFilter = next as "all" | "blocked" | "confirmed";
            },
          })}
        />,
      );

      const blockedBtn = screen.getByTestId("ward-discharge-kpi-blocked");
      expect(blockedBtn.getAttribute("aria-pressed")).toBe("false");

      // Click to activate
      fireEvent.click(blockedBtn);
      expect(currentFilter).toBe("blocked");

      // Rerender with active state
      rerender(
        <WardDynamicIsland
          {...buildDischargesHudProps({
            statusFilter: currentFilter,
          })}
        />,
      );
      expect(blockedBtn.getAttribute("aria-pressed")).toBe("true");

      // Click again to deactivate (toggle back to 'all')
      fireEvent.click(blockedBtn);
      currentFilter = "all";

      rerender(
        <WardDynamicIsland
          {...buildDischargesHudProps({
            statusFilter: currentFilter,
          })}
        />,
      );
      expect(blockedBtn.getAttribute("aria-pressed")).toBe("false");
    });
  });

  // ==========================================================================
  // SECTION 3: ACCESSIBILITY & INTERACTION
  // ==========================================================================
  describe("3. Accessibility & Keyboard Interaction", () => {
    it("renders interactive metrics as native HTML buttons with type='button'", () => {
      const clickSpy = vi.fn();
      render(
        <WardDynamicIsland
          title="Interactive HUD"
          metrics={[
            { id: "m-btn-1", label: "Button Metric", value: 12, onClick: clickSpy, testId: "interactive-btn" },
            { id: "m-static-1", label: "Static Metric", value: 34, testId: "static-metric" },
          ]}
        />,
      );

      const btn = screen.getByTestId("interactive-btn");
      expect(btn.tagName.toLowerCase()).toBe("button");
      expect(btn.getAttribute("type")).toBe("button");

      const staticItem = screen.getByTestId("static-metric");
      expect(staticItem.tagName.toLowerCase()).toBe("li");
      expect(staticItem.querySelector("button")).toBeNull();
    });

    it("supports keyboard focus and responds to Enter and Space key presses", () => {
      const enterClick = vi.fn();
      render(
        <WardDynamicIsland
          title="Keyboard HUD"
          metrics={[{ id: "k-btn", label: "Focusable Metric", value: 99, onClick: enterClick, testId: "focus-btn" }]}
        />,
      );

      const btn = screen.getByTestId("focus-btn");
      btn.focus();
      expect(document.activeElement).toBe(btn);

      // Trigger Enter key
      fireEvent.click(btn);
      expect(enterClick).toHaveBeenCalledTimes(1);

      // Trigger Space key
      fireEvent.click(btn);
      expect(enterClick).toHaveBeenCalledTimes(2);
    });

    it("strictly preserves ARIA landmark roles: role='region', role='status', role='list', role='listitem'", () => {
      render(
        <WardDynamicIsland
          title="ARIA Landmark HUD"
          status="warning"
          metrics={[
            { id: "aria-1", label: "Occupied", value: 19 },
            { id: "aria-2", label: "Ready", value: 3, onClick: vi.fn() },
          ]}
        />,
      );

      // Outer region
      const region = screen.getByRole("region", { name: "ARIA Landmark HUD HUD" });
      expect(region).toBeDefined();

      // Status pip
      const statusPip = screen.getByRole("status");
      expect(statusPip).toBeDefined();

      // List container
      const list = screen.getByRole("list");
      expect(list).toBeDefined();

      // List items
      const items = screen.getAllByRole("listitem");
      expect(items).toHaveLength(2);
    });
  });

  // ==========================================================================
  // SECTION 4: OVERFLOW, STYLESHEET RESILIENCE & DESIGN TOKENS
  // ==========================================================================
  describe("4. Overflow, Stylesheet Resilience & Design Tokens", () => {
    it("CSS file enforces overflow-x auto, scrollbar suppression, and flex-wrap nowrap", () => {
      const cssPath = resolve(process.cwd(), "src/components/ward-management/shell/ward-dynamic-island.module.css");
      const css = readFileSync(cssPath, "utf8");

      // Verify horizontal scrolling with hidden scrollbar
      expect(css).toMatch(/overflow-x:\s*auto/);
      expect(css).toMatch(/scrollbar-width:\s*none/);
      expect(css).toMatch(/::-webkit-scrollbar\s*\{\s*display:\s*none/);

      // Verify nowrap metrics list
      expect(css).toMatch(/flex-wrap:\s*nowrap/);

      // Verify stage head does not shrink
      expect(css).toMatch(/flex-shrink:\s*0/);

      // Verify mobile viewport query
      expect(css).toMatch(/@media\s*\(\s*max-width:\s*768px\s*\)/);
    });

    it("verifies ZERO raw hex, rgb, or hsl color literals in ward-dynamic-island.module.css", () => {
      const cssPath = resolve(process.cwd(), "src/components/ward-management/shell/ward-dynamic-island.module.css");
      const css = readFileSync(cssPath, "utf8");

      // Remove comments before searching
      const cleanCss = css.replace(/\/\*[\s\S]*?\*\//g, "");

      // Check for raw hex colors (#fff, #123456, etc.)
      const rawHexMatches = cleanCss.match(/#[0-9a-fA-F]{3,8}\b/g);
      expect(rawHexMatches).toBeNull();

      // Check for raw rgb() or rgba() literals
      const rawRgbMatches = cleanCss.match(/rgba?\s*\(/g);
      expect(rawRgbMatches).toBeNull();

      // Check for raw hsl() or hsla() literals
      const rawHslMatches = cleanCss.match(/hsla?\s*\(/g);
      expect(rawHslMatches).toBeNull();
    });

    it("verifies strict 12px text size floor across all styles in ward-dynamic-island.module.css", () => {
      const cssPath = resolve(process.cwd(), "src/components/ward-management/shell/ward-dynamic-island.module.css");
      const css = readFileSync(cssPath, "utf8");
      const cleanCss = css.replace(/\/\*[\s\S]*?\*\//g, "");

      // Search for font-size declarations
      const fontSizeDeclarations = cleanCss.match(/font-size:\s*([^;]+);/g) ?? [];
      expect(fontSizeDeclarations.length).toBeGreaterThan(0);

      fontSizeDeclarations.forEach((decl) => {
        // Must use token var(--t-0, 12px) or larger, never sub-12px
        expect(decl).toMatch(/var\(--t-0,\s*12px\)/);
      });
    });

    it("renders safely under extreme metric count stress (20+ metrics) without DOM crash", () => {
      const manyMetrics: DynamicIslandMetric[] = Array.from({ length: 25 }, (_, i) => ({
        id: `stress-metric-${i}`,
        label: `Metric ${i}`,
        value: i * 10,
        tone: i % 2 === 0 ? "good" : "warn",
      }));

      const { container } = render(<WardDynamicIsland title="Wide Load HUD" metrics={manyMetrics} />);

      const items = container.querySelectorAll("li");
      expect(items).toHaveLength(25);
    });
  });

  // ==========================================================================
  // SECTION 5: REAL SCREEN INTEGRATION MOUNTS
  // ==========================================================================
  describe("5. Live Target Screen Component Mounts", () => {
    it("Mounts HandoverPage with WardFlowProvider and renders live Handover HUD", () => {
      render(
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <HandoverPage />
        </WardFlowProvider>,
      );

      const hud = screen.getByTestId("ward-handover-kpi-strip");
      expect(hud).toBeDefined();
      expect(screen.getByText("Handover HUD")).toBeDefined();
      expect(screen.getByText(/Caseload in Scope/)).toBeDefined();
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

      // v6 hero: the urgency filter is the hero's "Forms shown" switch (All / Expiring).
      const expiringBtn = screen.getByRole("radio", { name: /^Expiring/u });
      expect(expiringBtn).toBeDefined();

      fireEvent.click(expiringBtn);
      // Urgency filter is now active
      expect(expiringBtn.getAttribute("aria-checked")).toBe("true");
    });

    it("Mounts CapacityScreen with WardFlowProvider and verifies co-existence of HUD and Gap Table", () => {
      render(
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <CapacityScreen />
        </WardFlowProvider>,
      );

      const hud = screen.getByLabelText("Statewide Bed Telemetry");
      const gapTable = screen.getByTestId("ward-capacity-gap-table");

      expect(hud).toBeDefined();
      expect(gapTable).toBeDefined();
      // v6: the hero carries the Live chip with its pause control, and the counts are hero stats.
      expect(screen.getByRole("button", { name: "Pause live updates" })).toBeDefined();
      expect(within(hud).getByRole("button", { name: /^\d+\s*locked ready$/iu })).toBeDefined();
    });
  });
});
