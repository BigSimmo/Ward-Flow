import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

// Same jsdom-App-Router workaround as tests/ward-screen.dom.test.tsx and
// tests/ward-screen-eligibility-warning.dom.test.tsx's sibling dom suites.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { unitCapacity } from "@/components/ward-management/ward-derivations";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";
import { WardIndex } from "@/components/ward-management/wards/ward-index";
import { allUnits, NOW_ANCHOR, unitById } from "@/components/ward-management/ward-sites";

/**
 * Task B of `docs/superpowers/plans/2026-09-04-ward-flow-screens-patient-and-ward.md` — the ward
 * overview (`wards/ward-index.tsx`) and the ward screen (`ward/ward-screen.tsx`), rebuilt to
 * `mockup-ward-home.html` and `mockup-ward-entry.html`.
 *
 * ⚠️ THE DECISION THIS FILE EXISTS TO PROTECT: the "Open bed list" control on a ward's own screen
 * is never gated by the "Confirm today's numbers" panel. The current concise screen expresses
 * that through a real in-page link that carries neither `disabled` nor `aria-disabled`. This
 * follows Ward Flow's standing rule: a coordinator decision is never blocked, only recorded.
 *
 * Independent assertions guard its control state and its real destination, so a gate and a broken
 * in-page link fail for different reasons.
 */
const RPH_ADULT_SECURE = "rph-adult-secure";

describe("the ward screen — the bed-list control is never gated by the confirm panel", () => {
  it("is available with zero questions answered, and the link reaches its target", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardScreen unitId={RPH_ADULT_SECURE} />
      </WardFlowProvider>,
    );

    // Zero questions answered: this is the very first render, before any confirm control is
    // pressed. Asserted explicitly rather than assumed, because this is the state that must not
    // block the control.
    // ⚠️ "since this page opened", NOT "today" — `confirmedToday` is `useState`, so it counts
    // taps in THIS session and resets on reload. The label was corrected 2026-09-07; these two
    // assertions pinned the false word and would have reddened on the truthfulness fix.
    expect(screen.getByText("0 of 3 confirmed since this page opened")).toBeInTheDocument();

    const cta = screen.getByTestId("ward-hero-open-bed-list");
    // ⚠️ ASSERTION 1 of 2 — THE ATTRIBUTE CHECK.
    expect(cta).not.toHaveAttribute("disabled");
    expect(cta).not.toHaveAttribute("aria-disabled");

    // The current concise control remains a real link to the section it names. This checks the
    // available route independently of the disabled-state assertions above.
    expect(cta).toHaveAttribute("href", "#bed-capacity");
    expect(document.getElementById("bed-capacity")).toBeInTheDocument();
  });

  it("stays available once every question has been answered — the control is not a countdown", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardScreen unitId={RPH_ADULT_SECURE} />
      </WardFlowProvider>,
    );

    fireEvent.click(screen.getByTestId("ward-confirm-all"));
    // Owner Answer 18 (second round, 2026-09-17) replaced the free-text
    // `ward-confirm-constraints-input` with a fixed-list checkbox group; the save button is now
    // the stable handle onto the same form, submittable with nothing ticked (a valid answer).
    fireEvent.submit(screen.getByTestId("ward-confirm-constraints-save").closest("form")!);

    expect(screen.getByText("3 of 3 confirmed since this page opened")).toBeInTheDocument();

    const cta = screen.getByTestId("ward-hero-open-bed-list");
    expect(cta).not.toHaveAttribute("disabled");
    expect(cta).not.toHaveAttribute("aria-disabled");
    expect(cta).toHaveAttribute("href", "#bed-capacity");
    expect(document.getElementById("bed-capacity")).toBeInTheDocument();
  });

  it("points at this ward's own bed-capacity section, and shows the real, unitCapacity-derived ready-bed count", () => {
    const unit = unitById(RPH_ADULT_SECURE)!;
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardScreen unitId={RPH_ADULT_SECURE} />
      </WardFlowProvider>,
    );

    // Real, not invented: the same `unitCapacity()` this screen's own bed-capacity section reads.
    const available = unitCapacity(unit, []).available;
    expect(screen.getByTestId("ward-hero-ready")).toHaveTextContent(String(available));
    expect(screen.getByTestId("ward-hero-open-bed-list")).toHaveAttribute("href", "#bed-capacity");
    expect(document.getElementById("bed-capacity")).toBeInTheDocument();
  });

  /**
   * ⚠️ MUTATION 1 — proved automatically below, not just recorded. This is the same proof the
   * comment used to describe as a manual, temporary-then-reverted edit to `ward-screen.tsx`'s
   * `.heroCta` link: mutate the rendered `cta` node the same way (`aria-disabled="true"`, then an
   * altered `href`), and show that the exact real checks from the tests above — run against the
   * mutated node — now throw. The node is restored to its real, unmutated state before the test
   * ends, and the real checks are re-asserted against it, so this proves the assertions can fail
   * without leaving anything behind for a later test to trip over.
   *
   * The control-state check (`not.toHaveAttribute("aria-disabled")`) and the destination check
   * (`toHaveAttribute("href", "#bed-capacity")`) are proved independent of each other: mutating
   * one and re-running only that check leaves the other assertion unexercised, so a break in one
   * cannot be masked by the other still passing.
   */
  it("[contract record] availability checks cover both control state and destination", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardScreen unitId={RPH_ADULT_SECURE} />
      </WardFlowProvider>,
    );
    const cta = screen.getByTestId("ward-hero-open-bed-list");

    // Proof for the control-state check: an added aria-disabled attribute turns it red.
    cta.setAttribute("aria-disabled", "true");
    expect(() => expect(cta).not.toHaveAttribute("aria-disabled")).toThrow();
    cta.removeAttribute("aria-disabled");
    expect(cta).not.toHaveAttribute("aria-disabled");

    // Proof for the destination check: an altered href turns it red independently of the above.
    cta.setAttribute("href", "#somewhere-else");
    expect(() => expect(cta).toHaveAttribute("href", "#bed-capacity")).toThrow();
    cta.setAttribute("href", "#bed-capacity");
    expect(cta).toHaveAttribute("href", "#bed-capacity");
  });
});

