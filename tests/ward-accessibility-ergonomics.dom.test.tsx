import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { readFileSync } from "node:fs";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

// The answer view's back link goes through contextual history (ContextualBackLink), which reads
// the app router; jsdom has none mounted.
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { WardAnswerView } from "@/components/ward-management/ward/ward-answer-view";
import { PatientSearchPage } from "@/components/ward-management/search/patient-search";
import { ArrivalTimeModal } from "@/components/ward-management/referrals/arrival-time-modal";
import { WardTasksDrawer } from "@/components/ward-management/ward-tasks-drawer";
import { LegalFormsScreen } from "@/components/ward-management/legal-forms/legal-forms-screen";
import { HandoverPage } from "@/components/ward-management/handover/handover-page";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR, unitById } from "@/components/ward-management/ward-sites";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { buildActionInbox, isOpen } from "@/components/ward-management/ward-derivations";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Phase 4 Accessibility & Tablet/Mobile Ergonomics DOM and CSS Contracts", () => {
  const seed = seedWardFlowState();

  describe("1. WardAnswerView bed cells accessibility", () => {
    it("renders bed cells as native buttons with aria-label, enabled when vacant, disabled when occupied", () => {
      const unit = unitById("sjgm-adult-open")!;
      render(
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <WardAnswerView unitId={unit.id} />
        </WardFlowProvider>,
      );

      const bedButtons = screen.getAllByRole("button", { name: /^Bed \d\d (READY|Pulled|Closed|Inpatient)$/ });
      expect(bedButtons.length).toBe(unit.beds);

      for (const btn of bedButtons) {
        expect(btn).toHaveAttribute("type", "button");
      }

      const readyBeds = bedButtons.filter((btn) => btn.getAttribute("aria-label")?.includes("READY"));
      const nonReadyBeds = bedButtons.filter((btn) => !btn.getAttribute("aria-label")?.includes("READY"));

      expect(readyBeds.length).toBeGreaterThan(0);
      for (const readyBed of readyBeds) {
        expect(readyBed).toBeEnabled();
      }

      expect(nonReadyBeds.length).toBeGreaterThan(0);
      for (const nonReadyBed of nonReadyBeds) {
        expect(nonReadyBed).toBeDisabled();
      }

      // Clicking a vacant bed with an active incoming referral triggers accept in principle modal
      const firstReady = readyBeds[0];
      fireEvent.click(firstReady);
      expect(screen.getByRole("dialog", { name: /accept/i })).toBeInTheDocument();
    });
  });

  describe("2. PatientSearchPage keyboard activation, preview sync, and ARIA state", () => {
    it("triggers selection, displays record preview, and updates aria-pressed / aria-selected", () => {
      render(
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <PatientSearchPage />
        </WardFlowProvider>,
      );

      const patientCards = screen.getAllByTestId(/^ward-patient-search-case-/);
      expect(patientCards.length).toBeGreaterThanOrEqual(2);

      const firstCard = patientCards[0];
      const secondCard = patientCards[1];

      // Second card selected via Enter
      fireEvent.keyDown(secondCard, { key: "Enter" });
      expect(secondCard.className).toContain("selected");
      expect(secondCard).toHaveAttribute("aria-pressed", "true");
      expect(firstCard).toHaveAttribute("aria-pressed", "false");
      expect(screen.getByTestId("ward-patient-search-preview")).toBeInTheDocument();

      // First card re-selected via Space
      fireEvent.keyDown(firstCard, { key: " " });
      expect(firstCard.className).toContain("selected");
      expect(firstCard).toHaveAttribute("aria-pressed", "true");
      expect(secondCard).toHaveAttribute("aria-pressed", "false");
      expect(screen.getByTestId("ward-patient-search-preview")).toBeInTheDocument();

      // Switch to dense view and verify aria-selected on row. v6 (Patients.png): Comfort / Dense is a
      // segmented control, so Dense is a radio.
      const denseBtn = screen.getByRole("radio", { name: /dense/i });
      fireEvent.click(denseBtn);

      const denseContainer = screen.getByRole("table", { name: "Dense caseload list" });
      const denseRows = within(denseContainer).getAllByRole("row");
      expect(denseRows.length).toBeGreaterThanOrEqual(2);
      expect(denseRows[0]).toHaveAttribute("aria-selected", "true");
      expect(denseRows[1]).toHaveAttribute("aria-selected", "false");

      fireEvent.keyDown(denseRows[1], { key: "Enter" });
      expect(denseRows[1]).toHaveAttribute("aria-selected", "true");
      expect(denseRows[0]).toHaveAttribute("aria-selected", "false");
    });
  });

  describe("3. ArrivalTimeModal focus trap", () => {
    it("traps Tab navigation within dialog bounds", () => {
      const movement = seed.movements[0];
      render(
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <ArrivalTimeModal isOpen={true} onClose={vi.fn()} movement={movement} />
        </WardFlowProvider>,
      );

      const dialog = screen.getByRole("dialog");
      expect(dialog).toBeInTheDocument();

      const focusables = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]',
        ),
      ).filter((element) => !element.closest("[hidden], [inert]"));

      expect(focusables.length).toBeGreaterThanOrEqual(2);

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      // Initial focus inside modal
      expect(dialog.contains(document.activeElement)).toBe(true);

      // Tab on last element wraps to first
      last.focus();
      expect(document.activeElement).toBe(last);
      fireEvent.keyDown(window, { key: "Tab" });
      expect(document.activeElement).toBe(first);

      // Shift+Tab on first element wraps to last
      first.focus();
      expect(document.activeElement).toBe(first);
      fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
      expect(document.activeElement).toBe(last);
    });
  });

  describe("4. WardTasksDrawer focus restoration", () => {
    const items = buildActionInbox(seed.movements.filter(isOpen), NOW_ANCHOR, seed.units);

    function TasksDrawerTestWrapper() {
      const [isOpen, setIsOpen] = useState(false);
      return (
        <div>
          <button type="button" data-testid="open-tasks-btn" onClick={() => setIsOpen(true)}>
            Open Tasks Drawer
          </button>
          {isOpen && (
            <WardTasksDrawer
              items={items}
              acknowledgements={{}}
              completions={{}}
              role="coordinator"
              now={NOW_ANCHOR}
              dispatch={vi.fn()}
              onClose={() => setIsOpen(false)}
              onSelectMovement={vi.fn()}
            />
          )}
        </div>
      );
    }

    it("restores focus to trigger button upon Escape dismissal", () => {
      render(
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <TasksDrawerTestWrapper />
        </WardFlowProvider>,
      );

      const triggerBtn = screen.getByTestId("open-tasks-btn");
      triggerBtn.focus();
      expect(document.activeElement).toBe(triggerBtn);

      fireEvent.click(triggerBtn);

      const drawer = screen.getByRole("complementary", { name: "Tasks" });
      expect(drawer).toBeInTheDocument();
      expect(drawer.contains(document.activeElement)).toBe(true);

      fireEvent.keyDown(window, { key: "Escape" });

      expect(screen.queryByRole("complementary", { name: "Tasks" })).toBeNull();
      expect(document.activeElement).toBe(triggerBtn);
    });
  });

  // v6 (LegalForms.png): "Record a form" is an in-page card, not a modal, so the hero button moves
  // focus into the card's first field rather than opening and trapping a dialog.
  describe("5. LegalFormsScreen Record a form focus", () => {
    it("moves focus from the hero's Record a form button into the Record a form card", () => {
      render(
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <LegalFormsScreen />
        </WardFlowProvider>,
      );

      const recordBtn = screen.getByRole("button", { name: "Record a form" });
      recordBtn.focus();
      expect(document.activeElement).toBe(recordBtn);

      fireEvent.click(recordBtn);

      const card = screen.getByRole("region", { name: "Record a form" });
      expect(card).toBeInTheDocument();
      expect(card.contains(document.activeElement)).toBe(true);
      expect(document.activeElement).toBe(screen.getByLabelText("Form type"));
      expect(screen.queryByRole("dialog", { name: "Record a form" })).toBeNull();
    });
  });

  describe("6. HandoverPage long-stay table keyboard accessibility", () => {
    it("renders table wrap with tabindex='0', role='region', and accessible label", () => {
      render(
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <HandoverPage />
        </WardFlowProvider>,
      );

      const rollupTab = screen.getByRole("tab", { name: /16:30 Rollup/i });
      fireEvent.click(rollupTab);

      const tableRegion = screen.getByRole("region", { name: "Long stay handover table" });
      expect(tableRegion).toBeInTheDocument();
      expect(tableRegion).toHaveAttribute("tabindex", "0");
      expect(within(tableRegion).getByRole("table")).toBeInTheDocument();
    });
  });

  describe("7. CSS contract: 85dvh viewport max-height with 85vh fallback", () => {
    it("enforces max-height 85vh fallback and 85dvh with overflow-y auto", () => {
      const arrivalModalCss = readFileSync(
        "src/components/ward-management/referrals/arrival-time-modal.module.css",
        "utf8",
      );
      expect(arrivalModalCss).toMatch(/\.dialog\s*\{[^}]*max-height:\s*85vh;/);
      expect(arrivalModalCss).toMatch(/\.dialog\s*\{[^}]*max-height:\s*85dvh;/);
      expect(arrivalModalCss).toMatch(/\.dialog\s*\{[^}]*overflow-y:\s*auto;/);

      const communityCss = readFileSync("src/components/ward-management/community/community.module.css", "utf8");
      expect(communityCss).toMatch(/\.modalBox\s*\{[^}]*max-height:\s*85vh;/);
      expect(communityCss).toMatch(/\.modalBox\s*\{[^}]*max-height:\s*85dvh;/);
      expect(communityCss).toMatch(/\.modalBox\s*\{[^}]*overflow-y:\s*auto;/);
    });
  });

  describe("8. CSS contract: var(--ward-tap, 3rem) touch target minimums", () => {
    it("enforces touch targets on community close buttons and on-call phone call buttons", () => {
      const communityCss = readFileSync("src/components/ward-management/community/community.module.css", "utf8");
      expect(communityCss).toMatch(/\.drawerClose\s*\{[^}]*min-width:\s*var\(--ward-tap,\s*3rem\);/);
      expect(communityCss).toMatch(/\.drawerClose\s*\{[^}]*min-height:\s*var\(--ward-tap,\s*3rem\);/);
      expect(communityCss).toMatch(/\.modalCloseBtn\s*\{[^}]*min-width:\s*var\(--ward-tap,\s*3rem\);/);
      expect(communityCss).toMatch(/\.modalCloseBtn\s*\{[^}]*min-height:\s*var\(--ward-tap,\s*3rem\);/);

      const onCallCss = readFileSync("src/components/ward-management/on-call/on-call.module.css", "utf8");
      // A1 (9 Oct 2026): the routing links went; the phone call button on every row is the tap target.
      expect(onCallCss).toMatch(/\.phoneCall\s*\{[^}]*min-height:\s*var\(--ward-tap,\s*3rem\);/);
      // v6: the service filter is the shared HeroTrack (heights from --wf-h-*, lifted to 44px on
      // coarse pointers); the row's own star control sizes from the same control token.
      expect(onCallCss).toMatch(/\.favouriteButton\s*\{[^}]*height:\s*var\(--wf-h-sm\);/);
    });
  });

  describe("9. CSS contract: safe-area-inset on sticky bars and tablet rail breakpoint", () => {
    it("keeps the tablet rail breakpoint", () => {
      // The safe-area pins on the full-page intake form's submit bar went with that form (retired
      // 8 Oct 2026); the referral slide-out's own suite owns its sticky footer.
      const railCss = readFileSync("src/components/ward-management/shell/ward-rail.module.css", "utf8");
      expect(railCss).toMatch(/@media\s*\(\s*max-width:\s*48rem\s*\)\s*\{/);
    });
  });
});
