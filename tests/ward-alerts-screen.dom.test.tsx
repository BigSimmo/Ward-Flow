import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { buttonClass, phoneRows } from "@/components/wf";

import { AlertsScreen } from "@/components/ward-management/alerts/alerts-screen";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { alertKindOf, escalationAppliesTo } from "@/components/ward-management/alerts/alerts-model";
import {
  buildActionInbox,
  eligibleCandidatesAmong,
  isOpen,
  type InboxItem,
} from "@/components/ward-management/ward-derivations";
import { INBOX_CATEGORIES, seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { activeTaskItems, taskItems } from "@/components/ward-management/ward-act-now-items";
import { wardPlannedAdmissions } from "@/components/ward-management/ward-admissions-seed";
import { wardMovements } from "@/components/ward-management/ward-movements";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { openAlertKindGroups } from "./helpers/alerts-kind-groups";

/**
 * **THE ALERTS SCREEN — and the tests are mostly about what it says when nothing is firing.**
 *
 * 🔴 Ward Lead's ruling, 2026-09-12: **an empty alerts screen must never say "nothing is wrong".**
 * That is a clinical claim about the whole service, made by a screen that checks a handful of
 * conditions against one fixture. It says **what it looked at and found none of** — by name, per
 * section, whether the section is empty or not.
 *
 * ⚠️ **And the hazard the ruling exists for: a coordinator acts on what is loudest.** A screen
 * somebody opens four times and finds blank is one they stop opening, and the fifth time is the one
 * that matters. **A screen that names its conditions and reports on all of them is still worth
 * opening when most are empty. One that says "all clear" is not.**
 */

const NOW = NOW_ANCHOR;

// The router's query, as `useSearchParams` gives it. Empty unless a test sets it.
const address = { query: "" };
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useSearchParams: () => new URLSearchParams(address.query),
}));

function renderScreen() {
  return render(
    <WardFlowProvider initialNow={NOW}>
      <AlertsScreen />
    </WardFlowProvider>,
  );
}

/**
 * 🔴 **COUNTED BY ID PREFIX, NEVER BY `kind`.** Every member of `INBOX_CATEGORIES` carries
 * `kind: "fact"` — measured — so `items.filter((i) => i.kind === "legal_timing_breached")` matches
 * **zero items on any data, forever**. The build contract for this screen proposed exactly that
 * filter as its catcher: it would have passed against a screen rendering nothing and against a
 * screen rendering garbage, both green.
 *
 * Filtered to `isOpen` — matching `AlertsScreen`'s own call — so this helper cannot silently
 * diverge from the screen it is meant to be checking; see
 * `tests/ward-alerts-open-movements-only.dom.test.tsx` for the case that scoping fixes.
 */
function countInCategory(category: keyof typeof INBOX_CATEGORIES): number {
  const prefix = INBOX_CATEGORIES[category].idPrefix;
  return buildActionInbox(wardMovements.filter(isOpen), NOW, allUnits()).filter((item) => item.id.startsWith(prefix))
    .length;
}

/** Every condition this screen claims to watch, by its name in the hero's Checking list. */
const CONDITIONS = [
  "Legal due time passed",
  "Every ward declined",
  "Unsuitable destination",
  "Pull expired",
  "Transport not left",
  "Target overdue",
  "Triage waiting",
  "ED over a day",
  "Override recorded",
] as const;

/**
 * The hero's Checking list. Alerts redesign (Josh, 31 Oct 2026): the strip is one chip ("6 flagged ·
 * 7 clear") that opens the full list in place, so the chip is opened first when the list is closed.
 */
function checkingList() {
  const open = screen.queryByRole("list", { name: "Conditions checked" });
  if (open) return open;
  fireEvent.click(screen.getByRole("button", { name: /^Checking \d+ flagged · \d+ clear$/u }));
  return screen.getByRole("list", { name: "Conditions checked" });
}

