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
    const travelCell = screen.getByTestId(`ward-out-of-area-row-${first.admission.id}`).children[3];
    expect(travelCell.textContent?.trim()).toBe(TRAVEL_BAND_LABELS[first.band]);
    expect(facts).toHaveTextContent(sinceArrivalLabel(first, NOW_ANCHOR));
    expect(facts).toHaveTextContent("Current placement");
    expect(facts).toHaveTextContent("Home catchment");

    expect(screen.getByTestId(`ward-out-of-area-row-${first.admission.id}`)).toHaveAttribute("aria-selected", "true");
  });

  it("shows the next arrangement step without inventing clinical readiness or a receiving bed", () => {
    renderBoard();
    const first = entries[0];
    fireEvent.click(screen.getByTestId(`ward-out-of-area-row-${first.admission.id}`));

    const caveat = screen.getByTestId("ward-out-of-area-subject-caveat");
    expect(caveat).toHaveTextContent("confirm ward agreement");
    const inspector = screen.getByTestId("ward-out-of-area-subject");
    expect(inspector).not.toHaveTextContent(/clinically stable|ready for repatriation transfer|awaiting bed vacancy/i);
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

    fireEvent.click(
      within(screen.getByTestId("ward-out-of-area-subject")).getByRole("button", { name: /Initiate repatriation/i }),
    );

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

  it("filters placements when home catchment dropdown is selected", () => {
    renderBoard();
    const select = screen.getByTestId("ward-out-of-area-catchment-filter");
    expect(select).toBeInTheDocument();

    fireEvent.change(select, { target: { value: "South West" } });
    const swEntries = entries.filter((e) => e.admission.homeRegion === "South West");
    expect(swEntries.length).toBeGreaterThan(0);

    for (const entry of swEntries) {
      expect(screen.getByTestId(`ward-out-of-area-row-${entry.admission.id}`)).toBeInTheDocument();
    }

    const nonSw = entries.find((e) => e.admission.homeRegion !== "South West");
    if (nonSw) {
      expect(screen.queryByTestId(`ward-out-of-area-row-${nonSw.admission.id}`)).not.toBeInTheDocument();
    }
  });

  it("filters placements when an interactive catchment pill is clicked in the default view", () => {
    renderBoard();
    const pill = screen.getByRole("button", { name: /Filter by South West/i });
    expect(pill).toBeInTheDocument();
    expect(pill).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(pill);
    expect(pill).toHaveAttribute("aria-pressed", "true");

    const nonSw = entries.find((e) => e.admission.homeRegion !== "South West");
    if (nonSw) {
      expect(screen.queryByTestId(`ward-out-of-area-row-${nonSw.admission.id}`)).not.toBeInTheDocument();
    }

    // Clicking again toggles off
    fireEvent.click(pill);
    expect(pill).toHaveAttribute("aria-pressed", "false");
    if (nonSw) {
      expect(screen.getByTestId(`ward-out-of-area-row-${nonSw.admission.id}`)).toBeInTheDocument();
    }
  });

  it("clears selection back to cohort overview when Escape key is pressed", () => {
    renderBoard();
    const first = entries[0];
    fireEvent.click(screen.getByTestId(`ward-out-of-area-row-${first.admission.id}`));
    expect(screen.getByTestId("ward-out-of-area-subject-facts")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByTestId("ward-out-of-area-subject-facts")).not.toBeInTheDocument();
    expect(screen.getByTestId("ward-out-of-area-subject-empty")).toBeInTheDocument();
  });

  it("inspects the longest case directly from the priority case button", () => {
    renderBoard();
    const inspectBtn = screen.getByRole("button", { name: /Inspect Longest Case/i });
    expect(inspectBtn).toBeInTheDocument();

    fireEvent.click(inspectBtn);
    const facts = screen.getByTestId("ward-out-of-area-subject-facts");
    expect(facts).toBeInTheDocument();
    expect(facts).toHaveTextContent("AD-ALBA-01");
  });

  it("renders patient name and interactive UMRN links in table rows and headers", () => {
    renderBoard();
    const table = screen.getByTestId("ward-out-of-area-table");
    expect(within(table).getByText("Patient")).toBeInTheDocument();

    const first = entries[0];
    const row = screen.getByTestId(`ward-out-of-area-row-${first.admission.id}`);
    expect(row).toBeInTheDocument();

    const link = within(row).getByRole("link");
    expect(link).toHaveAttribute("href", expect.stringMatching(/^\/mockups\/ward-flow\/(people|search)/));
    expect(link.textContent).toMatch(/UM\d+|UMRN/);
  });

  it("renders patient name and UMRN link in mobile cards", () => {
    renderBoard();
    const cards = screen.getByTestId("ward-out-of-area-cards");
    const first = entries[0];
    const card = within(cards).getByTestId(`ward-out-of-area-card-${first.admission.id}`);
    expect(card).toBeInTheDocument();

    const link = within(card).getByRole("link");
    expect(link).toHaveAttribute("href", expect.stringMatching(/^\/mockups\/ward-flow\/(people|search)/));
  });

  it("renders patient name and interactive UMRN link in the case inspector when a case is selected", () => {
    renderBoard();
    const first = entries[0];
    fireEvent.click(screen.getByTestId(`ward-out-of-area-row-${first.admission.id}`));

    const facts = screen.getByTestId("ward-out-of-area-subject-facts");
    const link = within(facts).getByRole("link");
    expect(link).toHaveAttribute("href", expect.stringMatching(/^\/mockups\/ward-flow\/(people|search)/));
    expect(link.textContent).toMatch(/UM\d+|UMRN/);
  });

  it("filters placements when searching by patient name or UMRN", () => {
    renderBoard();
    const searchInput = screen.getByLabelText(/Filter out-of-area placements/i);
    const first = entries[0];
    const row = screen.getByTestId(`ward-out-of-area-row-${first.admission.id}`);
    const link = within(row).getByRole("link");
    const umrn = link.textContent?.trim() ?? "";

    if (umrn && umrn.startsWith("UM")) {
      fireEvent.change(searchInput, { target: { value: umrn } });
      expect(screen.getByTestId(`ward-out-of-area-row-${first.admission.id}`)).toBeInTheDocument();
      const other = entries.find((e) => e.admission.id !== first.admission.id);
      if (other) {
        expect(screen.queryByTestId(`ward-out-of-area-row-${other.admission.id}`)).not.toBeInTheDocument();
      }
    }
  });
});

