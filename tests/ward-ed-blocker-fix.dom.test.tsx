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

/** Opens the sheet's "Not available yet" fold, where the greyed actions sit (Josh, 31 Oct 2026). */
function openNotAvailable(actions: HTMLElement) {
  const fold = within(actions).queryByRole("button", { name: /^Not available yet \(\d+\)$/ });
  if (fold && fold.getAttribute("aria-expanded") !== "true") fireEvent.click(fold);
}

describe("a greyed item in the ED actions menu", () => {
  // Redesign (pop-ed-actions, Josh 31 Oct 2026): greyed items move out of their group into "Not
  // available yet (n)", each with its short reason and its one fix, replacing the note in the group.
  it("folds into Not available yet with its visible why, and the fix as a menu item", () => {
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
    const menu = screen.getByTestId("actions-menu");
    // Nothing is left in its own group once its only item is greyed.
    expect(within(menu).queryByRole("group", { name: "Transfer and handover", hidden: true })).toBeNull();
    const toggle = within(menu).getByRole("menuitem", { name: "Not available yet (1)", hidden: true });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    const group = within(menu).getByRole("group", { name: "Not available yet", hidden: true });
    expect(within(group).getByRole("menuitem", { name: "Mark handover ready", hidden: true })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
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
        openNotAvailable(actions);
        // Josh (31 Oct 2026): the greyed actions sit under "Not available yet", as on the desktop menu.
        for (const greyed of Array.from(
          actions.querySelectorAll<HTMLButtonElement>(
            '[role="group"][aria-label="Not available yet"] button[aria-disabled="true"]',
          ),
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

  it("puts Log transport booking beside a handover that waits on transport, and it opens the booking form", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <EdScreen edId="arm-ed" />
      </WardFlowProvider>,
    );
    fireEvent.click(within(screen.getByTestId("ward-ed-patient-WF-011")).getByRole("button"));
    openNotAvailable(screen.getByTestId("ward-ed-phone-actions-WF-011"));
    const note = screen.getByTestId("ward-ed-unavailable-handover-WF-011");
    expect(note.textContent).toContain("Transport not logged");
    fireEvent.click(within(note).getByRole("button", { name: "Log transport booking" }));
    expect(screen.getByTestId("ward-ed-book-transport-toggle-WF-011").getAttribute("aria-expanded")).toBe("true");
    // The community referral waits on an examination. H-0974 (26 Oct 2026): with the bed pulled,
    // Transport booked is this sheet's pinned next step, not Record exam, so the note offers
    // Record examination beside its words.
    const cmht = screen.getByTestId("ward-ed-unavailable-cmht-WF-011");
    expect(cmht.textContent).toContain("Examination outcome not recorded");
    expect(within(cmht).getByRole("button", { name: "Record examination" })).toBeInTheDocument();
  });
});

/**
 * Blocker mock-up, Josh approved 26 Oct 2026 ("Approve, ED desk first"): the missing item is always
 * shown; tapping or focusing the greyed action opens its reason and who acts next, on the phone too.
 */
describe("the blocker opens in place when the greyed action is tapped", () => {
  const original = typeof window !== "undefined" ? window.matchMedia : undefined;
  function phone(matches: boolean) {
    window.matchMedia = ((query: string) => ({
      matches: matches && query === "(max-width: 48rem)",
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      onchange: null,
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  }
  afterEach(() => {
    if (original) window.matchMedia = original;
  });
  function openSheet() {
    phone(true);
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <EdScreen edId="arm-ed" />
      </WardFlowProvider>,
    );
    fireEvent.click(within(screen.getByTestId("ward-ed-patient-WF-011")).getByRole("button"));
    openNotAvailable(screen.getByTestId("ward-ed-phone-actions-WF-011"));
  }

  it("state 1: names the missing transport, why, and the ED nurse in charge, with no second copy below", () => {
    openSheet();
    // Josh (31 Oct 2026): under "Not available yet" the reason, why and who acts next all show at
    // once, as on the desktop menu, with nothing to tap open.
    const detail = screen.getByTestId("ward-ed-unavailable-handover-WF-011-detail");
    expect(detail.textContent).toBe(
      "A handover is marked ready once the transport booking is logged.Next: ED nurse in charge, Armadale ED",
    );
    fireEvent.click(screen.getByTestId("ward-ed-handover-WF-011"));
    // The sheet's own reason line under the list stays away: the block already says it.
    expect(
      screen.getByTestId("ward-ed-phone-actions-WF-011").parentElement?.querySelector("p[role='status']"),
    ).toBeNull();
    // The title and screen-reader sentence are unchanged.
    expect(screen.getByTestId("ward-ed-handover-WF-011").title).toMatch(/has no transport booked/);
    // The Presentation line no longer says the handover is ready while its button is greyed.
    const sheet = screen.getByTestId("ward-ed-phone-sheet-WF-011");
    expect(sheet.textContent).toContain("Bed pulled. Transport not logged yet.");
    expect(sheet.textContent).not.toContain("ready to mark the handover");
  });

  it("state 3: names the missing examination outcome, the form held, and the ED clinician", () => {
    openSheet();
    fireEvent.focus(screen.getByTestId("ed-refer-cmht-WF-011"));
    const detail = screen.getByTestId("ward-ed-unavailable-cmht-WF-011-detail");
    expect(detail.textContent).toMatch(
      /^On Form \w+, so a community referral needs the outcome first\.Next: ED clinician, Armadale ED$/,
    );
  });

  it("state 3 on the desktop menu: Record examination sits beside the blocker and opens the examination form", () => {
    phone(false);
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <EdScreen edId="arm-ed" />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByTestId("ward-ed-unfold-WF-011"));
    const menu = screen.getByTestId("ward-ed-actions-menu-WF-011");
    // Redesign (pop-ed-actions, Josh 31 Oct 2026): the greyed item sits under "Not available yet",
    // with its reason, why and who acts next all shown, nothing to tap open.
    fireEvent.click(within(menu).getByRole("menuitem", { name: /^Not available yet \(\d+\)$/, hidden: true }));
    const notAvailable = within(menu).getByRole("group", { name: "Not available yet", hidden: true });
    const cmht = within(notAvailable).getByTestId("ward-ed-unavailable-cmht-WF-011");
    expect(cmht.textContent).toContain("Examination outcome not recorded");
    expect(within(cmht).getByTestId("ward-ed-unavailable-cmht-WF-011-detail").textContent).toMatch(
      /^On Form \w+, so a community referral needs the outcome first\.Next: ED clinician, Armadale ED$/,
    );
    fireEvent.click(within(cmht).getByRole("menuitem", { name: "Record examination", hidden: true }));
    expect(screen.getByTestId("ward-ed-examine-form-WF-011")).toBeTruthy();
  });

  it("state 2: names the answers left, and a blank CAD warns as CAD to follow without blocking", () => {
    openSheet();
    fireEvent.click(
      within(screen.getByTestId("ward-ed-unavailable-handover-WF-011")).getByRole("button", {
        name: "Log transport booking",
      }),
    );
    const dialog = screen.getByTestId("ward-ed-book-transport-WF-011");
    const left = within(dialog).getByTestId("ward-ed-book-transport-left-WF-011");
    // Josh, 31 Oct 2026: the form starts with nothing chosen, so the day and the legal status are
    // among the answers left. CAD to follow (Josh, 27 Oct 2026): the CAD number is not.
    expect(left.textContent).toContain(
      "5 answers left: provider, estimated time, today or tomorrow, escort answer, legal status",
    );
    expect(left.getAttribute("role")).toBe("status");
    // The confirm keeps its full sentence for screen readers.
    const confirm = within(dialog).getByTestId("ward-ed-book-transport-confirm-WF-011");
    expect(confirm.title).toMatch(/choose who is collecting the patient/);

    fireEvent.click(within(left).getByRole("button", { name: "Add provider" }));
    const provider = within(dialog).getByTestId("ward-ed-transport-provider-WF-011") as HTMLSelectElement;
    expect(document.activeElement).toBe(provider);
    fireEvent.change(provider, { target: { value: provider.options[1].value } });
    fireEvent.click(within(dialog).getByTestId("ward-ed-transport-escort-yes-WF-011"));
    fireEvent.click(within(dialog).getByTestId("ward-ed-transport-legal-status-involuntary-WF-011"));
    fireEvent.change(within(dialog).getByTestId("ward-ed-transport-estimated-time-WF-011"), {
      target: { value: "13:30" },
    });
    expect(within(dialog).getByTestId("ward-ed-book-transport-left-WF-011").textContent).toContain(
      "1 answer left: today or tomorrow",
    );
    fireEvent.click(within(dialog).getByTestId("ward-ed-transport-estimated-day-today-WF-011"));

    // With every answer given, the top line says so.
    expect(within(dialog).getByTestId("ward-ed-book-transport-left-WF-011").textContent).toBe(
      "Every answer given. Check them, then save.",
    );
    const cad = within(dialog).getByTestId("ward-ed-transport-cad-number-WF-011") as HTMLInputElement;
    expect(cad.value).toBe("");
    expect(within(dialog).getByTestId("ward-ed-transport-cad-to-follow-WF-011").textContent).toContain("CAD to follow");
    expect(confirm.getAttribute("aria-disabled")).toBeNull();

    fireEvent.change(cad, { target: { value: "CAD-48213" } });
    expect(within(dialog).queryByTestId("ward-ed-transport-cad-to-follow-WF-011")).toBeNull();
    expect(confirm.getAttribute("aria-disabled")).toBeNull();
  });
});