describe("the Alerts screen reports on every condition it watches, firing or not", () => {
  it("retains visible wording in acknowledged alert action names", () => {
    renderScreen();
    fireEvent.click(screen.getAllByTestId("ward-alerts-open")[0]!);
    const more = screen.getByTestId("alerts-more-actions");
    more.setAttribute("open", "");
    const acknowledge = within(more).getByRole("button", { name: /^Acknowledge / });
    fireEvent.click(acknowledge);
    const seen = within(more).getByRole("button", { name: /^Seen: / });
    expect(seen).toHaveTextContent("Seen");
    expect(seen).toHaveAttribute("aria-disabled", "true");
    const take = screen.queryByRole("button", { name: /^Take / });
    if (take) fireEvent.click(take);
    // P019: the owner is offered Hand back (the Alerts redesign's name for Release) in place of the greyed "Yours".
    const yours = screen.getByRole("button", { name: /^Hand back / });
    expect(yours).toHaveTextContent("Hand back");
  });

  it("renders every named condition, including the ones with nothing to show", () => {
    renderScreen();
    for (const condition of CONDITIONS) {
      expect(
        within(checkingList()).getByRole("listitem", { name: condition }),
        `"${condition}" is not on the screen. A condition that appears only when it fires makes an ` +
          `empty screen claim a completeness it does not have: the reader cannot tell "checked and ` +
          `clear" from "not checked at all".`,
      ).toBeInTheDocument();
    }
  });

  /**
   * 🔴 **THE ASSERTION THIS SCREEN EXISTS FOR.** Three of its conditions are legitimately empty on
   * today's fixture, and the tempting summary for that state is "all clear" — which is a claim
   * about the service, not about the SEVEN things this screen measured. ⚠️ This said FOUR, as did
   * two sentences in the screen itself. 🔴 The screen has always rendered seven and the CONDITIONS
   * array in this very file lists seven — and when the screen's two were corrected, this one was
   * left standing, because the report that found them named those two. **Fixing the instances a
   * report shows you and calling that the set is the defect underneath half of tonight's
   * findings.**
   */
  it("never tells a coordinator that nothing is wrong", () => {
    const { container } = renderScreen();
    const text = container.textContent ?? "";

    for (const forbidden of [/all clear/iu, /nothing is wrong/iu, /no alerts/iu, /everything is fine/iu]) {
      expect(
        text,
        `the screen says something matching ${forbidden} — a claim about the whole service, made by a ` +
          `screen that checked a handful of conditions against one fixture`,
      ).not.toMatch(forbidden);
    }
  });

  /**
   * ⚠️ **THE SCOPE SENTENCE MUST SURVIVE THE ROWS ARRIVING.** This project has a recorded defect
   * where the honest qualifier lived in an empty state and vanished exactly when the list filled —
   * so the reader lost the only statement of scope at the moment there was something to misread.
   *
   * 🔴 **So this asserts it on a POPULATED section**, not an empty one, and floors itself on that
   * population being non-empty first.
   */
  it("keeps each condition's scope sentence when that condition has rows", () => {
    const populated = countInCategory("transport_awaiting_departure");
    expect(
      populated,
      "no transport row in the fixture — this test would assert the scope sentence on an EMPTY " +
        "section, which is the one case it is not about",
    ).toBeGreaterThan(0);

    renderScreen();
    const section = within(checkingList()).getByRole("listitem", { name: "Transport not left" });

    expect(
      within(section).getByText(/Watches accepted transport legs/u),
      "the scope sentence is gone now that the section has rows — the qualifier lived in the empty " +
        "state and vanished when there was finally something to qualify",
    ).toBeInTheDocument();
  });

  /**
   * 🔴 **THE UNBUILDABLE CONDITION IS VISIBLE AS A GAP, NOT ABSENT.** The design carries a
   * "handover sheet due" alert and nothing in this model records when a shift hands over — no
   * deadline, no timestamp, no condition, and therefore no catcher. **Silently omitting it would
   * let an empty screen imply it had checked.**
   */
  it("says out loud that it cannot watch handover sheets", () => {
    renderScreen();
    const section = within(checkingList()).getByRole("listitem", { name: "Not checked: handover sheets" });

    expect(section).toHaveTextContent(/handover/iu);
    expect(
      section,
      "the screen names handover sheets without saying WHY it cannot watch them, so a reader cannot " +
        "tell a missing feature from a missing fact",
    ).toHaveTextContent(/records when a shift hands over/u);
  });

  /**
   * The override section reports twice, and the second half outlives the first: the fixture has
   * zero overrides today, but the record does not retain a prior gate verdict even if it had one.
   * A reader who saw only "none recorded" would assume the row works and has no data.
   */
  it("states the override record's prior-gate absence and retained record facts", () => {
    renderScreen();
    const section = within(checkingList()).getByRole("listitem", { name: "Override recorded" });
    expect(section).toHaveTextContent(/who, when, which fixed reason and which wards/u);
    expect(section).toHaveTextContent(/does not retain a prior gate verdict/u);
  });

  /**
   * ⚠️ **THE ANTI-VACUITY FLOOR FOR THE WHOLE FILE.** Every assertion above reads a screen rendered
   * from the shared fixture. If that fixture ever renders nothing at all, the tests above pass over
   * an empty page — so this proves the screen actually drew rows, using a count derived the only
   * way that discriminates a category.
   */
  it("actually rendered the fixture's rows, so the assertions above are not over an empty page", () => {
    const rows =
      countInCategory("bed_pull_expired") +
      countInCategory("destinations_declined") +
      countInCategory("transport_awaiting_departure") +
      // Clinical owner ruling (14 Oct 2026): no eligible bed notifies the bed coordinator.
      countInCategory("no_eligible_bed") +
      // Planned admissions past their expected arrival (stream D) also draw a row.
      buildActionInbox([], NOW, allUnits(), { plannedAdmissions: wardPlannedAdmissions }).length +
      // L1 (site review, 12 Oct 2026): the arrival and discharge notification rows the Tasks badge
      // counts are on Alerts too, so the two agree.
      taskItems(seedWardFlowState(), NOW).filter(
        (item) =>
          item.id.startsWith(INBOX_CATEGORIES.support_notification_arrival.idPrefix) ||
          item.id.startsWith(INBOX_CATEGORIES.support_notification_discharge.idPrefix),
      ).length;
    expect(rows, "no inbox row in the fixture — every assertion in this file would be vacuous").toBeGreaterThan(0);

    const { container } = renderScreen();
    // Alerts redesign (point 17): runs of one kind are group rows; each alert keeps its own row inside.
    openAlertKindGroups(container);
    /*
     * 🔴 THIS USED TO ASSERT THE FIXTURE HAD ROWS AND THEN CHECK ONLY THAT THE PAGE EXISTED.
     * Deleting the row-rendering branch from `Condition` left every test in this file green — the
     * headings render, the forbidden phrases stay absent, the scope sentence is still there, and
     * the page id is still in the document. **A floor that measures the FIXTURE and not the DOM is
     * not a floor.** Found by an adversarial read.
     */
    const renderedRows = container.querySelectorAll("li[data-tone]");
    expect(
      renderedRows.length,
      "the screen drew no alert row at all, so every assertion in this file is over a page with no " + "alerts on it",
    ).toBe(rows);
    const triage = within(checkingList()).getByRole("listitem", { name: "Triage waiting" });
    expect(triage).toHaveTextContent(/\d+ of \d+ referrals have never been triaged/u);
  });
});