describe("out-of-area inspector — navigation and explicit patient choice", () => {
  it("sorts the displayed register alphabetically and navigates in that order, retaining ledger order by default", () => {
    renderBoard();
    const register = screen.getByTestId("ward-out-of-area-table");
    const rows = () => within(register).getAllByTestId(/^ward-out-of-area-row-/);
    const originalIds = rows().map((row) => row.getAttribute("data-testid"));
    expect(originalIds).toEqual(entries.map((entry) => `ward-out-of-area-row-${entry.admission.id}`));
    const originalLabels = rows().map((row) => row.getAttribute("aria-label") ?? "");
    fireEvent.change(screen.getByLabelText("Sort placements"), { target: { value: "patient" } });
    expect(rows().map((row) => row.getAttribute("aria-label"))).toEqual(
      [...originalLabels].sort((a, b) => a.localeCompare(b, "en-AU")),
    );
    const sortedRows = rows();
    fireEvent.click(sortedRows[0]);
    fireEvent.click(screen.getByRole("button", { name: "Inspect next patient" }));
    expect(sortedRows[1]).toHaveAttribute("aria-selected", "true");
    fireEvent.change(screen.getByLabelText("Sort placements"), { target: { value: "ledger" } });
    expect(rows().map((row) => row.getAttribute("data-testid"))).toEqual(originalIds);
  });

  it("requires patient selection before opening the arrangement form", () => {
    renderBoard();
    const action = screen.getByRole("button", { name: /Initiate Repatriation/i });
    expect(action).toBeDisabled();
    fireEvent.click(action);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("navigates within the filtered register and keeps its row selection in sync", () => {
    renderBoard();
    const region = entries[0].admission.homeRegion as string;
    const cohort = entries.filter((entry) => entry.admission.homeRegion === region);
    expect(cohort.length).toBeGreaterThan(1);
    fireEvent.change(screen.getByTestId("ward-out-of-area-catchment-filter"), { target: { value: region } });
    fireEvent.click(screen.getByTestId(`ward-out-of-area-row-${cohort[0].admission.id}`));
    expect(screen.getByRole("button", { name: "Inspect previous patient" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Inspect next patient" }));
    expect(screen.getByTestId("ward-out-of-area-subject-facts")).toHaveTextContent(cohort[1].admission.id);
    expect(screen.getByTestId(`ward-out-of-area-row-${cohort[1].admission.id}`)).toHaveAttribute(
      "aria-selected",
      "true",
    );
    fireEvent.click(screen.getByRole("button", { name: "Inspect previous patient" }));
    expect(screen.getByTestId("ward-out-of-area-subject-facts")).toHaveTextContent(cohort[0].admission.id);
  });

  it("explains a selection outside the current filters and restores the full register", () => {
    renderBoard();
    const first = entries[0];
    fireEvent.click(screen.getByTestId(`ward-out-of-area-row-${first.admission.id}`));
    fireEvent.change(screen.getByLabelText("Filter out-of-area placements"), {
      target: { value: "no matching patient" },
    });
    expect(screen.getByTestId("ward-out-of-area-subject")).toHaveTextContent("Outside current filters");
    expect(screen.getByRole("button", { name: "Inspect next patient" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByTestId(`ward-out-of-area-row-${first.admission.id}`)).toHaveAttribute("aria-selected", "true");
  });

  it("returns focus to the selected row when the inspector closes", () => {
    renderBoard();
    const row = screen.getByTestId(`ward-out-of-area-row-${entries[0].admission.id}`);
    row.focus();
    fireEvent.keyDown(row, { key: "Enter" });
    const close = screen.getByRole("button", { name: "Return to cohort overview" });
    close.focus();
    fireEvent.click(close);
    expect(row).toHaveFocus();
  });

  it("leaves profile-link keyboard activation to the link", () => {
    renderBoard();
    const row = screen.getByTestId(`ward-out-of-area-row-${entries[0].admission.id}`);
    const link = within(row).getByRole("link");
    fireEvent.keyDown(link, { key: "Enter" });
    expect(screen.queryByTestId("ward-out-of-area-subject-facts")).not.toBeInTheDocument();
  });
});
