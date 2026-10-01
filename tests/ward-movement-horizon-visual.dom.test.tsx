import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";

import { MovementHorizonGantt } from "@/components/ward-management/movements/movement-horizon-gantt";
import { MovementsScreen } from "@/components/ward-management/movements/movements-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 48-HOUR BED MOVEMENT HORIZON: VISUAL & INTERACTIVE INTEGRITY SUITE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Programmatic verification of the 48-Hour Bed Movement Horizon component:
 * 1. Lanes are real receiving units, named and grouped by health service from the live fixture —
 *    not the seven hand-typed "FSH · Ward 4A" style fictions this suite pinned until 2026-09-16
 *    (see `tests/ward-movement-horizon-truth.test.ts` for the full rewrite this test suite's
 *    fixture-data assertions now defer to).
 * 2. Dynamic zoom range switching (12h, 24h, 48h).
 * 3. Bounded time scrubber synchronization without magic offsets.
 * 4. Adaptive event bar typography (zero text clipping).
 * 5. Full-width horizon Enlarge/Normal view toggle.
 * 6. Direct click-to-drawer clinical integration.
 */

const NOW = NOW_ANCHOR;

function renderMovementsScreen() {
  return render(
    <WardFlowProvider initialNow={NOW}>
      <MovementsScreen />
    </WardFlowProvider>,
  );
}

