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

  it("puts Log transport booking beside a handover that waits on transport, and it opens the booking form", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <EdScreen edId="arm-ed" />
      </WardFlowProvider>,
    );
    fireEvent.click(within(screen.getByTestId("ward-ed-patient-WF-011")).getByRole("button"));
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
  }

  it("state 1: names the missing transport, why, and the ED nurse in charge, with no second copy below", () => {
    openSheet();
    const detail = screen.getByTestId("ward-ed-unavailable-handover-WF-011-detail");
    expect(detail.textContent).toBe("");
    fireEvent.click(screen.getByTestId("ward-ed-handover-WF-011"));
    expect(detail.textContent).toBe(
      "A handover is marked ready once the transport booking is logged.Next: ED nurse in charge, Armadale ED",
    );
    expect(detail.getAttribute("role")).toBe("status");
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
    const cmht = within(menu).getByTestId("ward-ed-unavailable-cmht-WF-011");
    expect(cmht.textContent).toContain("Examination outcome not recorded");
    fireEvent.focus(within(menu).getByTestId("ed-refer-cmht-WF-011"));
    expect(within(cmht).getByTestId("ward-ed-unavailable-cmht-WF-011-detail").textContent).toContain(
      "Next: ED clinician, Armadale ED",
    );
    fireEvent.click(within(cmht).getByRole("menuitem", { name: "Record examination", hidden: true }));
    expect(screen.getByTestId("ward-ed-examine-form-WF-011")).toBeTruthy();
  });

  it("state 2: names the answers left, marks the empty CAD field, and moves to it", () => {
    openSheet();
    fireEvent.click(
      within(screen.getByTestId("ward-ed-unavailable-handover-WF-011")).getByRole("button", {
        name: "Log transport booking",
      }),
    );
    const dialog = screen.getByTestId("ward-ed-book-transport-WF-011");
    const left = within(dialog).getByTestId("ward-ed-book-transport-left-WF-011");
    // A34: legal status starts from Legal now, so it is not among the answers left.
    expect(left.textContent).toContain("4 answers left: provider, escort answer, CAD number, estimated time");
    expect(within(dialog).getByTestId("ward-ed-book-transport-needs-WF-011").textContent).toBe("Needs 4 answers");

    const provider = within(dialog).getByTestId("ward-ed-transport-provider-WF-011") as HTMLSelectElement;
    fireEvent.change(provider, { target: { value: provider.options[1].value } });
    fireEvent.click(within(dialog).getByTestId("ward-ed-transport-escort-yes-WF-011"));
    fireEvent.click(within(dialog).getByTestId("ward-ed-transport-legal-status-involuntary-WF-011"));
    fireEvent.change(within(dialog).getByTestId("ward-ed-transport-estimated-time-WF-011"), {
      target: { value: "13:30" },
    });

    expect(left.textContent).toContain("1 answer left: CAD number");
    expect(within(dialog).getByTestId("ward-ed-book-transport-needs-WF-011").textContent).toBe("Needs the CAD number");
    const cad = within(dialog).getByTestId("ward-ed-transport-cad-number-WF-011") as HTMLInputElement;
    expect(cad.value).toBe("");
    expect(cad.hasAttribute("data-missing")).toBe(true);
    const described = (cad.getAttribute("aria-describedby") ?? "")
      .split(" ")
      .map((id) => document.getElementById(id)?.textContent);
    expect(described).toContain("CAD number missing. Read it off the call with the provider.");
    // The confirm keeps its full sentence for screen readers.
    const confirm = within(dialog).getByTestId("ward-ed-book-transport-confirm-WF-011");
    expect(confirm.getAttribute("aria-disabled")).toBe("true");
    expect(confirm.title).toMatch(/enter the CAD transport number/);

    fireEvent.click(within(left).getByRole("button", { name: "Add CAD number" }));
    expect(document.activeElement).toBe(cad);

    fireEvent.change(cad, { target: { value: "CAD-48213" } });
    expect(within(dialog).queryByTestId("ward-ed-book-transport-left-WF-011")).toBeNull();
    expect(within(dialog).queryByTestId("ward-ed-book-transport-needs-WF-011")).toBeNull();
    expect(cad.hasAttribute("data-missing")).toBe(false);
    expect(confirm.getAttribute("aria-disabled")).toBeNull();
  });
});
