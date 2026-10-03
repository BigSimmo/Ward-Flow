import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AlertsScreen } from "@/components/ward-management/alerts/alerts-screen";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { clockState } from "@/components/ward-management/ward-clock";
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
 * `PATIENT_ARRIVED` and confirms the alert and the count both disappear. The fixture is used
 * rather than a hand-built movement so the reducer's own real closing path is exercised, not an
 * assumption about what `isOpen` means.
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
        onClick={() => dispatch({ type: "PATIENT_ARRIVED", role: "officer", now, movementId: "WF-014" })}
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

describe("the alerts screen scopes buildActionInbox to open movements only", () => {
  it("fixture sanity: WF-014's due time is genuinely in the past once the clock is advanced", () => {
    const advancedNow = NOW_ANCHOR + ADVANCE_MINUTES;
    expect(
      clockState(WF_014_DUE_AT, advancedNow),
      "the advance no longer crosses WF-014's own due time — this scenario proves nothing",
    ).toBe("breached");
  });

  /*
   * ⚠️ THE EXACT COUNTS, MEASURED AGAINST THE LIVE FIXTURE, NOT GUESSED. At this offset the
   * fixture also carries one unrelated `destinations_declined` item, so "Needs you" is 2 while
   * WF-014 is still open (its breach plus that one) and drops to 1 once WF-014 closes — never to
   * 0, which is exactly the number a vaguer "does not contain 1" assertion would have missed.
   */
  it("counts and shows the alert while the movement is still open", () => {
    renderScreen();
    fireEvent.click(screen.getByTestId("test-advance-clock"));

    const needsYou = screen.getByRole("region", { name: "Needs you alerts" });
    expect(within(needsYou).getByText("Legal due time passed")).toBeInTheDocument();

    const summaryList = screen.getByLabelText("Alert summary");
    expect(
      within(summaryList).getByText("Needs you").parentElement?.textContent,
      "WF-014's breach plus the fixture's one other needs-you item must read 2 while it is still open",
    ).toContain("2");
  });

  it("drops the alert, and excludes the movement from the count, once it closes", () => {
    renderScreen();
    fireEvent.click(screen.getByTestId("test-advance-clock"));
    fireEvent.click(screen.getByTestId("test-patient-arrived"));

    const needsYou = screen.getByRole("region", { name: "Needs you alerts" });
    expect(
      within(needsYou).queryByText("Legal due time passed"),
      "WF-014 still renders an alert after closing — buildActionInbox is still being called on every movement",
    ).not.toBeInTheDocument();

    const summaryList = screen.getByLabelText("Alert summary");
    const needsYouText = within(summaryList).getByText("Needs you").parentElement?.textContent ?? "";
    expect(needsYouText, "the summary count did not drop from 2 to 1 once the breached movement closed").toContain("1");
    expect(
      needsYouText,
      "the summary count still counts WF-014's now-closed breach alongside the other needs-you item",
    ).not.toContain("2");
  });
});