describe("48-Hour Bed Movement Horizon (Gantt Chart)", () => {
  it("renders a lane for a real receiving unit, named and serviced from the live fixture", () => {
    renderMovementsScreen();
    const trafficPanel = screen.getByRole("region", { name: "Today’s traffic" });
    expect(trafficPanel).toBeInTheDocument();

    // Dabakarn (site RPH, service "East Metro") receives two real open movements in the
    // hand-authored fixture — WF-003 (accepted, awaiting bed) and WF-014 (moving) — so this lane
    // and its service tag are both real facts the chart is entitled to show.
    expect(within(trafficPanel).getByTitle("Dabakarn")).toBeInTheDocument();
    expect(within(trafficPanel).getAllByText("East Metro").length).toBeGreaterThanOrEqual(1);
  });

  it("stacks two events sharing a lane into separate rows so both bars are visible and clickable — the fixed overlap defect", () => {
    renderMovementsScreen();
    const trafficPanel = screen.getByRole("region", { name: "Today’s traffic" });

    // Both WF-003 (accepted, awaiting bed) and WF-014 (moving) land in the Dabakarn lane
    // and both chart as zero-duration "now" markers (ward-movement-horizon-truth.test.ts: every
    // event but a live bed hold gets startH 0, durH 0). Before this fix both bars were positioned
    // at the same left/top and only the first in the DOM was actually visible or reachable.
    const barWF003 = trafficPanel.querySelector("[data-mid='WF-003']") as HTMLElement | null;
    const barWF014 = trafficPanel.querySelector("[data-mid='WF-014']") as HTMLElement | null;
    expect(barWF003).toBeInTheDocument();
    expect(barWF014).toBeInTheDocument();

    // Distinct rows: the two bars must not share the same computed inline `top`.
    expect(barWF003!.style.top).not.toBe("");
    expect(barWF014!.style.top).not.toBe("");
    expect(barWF003!.style.top).not.toBe(barWF014!.style.top);

    // Both independently reachable by their accessible name (role="button"), not merely present
    // as overlapping DOM nodes where only one receives pointer/keyboard focus.
    // Owner, 26 Sept 2026: a bar is named by its patient, never by its WF journey number.
    for (const bar of [barWF003!, barWF014!]) {
      const label = bar.getAttribute("aria-label") ?? "";
      expect(label).not.toMatch(/WF-/u);
      expect(bar.textContent ?? "").not.toMatch(/WF-/u);
      expect(within(trafficPanel).getByRole("button", { name: label })).toBe(bar);
    }
  });

  it("shows a plain empty-state message instead of a blank grid when there are no movements to chart", () => {
    render(<MovementHorizonGantt lanes={[]} corridors={[]} refusedCorridors={[]} units={[]} now={NOW} />);
    expect(screen.getByText(/No open movements with an accepting ward/u)).toBeInTheDocument();
  });

  it("F14 — renders no row for a lane whose only events fall beyond the zoom window, while an in-window lane still gets one", () => {
    // Default zoom is 48h (asserted elsewhere in this file), so `startH: 60` sits beyond every
    // selectable window and `startH: 2` sits inside all three. Before this fix the out-of-window
    // lane still drew a row — reserving its full track height — with every bar inside it returning
    // null, a blank strip nothing explained.
    render(
      <MovementHorizonGantt
        lanes={[
          {
            id: "lane-out-of-window",
            name: "Out Of Window Ward",
            service: undefined,
            events: [
              {
                id: "WF-OUT",
                type: "admit",
                startH: 60,
                durH: 2,
                origin: "FSH",
                dest: "Out Of Window Ward",
                carrier: "",
                title: "Out of window",
              },
            ],
          },
          {
            id: "lane-in-window",
            name: "In Window Ward",
            service: undefined,
            events: [
              {
                id: "WF-IN",
                type: "admit",
                startH: 2,
                durH: 1,
                origin: "FSH",
                dest: "In Window Ward",
                carrier: "",
                title: "In window",
              },
            ],
          },
        ]}
        corridors={[]}
        refusedCorridors={[]}
        units={[]}
        now={NOW}
      />,
    );
    expect(screen.getByTitle("In Window Ward")).toBeInTheDocument();
    expect(screen.queryByTitle("Out Of Window Ward")).toBeNull();
    expect(document.querySelector("[data-mid='WF-IN']")).toBeInTheDocument();
    expect(document.querySelector("[data-mid='WF-OUT']")).toBeNull();
  });

  it("never charts a movement with no accepted unit yet — WF-002 has none, and forms no bar", () => {
    renderMovementsScreen();
    const trafficPanel = screen.getByRole("region", { name: "Today’s traffic" });
    // WF-002 (fsh-ed, destination_review, no acceptedUnitId — ward-movements.ts) used to be
    // rendered as an invented "In Transit" bar to a fictional "FSH · Ward 4A" lane. It has no
    // destination in the model, so it has no bar to draw.
    expect(trafficPanel.querySelector("[data-mid='WF-002']")).toBeNull();
  });

  it("renders zoom controls with 48h active by default and switches between 12h, 24h, and 48h", () => {
    renderMovementsScreen();
    const trafficPanel = screen.getByRole("region", { name: "Today’s traffic" });
    const zoomGroup = within(trafficPanel).getByRole("group", { name: "Timeline zoom range" });

    const btn48 = within(zoomGroup).getByRole("button", { name: "48h" });
    const btn24 = within(zoomGroup).getByRole("button", { name: "24h" });
    const btn12 = within(zoomGroup).getByRole("button", { name: "12h" });

    expect(btn48).toHaveAttribute("aria-pressed", "true");
    expect(btn24).toHaveAttribute("aria-pressed", "false");
    expect(btn12).toHaveAttribute("aria-pressed", "false");

    const scrubber = within(trafficPanel).getByRole("slider", { name: "Timeline time scrubber" });
    expect(scrubber).toHaveAttribute("aria-valuemax", "48");

    // Switch to 24h
    fireEvent.click(btn24);
    expect(btn24).toHaveAttribute("aria-pressed", "true");
    expect(btn48).toHaveAttribute("aria-pressed", "false");
    expect(scrubber).toHaveAttribute("aria-valuemax", "24");

    // Switch to 12h
    fireEvent.click(btn12);
    expect(btn12).toHaveAttribute("aria-pressed", "true");
    expect(scrubber).toHaveAttribute("aria-valuemax", "12");
  });

  it("interactively scrubs the forecast timeline and resets to now", () => {
    renderMovementsScreen();
    const trafficPanel = screen.getByRole("region", { name: "Today’s traffic" });
    const scrubber = within(trafficPanel).getByRole("slider", { name: "Timeline time scrubber" });
    const badge = trafficPanel.querySelector("#ganttScrubBadgeText");

    expect(scrubber).toHaveValue("0");
    expect(badge).toHaveTextContent("NOW (+0h)");

    // Scrub forward 12 hours
    fireEvent.change(scrubber, { target: { value: "12" } });
    expect(scrubber).toHaveValue("12");
    expect(badge).toHaveTextContent(/\+12h/u);

    // Reset button
    const resetBtn = within(trafficPanel).getByRole("button", { name: "Reset" });
    fireEvent.click(resetBtn);
    expect(scrubber).toHaveValue("0");
    expect(badge).toHaveTextContent("NOW (+0h)");
  });

  it("opens a modal timeline, retains corridors and restores focus on Escape", () => {
    renderMovementsScreen();
    const trafficPanel = screen.getByRole("region", { name: "Today’s traffic" });
    const enlargeBtn = within(trafficPanel).getByRole("button", { name: "Enlarge" });

    expect(enlargeBtn).toHaveAttribute("aria-pressed", "false");
    expect(within(trafficPanel).getByRole("complementary", { name: "Ranked corridors" })).toBeInTheDocument();

    // Click Enlarge
    enlargeBtn.focus();
    fireEvent.click(enlargeBtn);
    expect(enlargeBtn).toHaveAttribute("aria-pressed", "true");
    expect(enlargeBtn).toHaveTextContent("Close full screen");
    const dialog = screen.getByRole("dialog", { name: "Full screen movement timeline" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(within(dialog).getByRole("complementary", { name: "Ranked corridors" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Hide" })).toBeDisabled();

    // Restore
    fireEvent.keyDown(window, { key: "Escape" });
    expect(enlargeBtn).toHaveAttribute("aria-pressed", "false");
    expect(enlargeBtn).toHaveTextContent("Enlarge");
    expect(enlargeBtn).toHaveFocus();
    expect(screen.queryByRole("dialog", { name: "Full screen movement timeline" })).toBeNull();
    expect(within(trafficPanel).getByRole("complementary", { name: "Ranked corridors" })).toBeInTheDocument();
  });

  it("clicking any timeline event bar opens the MovementDrawer with real clinical context", () => {
    renderMovementsScreen();
    const trafficPanel = screen.getByRole("region", { name: "Today’s traffic" });
    const eventBars = trafficPanel.querySelectorAll("[data-mid]");
    expect(eventBars.length).toBeGreaterThan(0);

    // WF-014 is genuinely in transit, FSH ED to Dabakarn (ward-movements.ts) — the same
    // record the horizon truth suite pins as the fixed "charted at the wrong ward" defect.
    const barWF014 = trafficPanel.querySelector("[data-mid='WF-014']");
    expect(barWF014).toBeInTheDocument();

    fireEvent.click(barWF014 as Element);

    // Assert drawer opens
    const drawer = screen.getByRole("dialog");
    expect(drawer).toBeInTheDocument();
    // Owner, 26 Sept 2026: the drawer is titled by the patient's name, resolved from the seed register.
    const seed = seedWardFlowState();
    const wf014 = resolveSubjectPatient(
      seed.movements.find((movement) => movement.id === "WF-014"),
      seed,
    );
    expect(within(drawer).getByRole("heading", { name: `${wf014.formalName} — what is recorded` })).toBeInTheDocument();
    expect(within(drawer).getByRole("heading", { name: "Person" })).toBeInTheDocument();
    expect(within(drawer).getByRole("heading", { name: "Journey" })).toBeInTheDocument();
    expect(within(drawer).getByRole("heading", { name: "Transport leg" })).toBeInTheDocument();
  });

  it("filters timeline lanes by health service using the toolbar switcher", () => {
    renderMovementsScreen();
    const trafficPanel = screen.getByRole("region", { name: "Today’s traffic" });
    const switcher = within(trafficPanel).getByRole("combobox", { name: "Filter movement horizon by health service" });

    expect(switcher).toHaveValue("ALL");
    expect(within(trafficPanel).getByTitle("Dabakarn")).toBeInTheDocument(); // East Metro
    expect(within(trafficPanel).getByTitle("Bunbury Acute Psychiatric Unit")).toBeInTheDocument(); // WACHS

    // Switch to East Metro
    fireEvent.change(switcher, { target: { value: "East Metro" } });
    expect(switcher).toHaveValue("East Metro");
    expect(within(trafficPanel).getByTitle("Dabakarn")).toBeInTheDocument();
    expect(within(trafficPanel).queryByTitle("Bunbury Acute Psychiatric Unit")).toBeNull();

    // Switch back to All Services
    fireEvent.change(switcher, { target: { value: "ALL" } });
    expect(switcher).toHaveValue("ALL");
    expect(within(trafficPanel).getByTitle("Bunbury Acute Psychiatric Unit")).toBeInTheDocument();
  });

  it("toggles row density between compact and expanded", () => {
    renderMovementsScreen();
    const trafficPanel = screen.getByRole("region", { name: "Today’s traffic" });
    const densityGroup = within(trafficPanel).getByRole("group", { name: "Row density" });
    const btnCompact = within(densityGroup).getByRole("button", { name: "Compact" });
    const btnExpand = within(densityGroup).getByRole("button", { name: "Roomy" });

    // Defaults to compact
    expect(btnCompact).toHaveAttribute("aria-pressed", "true");
    expect(btnExpand).toHaveAttribute("aria-pressed", "false");

    // Toggle to expanded
    fireEvent.click(btnExpand);
    expect(btnExpand).toHaveAttribute("aria-pressed", "true");
    expect(btnCompact).toHaveAttribute("aria-pressed", "false");

    // Toggle back to compact
    fireEvent.click(btnCompact);
    expect(btnCompact).toHaveAttribute("aria-pressed", "true");
    expect(btnExpand).toHaveAttribute("aria-pressed", "false");
  });
});
