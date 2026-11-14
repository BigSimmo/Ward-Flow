import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AlertsScreen } from "@/components/ward-management/alerts/alerts-screen";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { clockState, DEFAULT_DUE_SOON_THRESHOLDS } from "@/components/ward-management/ward-clock";
import { wardMovements } from "@/components/ward-management/ward-movements";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * 🔴 **`AlertsScreen` CALLED `buildActionInbox` ON EVERY MOVEMENT, OPEN OR NOT.** Every other
 * caller of `buildActionInbox` — `shell/ward-bar.tsx`, `coordinator-screen.tsx`,
 * `ward-tasks-panel.tsx` — filters to `isOpen` first, because `buildActionInbox` itself does not
 * filter: it reports on whatever it is handed. An arrived (closed) movement whose legal form's due
 * time had passed still generated a "Legal timing breached" alert here, and was still counted in
 * the "N movements carry one" scope sentence, for a movement nobody can act on any more.
 *
 * This drives WF-014 — a real fixture movement carrying a 4A due time — past its due time with
 * `ADVANCE_CLOCK`, confirms the alert fires while the movement is still open, then closes it with
 * `PATIENT_ARRIVED` and confirms the journey's own row is gone. The fixture is used rather than a
 * hand-built movement so the reducer's own real closing path is exercised, not an assumption about
 * what `isOpen` means.
 *
 * Audit M1 and D-210 (Josh, 14 Nov 2026), ruling 2: arrival does not end the form. A person admitted
 * on a form whose typed expiry has passed raises one act-now row of its own on the coordinator's
 * alerts, owned by the ward's nurse in charge (`admittedLegalInboxItems`). So after arrival exactly
 * one "Legal due time passed" row remains for WF-014, and it is the admitted stay's row, not the
 * closed journey's. Were the closed journey still handed to `buildActionInbox`, its row would sit
 * beside or in place of the stay's row, and this test would fail.
 */

const WF_014_DUE_AT = wardMovements.find((movement) => movement.id === "WF-014")?.legalForm?.dueAt;
if (WF_014_DUE_AT === undefined) {
  throw new Error("WF-014 no longer carries a legal form due time — this file's whole scenario is built on it");
}
// Comfortably past the due time, but still well inside the fixture's normal test horizon.
const ADVANCE_MINUTES = WF_014_DUE_AT - NOW_ANCHOR + 30;

function Controls() {
  const { dispatch, now } = useWardFlow();
  return (
    <>
      <button
        type="button"
        data-testid="test-advance-clock"
        onClick={() => dispatch({ type: "ADVANCE_CLOCK", role: "demo", now, minutes: ADVANCE_MINUTES })}
      >
        advance clock
      </button>
      <button
        type="button"
        data-testid="test-patient-arrived"
        onClick={() => dispatch({ type: "PATIENT_ARRIVED", role: "coordinator", now, movementId: "WF-014" })}
      >
        mark arrived
      </button>
    </>
  );
}

function renderScreen() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <Controls />
      <AlertsScreen />
    </WardFlowProvider>,
  );
}

/** The Act now figure, read from the Open view's chip (the hero no longer repeats it, 4 Nov 2026). */
function actNowFigure(): number {
  const chips = screen.getByRole("group", { name: "Show open alerts" });
  const chip = within(chips).getByRole("button", { name: /Act now/u });
  return Number.parseInt((chip.textContent ?? "").replace(/\D+/gu, ""), 10);
}

describe("the alerts screen scopes buildActionInbox to open movements only", () => {
  it("fixture sanity: WF-014's due time is genuinely in the past once the clock is advanced", () => {
    const advancedNow = NOW_ANCHOR + ADVANCE_MINUTES;
    expect(
      clockState(WF_014_DUE_AT, advancedNow, DEFAULT_DUE_SOON_THRESHOLDS),
      "the advance no longer crosses WF-014's own due time — this scenario proves nothing",
    ).toBe("breached");
  });

  /*
   * ⚠️ THE EXACT COUNTS, MEASURED AGAINST THE LIVE FIXTURE, NOT GUESSED. At this offset the
   * fixture also carries the expired bed hold, the declined set and seven overdue decision
   * targets, so "Act now" is 10 while WF-014 is still open and drops to 9, not 0, once it closes.
   * Clinical owner ruling, 14 Oct 2026: the fixture's waiting patient with no eligible bed (WF-308)
   * notifies the bed coordinator as an act-now row, so the figures are 11 and 10. WF-009 raises no
   * row: one of its wards failed only a prior decline, so the coordinator can still refer there.
   * A16-13 (13 Nov 2026): each seeded pull now dates from its own ED stay, so three pulls that had
   * lapsed by this offset now run past it, and the figures are 9 and 8.
   * A9-13 (D-181 item 12): two ambulance referrals accepted at an ED (RF-008, RF-019) now join the
   * accepted-with-no-bed-pulled rows, so the figures are 11 and 10.
   * D-210 ruling 2 (14 Nov 2026): the admitted stay's own row takes the journey's place on arrival,
   * so the figure stays 11 after WF-014 closes.
   */
  it("counts and shows the alert while the movement is still open", () => {
    renderScreen();
    fireEvent.click(screen.getByTestId("test-advance-clock"));

    const actNow = screen.getByRole("region", { name: "Act now" });
    expect(within(actNow).getByText("Legal due time passed")).toBeInTheDocument();

    expect(
      actNowFigure(),
      // Q111 (1 Nov 2026), A9-13: the figure includes the fixture's three accepted referrals with no bed pulled.
      "WF-014's breach plus the fixture's other act-now items must read 11 while it is still open",
    ).toBe(11);
  });

  it("drops the journey's alert once it closes, leaving only the admitted stay's own row (D-210 ruling 2)", () => {
    renderScreen();
    fireEvent.click(screen.getByTestId("test-advance-clock"));
    fireEvent.click(screen.getByTestId("test-patient-arrived"));

    const actNow = screen.getByRole("region", { name: "Act now" });
    const rows = within(actNow).getAllByText("Legal due time passed");
    expect(
      rows,
      "WF-014 renders two legal rows after closing, so buildActionInbox is still being called on every movement",
    ).toHaveLength(1);
    expect(
      rows[0]!.closest("li")!,
      "the remaining row is not the admitted stay's row (owned by the nurse in charge), so it is the closed journey's",
    ).toHaveTextContent("With Nurse in charge");

    expect(
      actNowFigure(),
      "the Act now figure changed on arrival: the closed journey's row must give way to the stay's one row, not sit beside it",
    ).toBe(11);
  });
});
