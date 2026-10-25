import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { EdActionsMenu } from "@/components/ward-management/ed/ed-board-controls";
import { EdScreen } from "@/components/ward-management/ed/ed-screen";
import { EdUnavailableNote } from "@/components/ward-management/ed/ed-screen-row-menu";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Usability review, Josh approved 24 Oct 2026 ("blocker named, with the fix beside it"): a greyed
 * ED row action shows short visible words under it, and its one fix beside them only when the fix
 * is on this screen. Screen readers keep the full sentence through the button's description.
 */

describe("a greyed item in the ED actions menu", () => {
  it("keeps its visible why in its own group, with the fix as a menu item", () => {
    const run = vi.fn();
    render(
      <EdActionsMenu
        patientName="Synthetic patient"
        testId="actions-menu"
        triggerTestId="actions-trigger"
        onViewRecord={() => undefined}
        onEditPresentation={() => undefined}
        onEditPlan={() => undefined}
      >
        <button type="button" data-testid="ward-ed-handover-m1" aria-disabled="true" title="Full sentence.">
          Mark handover ready
        </button>
        <EdUnavailableNote
          testId="ward-ed-unavailable-handover-m1"
          line={{ because: "Needs transport logged first", fix: { label: "Log booking", testId: "fix-m1", run } }}
        />
      </EdActionsMenu>,
    );
    const group = within(screen.getByTestId("actions-menu")).getByRole("group", {
      name: "Transfer & handover",
      hidden: true,
    });
    expect(within(group).getByTestId("ward-ed-unavailable-handover-m1").textContent).toContain(
      "Needs transport logged first",
    );
    const fix = within(group).getByRole("menuitem", { name: "Log booking", hidden: true });
    fireEvent.click(fix);
    expect(run).toHaveBeenCalledTimes(1);
  });
});

describe("greyed actions on the ED board", () => {
  const original = typeof window !== "undefined" ? window.matchMedia : undefined;
  beforeEach(() => {
    window.matchMedia = ((query: string) => ({
      matches: query === "(max-width: 48rem)",
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      onchange: null,
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  });
  afterEach(() => {
    if (original) window.matchMedia = original;
  });

  it("says why under every greyed action in the phone sheet, and screen readers keep the full sentence", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <EdScreen edId="arm-ed" />
      </WardFlowProvider>,
    );
    const rows = screen.getAllByRole("listitem").filter((row) => row.dataset.testid?.startsWith("ward-ed-patient-"));
    let checked = 0;
    for (const row of rows) {
      const id = row.dataset.testid!.replace("ward-ed-patient-", "");
      fireEvent.click(within(row).getByRole("button"));
      const actions = screen.queryByTestId(`ward-ed-phone-actions-${id}`);
      if (actions) {
        for (const greyed of Array.from(
          actions.querySelectorAll<HTMLButtonElement>(':scope > button[aria-disabled="true"]'),
        )) {
          const note = greyed.nextElementSibling;
          expect(note?.hasAttribute("data-unavailable-note"), greyed.textContent ?? "").toBe(true);
          // The full sentence stays the button's accessible description, not only a tooltip.
          const describedBy = greyed.getAttribute("aria-describedby");
          expect(describedBy).toBeTruthy();
          expect(document.getElementById(describedBy!)?.textContent).toBe(greyed.title);
          checked += 1;
        }
      }
      fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("puts Log booking beside a handover that waits on transport, and it opens the booking form", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <EdScreen edId="arm-ed" />
      </WardFlowProvider>,
    );
    fireEvent.click(within(screen.getByTestId("ward-ed-patient-WF-011")).getByRole("button"));
    const note = screen.getByTestId("ward-ed-unavailable-handover-WF-011");
    expect(note.textContent).toContain("Needs transport logged first");
    fireEvent.click(within(note).getByRole("button", { name: "Log booking" }));
    expect(screen.getByTestId("ward-ed-book-transport-toggle-WF-011").getAttribute("aria-expanded")).toBe("true");
    // The community referral waits on an examination; Record exam is already pinned on this
    // sheet, so the words stand alone and no second Record examination is offered (D-77).
    const cmht = screen.getByTestId("ward-ed-unavailable-cmht-WF-011");
    expect(cmht.textContent).toContain("Needs the examination outcome first");
    expect(within(cmht).queryByRole("button")).toBeNull();
  });
});
