import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

// `OutOfAreaBoard` composes `ward-tokens.module.css`, and (per the sibling DOM test files for this
// same board) something in that shared chain renders `next/link` even though this board is
// mounted standalone here, with no rail around it. Mocked exactly as
// `tests/ward-out-of-area-figure-direction.dom.test.tsx` and `tests/ward-referral-screens.dom.test.tsx`
// already do, so this file does not become a third, independently-worded copy of that mock.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { OutOfAreaBoard, sinceArrivalLabel } from "@/components/ward-management/out-of-area/out-of-area-board";
import { TRAVEL_BAND_LABELS } from "@/components/ward-management/ward-distance";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { outOfAreaLedger } from "@/components/ward-management/ward-referrals";
import { NOW_ANCHOR, allUnits } from "@/components/ward-management/ward-sites";
import { wardAdmissions } from "@/components/ward-management/ward-admissions-seed";

/**
 * The build-contract catcher for the out-of-area upgrade
 * (`docs/ward-flow/build-contracts-2026-09-12/contract-out-of-area.md`), Sonnet, extraction/DOM
 * assertion.
 *
 * Two jobs, both required by the brief:
 *
 *  1. Every "APP ONLY" item the contract's three-way diff found — the sentence saying this board
 *     is not a medical device, the phone card list, the two-sentence "no fraction" counts framing
 *     — must still be there after the upgrade, asserted BY NAME (testid or exact wording), not by
 *     a generic smoke check that would pass on a screen missing half of them.
 *  2. The one finding the brief calls out as the most dangerous: the drawing carries the
 *     not-a-medical-device sentence only in a HOVER TOOLTIP (a `title` attribute), which is
 *     invisible on a phone and until a mouse lingers. `screen.getByText` only matches rendered
 *     TEXT NODES, never attribute values — so a tooltip-only implementation (the sentence moved
 *     into a `title="…"` on the badge, nothing else) fails this test with "Unable to find an
 *     element with the text", not a false pass. This was run red once on purpose (the expected
 *     substring changed to a string the component does not render), confirmed red, then reverted
 *     — see the build report for the exact strings used.
 */

const units = allUnits();
const { entries } = outOfAreaLedger(wardAdmissions, units, NOW_ANCHOR);

function renderBoard() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <OutOfAreaBoard admissions={wardAdmissions} />
    </WardFlowProvider>,
  );
}

describe("out-of-area upgrade — functional layout and clean presentation", () => {
  it("omits disclaimer banners from the functional view", () => {
    renderBoard();
    const banner = screen.queryByTestId("ward-out-of-area-governance");
    expect(banner).not.toBeInTheDocument();
  });

  it("keeps the phone card list as a second, independently keyed rendering of every entry", () => {
    renderBoard();
    expect(entries.length).toBeGreaterThan(0);

    const cards = screen.getByTestId("ward-out-of-area-cards");
    for (const entry of entries) {
      expect(within(cards).getByTestId(`ward-out-of-area-card-${entry.admission.id}`)).toBeInTheDocument();
    }
  });

  it("displays out-of-area counts in the executive KPI strip", () => {
    renderBoard();
    const board = screen.getByTestId("ward-out-of-area-board");
    expect(board).toHaveTextContent("Total Out-of-Area");
    expect(board).toHaveTextContent(String(entries.length));
  });

  it("omits explanatory warning notices above the entries", () => {
    renderBoard();
    expect(screen.queryByTestId("ward-out-of-area-meaning")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ward-out-of-area-threshold-notice")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ward-out-of-area-synthetic-notice")).not.toBeInTheDocument();
  });

  it("omits the explanatory provenance section", () => {
    renderBoard();
    expect(screen.queryByTestId("ward-out-of-area-provenance")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ward-out-of-area-figures-source")).not.toBeInTheDocument();
  });
});