describe("Alerts v10 pass (10 Oct 2026)", () => {
  it("highlights by dimming the other rows by colour, keeps every row, and edges act now rows", () => {
    renderScreen();
    const rows = () => document.querySelectorAll("[data-alert-id]");
    const before = rows().length;
    expect(before).toBeGreaterThan(0);
    for (const row of document.querySelectorAll('[data-alert-id][data-act="true"]')) {
      expect(row.getAttribute("data-tone")).not.toBeNull();
    }
    fireEvent.click(screen.getByRole("button", { name: /Act now/ }));
    expect(rows().length).toBe(before);
    const dimmed = document.querySelectorAll('[data-alert-id][data-dim="true"]').length;
    const lit = document.querySelectorAll('[data-alert-id][data-highlighted="true"]').length;
    expect(dimmed + lit).toBe(before);
    expect(screen.getByText(new RegExp(`^${lit} of \\d+ highlighted, all rows stay$`))).toBeInTheDocument();
  });

  it("names the condition it does not check instead of a bare count, and never says All clear", () => {
    renderScreen();
    expect(within(checkingList()).getByText("Not checked: handover sheets")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/All clear/i);
  });
});

describe("Alerts owner menu (remaining-pages audit ops-15, 13 Oct 2026; one menu, 31 Oct 2026)", () => {
  // Josh, 31 Oct 2026 (answer 17): the owner menu is the phone's; the desktop uses Arrange by, Owner.
  it("names a booking ward in the phone owner menu, never the bare word Ward", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: query === "(max-width: 48rem)",
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    try {
      renderScreen();
      const planned = taskItems(seedWardFlowState(), NOW).find((item) => item.plannedAdmission !== undefined);
      expect(planned, "the seed has a planned arrival owned by its booking ward").toBeDefined();
      const menu = screen.getByRole("combobox", { name: "Highlight by owner" });
      expect((menu as HTMLSelectElement).value, "nothing chosen at first").toBe("");
      const labels = within(menu)
        .getAllByRole("option")
        .filter((option) => (option as HTMLOptionElement).value !== "")
        .map((option) => option.textContent ?? "");
      expect(labels.length).toBeGreaterThan(0);
      expect(labels.some((label) => label.includes(planned!.owner))).toBe(true);
      for (const label of labels) expect(label.replace(/\(\d+\)/gu, "").trim(), labels.join("|")).not.toBe("Ward");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("Alerts phone hero (remaining-pages audit ops-14, 13 Oct 2026)", () => {
  it("makes Next alert the one primary and Broadcast a secondary", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: query === "(max-width: 48rem)",
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    try {
      renderScreen();
      const hero = within(screen.getByTestId("ward-alerts-phone-hero"));
      // Redesign (31 Oct 2026): both sit as Home's hero pills; Next keeps the one light (primary) face.
      expect(hero.getByRole("button", { name: /^Next alert/u }).className).toBe(
        buttonClass({ variant: "light", className: phoneRows.heroPill }),
      );
      expect(hero.getByRole("button", { name: /^Broadcast/u }).className).toBe(
        buttonClass({ variant: "onHero", className: phoneRows.heroPill }),
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("Alerts counts agree (remaining-pages audit ops-3, 13 Oct 2026)", () => {
  it("the hero's open count is the Now tab's count and the Tasks list, running targets included", () => {
    const lapsed = taskItems(seedWardFlowState(), NOW).find((item) => alertKindOf(item.id) === "hold");
    expect(lapsed?.movementId, "the seed has a lapsed bed pull").toBeTruthy();
    let world: ReturnType<typeof useWardFlow> | undefined;
    function Probe() {
      world = useWardFlow();
      return null;
    }
    render(
      <WardFlowProvider initialNow={NOW}>
        <AlertsScreen />
        <Probe />
      </WardFlowProvider>,
    );
    // Releasing the lapsed bed starts a running transfer-acceptance target: the case that split them.
    act(() => {
      world!.dispatch({
        type: "RELEASE_PULL",
        role: "coordinator",
        now: NOW,
        movementId: lapsed!.movementId!,
        reason: "patient_no_longer_coming",
      });
    });
    const active = activeTaskItems(world!, NOW);
    expect(active.some((item) => alertKindOf(item.id) === "running")).toBe(true);
    const meta = [...document.querySelectorAll("span")].find((span) => /^\d+ open/u.test(span.textContent ?? ""));
    const open = Number(/^(\d+) open/u.exec(meta?.textContent ?? "")?.[1]);
    expect(open).toBe(active.length);
    expect(screen.getByRole("tab", { name: /^Now/u }).textContent).toContain(String(open));
  });
});

describe("Escalate only applies to a bed search that is really exhausted (PR #349 review)", () => {
  const units = allUnits();
  const open = wardMovements.filter(isOpen);
  const rowFor = (prefix: string, movementId: string) => ({ id: `${prefix}${movementId}` }) as InboxItem;
  const declinesRow = (id: string) => rowFor(INBOX_CATEGORIES.destinations_declined.idPrefix, id);
  const unsuitableRow = (id: string) => rowFor(INBOX_CATEGORIES.destination_unlawful.idPrefix, id);
  const noBedRow = (id: string) => rowFor(INBOX_CATEGORIES.no_eligible_bed.idPrefix, id);
  const wf009 = open.find((movement) => movement.id === "WF-009")!;
  const wf308 = open.find((movement) => movement.id === "WF-308")!;

  it("is offered for the seed's declined-by-all and no-eligible-bed movements", () => {
    expect(escalationAppliesTo(declinesRow(wf009.id), wf009, units, NOW)).toBe(true);
    expect(escalationAppliesTo(noBedRow(wf308.id), wf308, units, NOW)).toBe(true);
  });

  it("is refused when a ward has already accepted, whichever placement alert is showing", () => {
    const accepted = { ...wf009, acceptedUnitId: units[0]!.id };
    expect(escalationAppliesTo(unsuitableRow(accepted.id), accepted, units, NOW)).toBe(false);
    expect(escalationAppliesTo(declinesRow(accepted.id), accepted, units, NOW)).toBe(false);
  });

  it("is refused for an unsuitable-destination alert even with no ward accepted on the record", () => {
    expect(escalationAppliesTo(unsuitableRow(wf009.id), wf009, units, NOW)).toBe(false);
  });

  it("is refused for three declines while another ward is still eligible", () => {
    const threeDeclines = wf009.declines.slice(0, 3);
    const widenable = open
      .filter((movement) => movement.acceptedUnitId === undefined)
      .map((movement) => ({ ...movement, declines: threeDeclines, escalation: undefined }))
      .find((movement) =>
        eligibleCandidatesAmong(movement, units, NOW, units.length).some((candidate) => candidate.verdict.eligible),
      );
    expect(widenable, "the seed has an open movement with an eligible ward").toBeDefined();
    expect(escalationAppliesTo(declinesRow(widenable!.id), widenable, units, NOW)).toBe(false);
  });

  it("is refused for an alert about something else and for a missing movement", () => {
    const lapsed = taskItems(seedWardFlowState(), NOW).find((item) => alertKindOf(item.id) === "hold")!;
    const lapsedMovement = open.find((movement) => movement.id === lapsed.movementId);
    expect(escalationAppliesTo(lapsed, lapsedMovement, units, NOW)).toBe(false);
    expect(escalationAppliesTo(noBedRow(wf308.id), undefined, units, NOW)).toBe(false);
  });
});

describe("Audit 1 (CS-15): the alert nobody chose says it is first in line", () => {
  it("labels the first-in-line alert until one is chosen", () => {
    renderScreen();
    expect(screen.getByTestId("ward-alerts-first-in-line")).toHaveTextContent("First in line, not chosen yet");
    fireEvent.click(screen.getAllByTestId("ward-alerts-open").at(-1)!);
    expect(screen.queryByTestId("ward-alerts-first-in-line")).not.toBeInTheDocument();
  });
});

describe("opening a chosen alert from the drawer (change 7, D-77)", () => {
  it("chooses the alert named in the address and puts focus on its release reason", async () => {
    const inbox = buildActionInbox(wardMovements.filter(isOpen), NOW, allUnits());
    const hold = inbox.find((item) => alertKindOf(item.id) === "hold");
    if (!hold) throw new Error("fixture drifted: the seeded inbox has no expired bed hold");
    // A client-side visit can first render with the previous page's query; it must not use up
    // the address, so the release link that follows still works.
    address.query = "view=list";
    try {
      const { rerender } = renderScreen();
      expect(screen.queryByRole("combobox", { name: "Reason for release" })).not.toHaveFocus();
      address.query = `alert=${encodeURIComponent(hold.id)}&release=1`;
      rerender(
        <WardFlowProvider initialNow={NOW}>
          <AlertsScreen />
        </WardFlowProvider>,
      );
      const reason = await screen.findByRole("combobox", { name: "Reason for release" });
      await vi.waitFor(() => expect(reason).toHaveFocus());
      // CT-19: the reason-gated release names its patient on the button itself.
      const submits = screen
        .getAllByRole("button", { name: /^Release pulled bed/ })
        .filter((button) => button.textContent?.startsWith("Release pulled bed for "));
      expect(submits.length).toBeGreaterThan(0);
      for (const button of submits) expect(button.textContent).toMatch(/^Release pulled bed for \S/);
      expect(screen.queryByRole("button", { name: /^Release bed$/ })).not.toBeInTheDocument();
    } finally {
      address.query = "";
    }
  });
});
