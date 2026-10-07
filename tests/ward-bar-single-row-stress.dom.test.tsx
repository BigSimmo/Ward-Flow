import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const route = { pathname: "/mockups/ward-flow" };
vi.mock("next/navigation", () => ({
  usePathname: () => route.pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
}));

import { WardBar, WardBarMount } from "@/components/ward-management/shell/ward-bar";
import { WardLiveRegion, resetWardLiveRegionForTests } from "@/components/ward-management/shell/ward-live-region";
import type { WardPrimaryAction } from "@/components/ward-management/shell/ward-shell-types";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { WARD_NEW_REFERRAL_MENU } from "@/components/ward-management/ward-nav";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const BAR_CSS_PATH = "src/components/ward-management/shell/ward-bar.module.css";

function renderBar(primaryAction?: WardPrimaryAction) {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardLiveRegion />
      <WardBar primaryAction={primaryAction} />
    </WardFlowProvider>,
  );
}

describe("WardBar Single-Row Stress Test & CSS Contracts", () => {
  beforeEach(() => {
    if (typeof window.requestAnimationFrame !== "function") {
      window.requestAnimationFrame = ((cb: FrameRequestCallback) =>
        setTimeout(() => cb(Date.now()), 0) as unknown as number) as typeof window.requestAnimationFrame;
      window.cancelAnimationFrame = ((id: number) =>
        clearTimeout(id as unknown as ReturnType<typeof setTimeout>)) as typeof window.cancelAnimationFrame;
    }
  });

  afterEach(() => {
    resetWardLiveRegionForTests();
  });

  describe("CSS Architecture & Single-Row Guarantee", () => {
    const css = readFileSync(BAR_CSS_PATH, "utf8");

    it("pins .bar to single-row flex-wrap: nowrap", () => {
      expect(css).toMatch(/\.bar\s*\{[^}]*flex-wrap:\s*nowrap\s*!important/u);
      expect(css).not.toMatch(/\.bar\s*\{[^}]*flex-wrap:\s*wrap\b/u);
    });

    // v6 header (7 Oct 2026, boards 02 and 03): the bar is 60px, sharing the rail brand row's baseline.
    it("locks .bar height to 3.75rem", () => {
      expect(css).toMatch(/\.bar\s*\{[^}]*height:\s*3\.75rem/u);
      expect(css).toMatch(/\.bar\s*\{[^}]*min-height:\s*3\.75rem/u);
    });

    it("contains no breaking 100% width or multi-row order on centerGroup in media queries", () => {
      expect(css).not.toMatch(/\.centerGroup\s*\{[^}]*flex:\s*1\s+0\s+100%/u);
      expect(css).not.toMatch(/\.drawerTriggers,\s*\.primaryWrap,\s*\.primary\s*\{[^}]*order:\s*3/u);
    });

    it("shows the full New referral label on desktop in sentence case", () => {
      expect(css).toMatch(/\.primaryPrefix\s*\{[^}]*display:\s*inline/u);
      expect(css).toMatch(/\.primaryMain\s*\{[^}]*text-transform:\s*none/u);
    });

    it("ensures drawerTrigger and serviceTrigger meet the 48px tap-target floor", () => {
      expect(css).toMatch(/\.drawerTrigger\s*\{[^}]*min-height:\s*var\(--spacing-tap/u);
      expect(css).toMatch(/\.drawerTrigger\s*\{[^}]*min-width:\s*var\(--spacing-tap/u);
    });

    it("ensures primary action meets the 48px tap-target floor", () => {
      expect(css).toMatch(/\.primary\s*\{[^}]*min-height:\s*var\(--spacing-tap/u);
      expect(css).toMatch(/\.primary\s*\{[^}]*min-width:\s*var\(--spacing-tap/u);
    });

    // v6 (7 Oct 2026): the drawing keeps the Tools label at 1440px beside a 264px rail, so it goes at 66rem, not 72rem.
    it("hides mode labels from the bar's own width, tools first", () => {
      expect(css).toMatch(
        /@container\s+ward-bar\s*\(max-width:\s*66rem\)\s*\{[\s\S]*?\[data-bar-mode="tools"\]\s+\.triggerLabel/u,
      );
      expect(css).toMatch(
        /@container\s+ward-bar\s*\(max-width:\s*60rem\)\s*\{[\s\S]*?\[data-bar-mode="activity"\]\s+\.triggerLabel/u,
      );
    });

    it("omits the title clock and Activity time from the header", () => {
      renderBar();
      expect(screen.queryByTestId("ward-bar-clock")).not.toBeInTheDocument();
      expect(screen.getByTestId("ward-bar-activity-trigger")).not.toHaveTextContent(/\d{1,2}:\d{2}/u);
    });
  });

  describe("Interactive Stress Testing: Referral & Drawers", () => {
    it.each([
      { kind: "record-decision", label: "Record a decision" },
      { kind: "contact-team", label: "Contact a team" },
      { kind: "export-figures", label: "Export the figures" },
    ] as const)("keeps the shared header treatment for $label", (action) => {
      renderBar(action);
      const trigger = screen.getByTestId("ward-bar-primary-action");
      expect(trigger).toHaveAccessibleName(action.label);
      expect(trigger.className).toMatch(/referralPrimary/u);
      expect(trigger.querySelector('[class*="referralChevron"] .lucide-chevron-down')).toBeInTheDocument();
    });

    it("renders New referral primary action with exact text available", () => {
      renderBar({ kind: "new-referral", label: "New referral", menu: WARD_NEW_REFERRAL_MENU });
      const trigger = screen.getByTestId("ward-bar-primary-action");
      expect(trigger).toHaveTextContent("New referral");
      expect(within(trigger).getByText("referral")).toBeInTheDocument();
      expect(within(trigger).getByText("New")).toBeInTheDocument();
    });

    it("opens Referral menu with all three destinations and closes on Escape", async () => {
      const user = userEvent.setup();
      renderBar({ kind: "new-referral", label: "New referral", menu: WARD_NEW_REFERRAL_MENU });

      const trigger = screen.getByTestId("ward-bar-primary-action");
      expect(screen.queryByTestId("ward-bar-primary-panel")).toBeNull();

      await user.click(trigger);
      const panel = screen.getByTestId("ward-bar-primary-panel");
      expect(panel).toBeInTheDocument();

      expect(screen.getByTestId("ward-bar-primary-menu-community")).toHaveTextContent("From community");
      expect(screen.getByTestId("ward-bar-primary-menu-ed_medical")).toHaveTextContent("From ED");
      expect(screen.getByTestId("ward-bar-primary-menu-inter_hospital")).toHaveTextContent("From a ward");

      await user.keyboard("{Escape}");
      expect(screen.queryByTestId("ward-bar-primary-panel")).toBeNull();
      expect(trigger).toHaveFocus();
    });

    it("opens and closes Activity drawer correctly", async () => {
      const user = userEvent.setup();
      renderBar();

      const activityBtn = screen.getByTestId("ward-bar-activity-trigger");
      expect(screen.queryByTestId("ward-bar-activity-sheet")).toBeNull();

      await user.click(activityBtn);
      expect(screen.getByTestId("ward-bar-activity-sheet")).toBeInTheDocument();

      await user.keyboard("{Escape}");
      await waitFor(() => {
        expect(screen.queryByTestId("ward-bar-activity-sheet")).toBeNull();
      });
      await waitFor(() => {
        expect(document.activeElement).toBe(activityBtn);
      });
    });

    it("opens and closes Tasks drawer correctly", async () => {
      const user = userEvent.setup();
      renderBar();

      const tasksBtn = screen.getByTestId("ward-bar-tasks-trigger");
      expect(screen.queryByTestId("ward-bar-tasks-sheet")).toBeNull();

      await user.click(tasksBtn);
      expect(screen.getByTestId("ward-bar-tasks-sheet")).toBeInTheDocument();

      await user.keyboard("{Escape}");
      await waitFor(() => {
        expect(screen.queryByTestId("ward-bar-tasks-sheet")).toBeNull();
      });
      await waitFor(() => {
        expect(document.activeElement).toBe(tasksBtn);
      });
    });

    it("opens and closes Tools drawer correctly", async () => {
      const user = userEvent.setup();
      renderBar();

      const toolsBtn = screen.getByTestId("ward-bar-tools-trigger");
      expect(screen.queryByTestId("ward-bar-tools-sheet")).toBeNull();

      await user.click(toolsBtn);
      expect(screen.getByTestId("ward-bar-tools-sheet")).toBeInTheDocument();

      await user.keyboard("{Escape}");
      await waitFor(() => {
        expect(screen.queryByTestId("ward-bar-tools-sheet")).toBeNull();
      });
      await waitFor(() => {
        expect(document.activeElement).toBe(toolsBtn);
      });
    });

    it("renders unwired primary action kinds properly and responds to clicks", async () => {
      const user = userEvent.setup();
      renderBar({ kind: "record-decision", label: "Record a decision" });

      const trigger = screen.getByTestId("ward-bar-primary-action");
      expect(trigger).toHaveTextContent("Record a decision");
      expect(trigger.tagName).toBe("BUTTON");

      await user.click(trigger);
      expect(screen.getByTestId("ward-bar-primary-panel")).toHaveTextContent("Not wired in this prototype.");

      await user.keyboard("{Escape}");
      expect(screen.queryByTestId("ward-bar-primary-panel")).toBeNull();
    });

    it("renders no primary action when kind is none or absent", () => {
      renderBar({ kind: "none" });
      expect(screen.queryByTestId("ward-bar-primary-action")).toBeNull();
    });

    it("WardBarMount resolves coordinator route to Referral action", () => {
      route.pathname = "/mockups/ward-flow";
      render(
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <WardLiveRegion />
          <WardBarMount />
        </WardFlowProvider>,
      );

      const trigger = screen.getByTestId("ward-bar-primary-action");
      expect(trigger).toHaveTextContent("New referral");
      expect(within(trigger).getByText("referral")).toBeInTheDocument();
    });
  });
});