describe("out-of-area upgrade — the new 'At a glance' selection panel", () => {
  it("shows a plain prompt, not a placement's facts, until something is selected", () => {
    renderBoard();
    expect(screen.getByTestId("ward-out-of-area-subject-empty")).toBeInTheDocument();
    expect(screen.queryByTestId("ward-out-of-area-subject-facts")).not.toBeInTheDocument();
  });

  it("selecting a row shows that admission's own facts, read off the same entry the row rendered", () => {
    renderBoard();
    const first = entries[0];
    fireEvent.click(screen.getByTestId(`ward-out-of-area-row-${first.admission.id}`));

    const facts = screen.getByTestId("ward-out-of-area-subject-facts");
    expect(facts).toHaveTextContent(first.admission.homeRegion as string);
    expect(facts).toHaveTextContent(first.unit.name);
    expect(facts).toHaveTextContent(TRAVEL_BAND_LABELS[first.band]);
    expect(facts).toHaveTextContent(sinceArrivalLabel(first, NOW_ANCHOR));
    // Every selectable row came from `entries` — the ledger's own out-of-area list — so this
    // sentence is true for every possible selection, not a default guess.
    expect(facts).toHaveTextContent("In a bed far from home");

    expect(screen.getByTestId(`ward-out-of-area-row-${first.admission.id}`)).toHaveAttribute("aria-selected", "true");
  });

  it("renders functional clinical repatriation assessment without explanatory caveats", () => {
    renderBoard();
    const first = entries[0];
    fireEvent.click(screen.getByTestId(`ward-out-of-area-row-${first.admission.id}`));

    const caveat = screen.getByTestId("ward-out-of-area-subject-caveat");
    expect(caveat.textContent).toContain("ready for repatriation transfer");
  });

  it("keeps the inspector clean of explanatory disclaimers when selection changes", () => {
    renderBoard();
    const first = entries[0];
    fireEvent.click(screen.getByTestId(`ward-out-of-area-row-${first.admission.id}`));

    expect(screen.queryByTestId("ward-out-of-area-figures-source")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ward-out-of-area-subject-catchment")).not.toBeInTheDocument();
  });

  it("selecting the phone card selects the same entry as its table row counterpart", () => {
    renderBoard();
    const first = entries[0];
    fireEvent.click(screen.getByTestId(`ward-out-of-area-card-${first.admission.id}`));

    expect(screen.getByTestId("ward-out-of-area-subject-facts")).toHaveTextContent(first.unit.name);
    expect(screen.getByTestId(`ward-out-of-area-card-${first.admission.id}`)).toHaveAttribute("aria-selected", "true");
  });

  it("triggers repatriation workflow and provides clear feedback that a return movement has been queued", () => {
    renderBoard();
    const first = entries[0];
    fireEvent.click(screen.getByTestId(`ward-out-of-area-row-${first.admission.id}`));

    // Click "Execute Repatriation Transfer Order"
    fireEvent.click(screen.getByText(/Execute Repatriation Transfer Order/i));

    // Fill form
    fireEvent.change(screen.getByTestId("ward-out-of-area-repat-home-hospital"), { target: { value: "RPH" } });
    fireEvent.click(screen.getByLabelText(/Yes — receiving ward has agreed/i));
    fireEvent.change(screen.getByTestId("ward-out-of-area-repat-mode"), { target: { value: "road" } });
    fireEvent.change(screen.getByTestId("ward-out-of-area-repat-provider"), { target: { value: "Ambulance service" } });
    fireEvent.change(screen.getByTestId("ward-out-of-area-repat-cad"), { target: { value: "CAD-9999" } });
    fireEvent.click(screen.getByLabelText("Voluntary"));
    fireEvent.change(screen.getByTestId("ward-out-of-area-repat-estimated-time"), { target: { value: "14:30" } });

    // Submit
    fireEvent.click(screen.getByTestId("ward-out-of-area-repat-submit"));

    // Feedback notice appears
    const notice = screen.getByTestId("ward-out-of-area-repat-notice");
    expect(notice).toBeInTheDocument();
    expect(notice.textContent).toContain("Return transfer movement queued for bed placement at home health service.");
    expect(notice.textContent).toContain("Royal Perth Hospital");
  });
});