describe("the ward overview — 23-ward directory cards and interactive filters", () => {
  it("renders interactive filter controls and live capacity indicators", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardIndex />
      </WardFlowProvider>,
    );
    const main = document.getElementById("main-content")!;
    // Search input and filter buttons are rendered
    expect(main.querySelector("#wardSearchInput")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /All Services/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "All Cohorts" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "All" })).toBeInTheDocument();

    // Statewide capacity KPIs
    expect(screen.getByText("Operational Wards")).toBeInTheDocument();
    expect(screen.getByText("Total Staffed Beds")).toBeInTheDocument();
    expect(screen.getByText("Available Beds Now")).toBeInTheDocument();
    expect(screen.getByText("Locked & HDU Units")).toBeInTheDocument();
  });

  it("links to every ward the live provider holds — none hand-picked, none missing", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardIndex />
      </WardFlowProvider>,
    );
    for (const unit of allUnits()) {
      expect(screen.getByTestId(`ward-index-link-${unit.id}`), `missing a card/link for ${unit.id}`).toHaveAttribute(
        "href",
        `/mockups/ward-flow/ward/${unit.id}`,
      );
    }
  });

  it("filters ward cards by search query and opens ward profile modal", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardIndex />
      </WardFlowProvider>,
    );
    const searchInput = screen.getByRole("searchbox", { name: "Filter wards by keyword" });
    fireEvent.change(searchInput, { target: { value: "FSH" } });

    // FSH units should be visible, others filtered out
    expect(screen.getByText("FSH Adult Secure")).toBeInTheDocument();

    // Reset filters
    const resetBtn = screen.getByRole("button", { name: "Reset Filters" });
    fireEvent.click(resetBtn);
    expect(searchInput).toHaveValue("");

    // Clicking Profile opens the modal
    const profileBtns = screen.getAllByRole("button", { name: /Profile/i });
    expect(profileBtns.length).toBeGreaterThan(0);
    fireEvent.click(profileBtns[0]);

    // Modal dialog is open
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getAllByText(/Clinical Profile/i).length).toBeGreaterThan(0);
  });

  it("renders the Ward Console third edition action bar, tab navigation, and interactive telemetry drawer", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardScreen unitId="rph-adult-secure" />
      </WardFlowProvider>,
    );

    // Top Action Bar & Live Capacity Glance Strip
    expect(screen.getByRole("button", { name: /Enter Ward \/ Open Bed Board/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Live Capacity Telemetry" })).toBeInTheDocument();

    // Operational Tabs exist
    const bedBoardTab = screen.getByRole("tab", { name: /Bed Board & Roster/i });
    expect(bedBoardTab).toBeInTheDocument();
    expect(bedBoardTab).toHaveAttribute("aria-selected", "false");

    // Click "Enter Ward / Open Bed Board" button
    const enterWardBtn = screen.getByRole("button", { name: /Enter Ward \/ Open Bed Board/i });
    fireEvent.click(enterWardBtn);

    // Bed Board tab is now active
    expect(bedBoardTab).toHaveAttribute("aria-selected", "true");

    // Interactive Bed Matrix is visible
    /*
     * 🔴 **READ FROM THE FIXTURE, NOT TYPED — AND THAT IS THE FIX, NOT A TIDY-UP.** This
     * line read `"All Beds (20)"` until 2026-09-18, when the owner had five wards resized to sample
     * numbers near their published figures and `rph-adult-secure` went 20 → 15. The screen was
     * correct; the test's typed literal was the only thing that broke, and it broke a whole DOM
     * suite over a data change it was never about.
     *
     * ⚠️ **This is not a check deriving its expectation from its own subject.** The
     * subject here is the SCREEN — does it label the matrix with the ward's bed count — and
     * the fixture is the independent source it must agree with. A screen showing any other number
     * still fails. The non-vacuity guard below is what stops a missing fixture turning this into
     * an assertion about nothing.
     */
    const wardBeds = unitById("rph-adult-secure")?.beds;
    expect(wardBeds, "rph-adult-secure is not in the fixture — this assertion would prove nothing").toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: `All Beds (${wardBeds})` })).toBeInTheDocument();
    const bed01Card = screen.getByRole("button", { name: /Bed 01/i });
    expect(bed01Card).toBeInTheDocument();

    // Clicking a bed opens the bed drawer
    expect(screen.queryByTestId("bed-telemetry-drawer")).not.toBeInTheDocument();
    fireEvent.click(bed01Card);

    const drawer = screen.getByTestId("bed-telemetry-drawer");
    expect(drawer).toBeInTheDocument();
    expect(drawer).toHaveTextContent(/Bed 01/i);
    expect(drawer).toHaveTextContent(/Patient Dossier/i);
    // Ward Flow holds no observations. The drawer used to type in the same SpO2, heart rate, blood
    // pressure, pacing mode and transmitter readings for every bed (25 September 2026 audit, A3);
    // it now says vital signs are not recorded, and no reading appears anywhere in it.
    expect(drawer).toHaveTextContent(/Vital signs\s*Not recorded in Ward Flow/i);
    expect(drawer).not.toHaveTextContent(/SpO2|bpm|mmHg|Transmitter|Telemetry|1:4/i);

    // Close the drawer
    const closeBtn = screen.getByRole("button", { name: /Close bed drawer/i });
    fireEvent.click(closeBtn);
    expect(screen.queryByTestId("bed-telemetry-drawer")).not.toBeInTheDocument();
  });
});
