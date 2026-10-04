import { renderAllDelays, inspectDelayPerson } from "./helpers/delays-interactions";
import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DelaysScreen } from "@/components/ward-management/delays/delays-screen";
import { legalDeadlineMinutes } from "@/components/ward-management/delays/delays-derivations";
import { clockState, splitDuration } from "@/components/ward-management/ward-clock";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { legalFormName } from "@/components/ward-management/ward-legal-forms";
import { wardMovements } from "@/components/ward-management/ward-movements";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * 🔴 **THE DELAYS ROW MARKED THE WRONG CLOCK, AND THIS IS THE FIGURE THAT FIXES IT.**
 *
 * `DelayRow`'s clock is the ED clock (`now - openedAt`, sub "in ED"), and its `urgent` flag is set
 * by `cause === "legal_expiring"`. **So a legal authority running out turned the ED clock red while
 * never stating the deadline, the form, or that a legal deadline was the reason.** The urgency
 * landed on the one figure it was not about.
 *
 * `delayGroups` answers WHICH CAUSE a movement falls under — a category. `legalDeadlineMinutes` was
 * written on that same module precisely because the number is lost once a caller can only see the
 * bucket, and **it had no caller anywhere until this change**.
 *
 * ⚠️ **WHAT THIS FILE DOES NOT CLAIM.** The deadline was never invisible everywhere:
 * `ward-priority.ts` renders the same fact on the coordinator's priority queue and shortlist panel.
 * This screen is where it was missing. **A function with no caller is not the same as a capability
 * nobody has** — the first is measurable from the import graph, the second is not, and reporting
 * one as the other is the error this file's own change was nearly built on.
 *
 * ⚠️ **NO FIGURE HERE IS AUTHORED BY THE TEST.** Every deadline comes from the fixture, and by the
 * owner's 2026-08-23 correction only the transport/transfer forms carry one at all — a Form 1A or
 * 3B has none, and `tests/ward-legal-figure-guard.test.ts` exists because three separate agents
 * previously invented statutory durations that reached the screen.
 */

function renderAt(now: number) {
  return renderAllDelays(
    <WardFlowProvider initialNow={now}>
      <DelaysScreen />
    </WardFlowProvider>,
  );
}

/**
 * 🔴 **`initialNow` CANNOT CROSS A DEADLINE, AND THE FIRST VERSION OF THIS FILE ASSUMED IT COULD.**
 *
 * A pinned `initialNow` sets `anchorOffsetMinutes` and the provider **re-seeds the whole world at
 * that offset** (`seedWardFlowStateAt`), so every `dueAt` moves with the clock and a deadline 90
 * minutes away stays 90 minutes away however far the pin is pushed. **The test failed with the text
 * simply absent, which reads as the feature being broken rather than the harness being wrong.**
 *
 * `ADVANCE_CLOCK` adds `state.clockOffsetMinutes` on top of the seed instead, moving `now` WITHOUT
 * moving the world — which is why `ward-console-controls.dom.test.tsx` records it as the mechanism
 * the live review used to cross a statutory deadline. Test-only scaffold, not a new surface.
 */
function AdvanceClock({ minutes }: { minutes: number }) {
  const { dispatch, now } = useWardFlow();
  return (
    <button
      type="button"
      data-testid="test-advance-clock"
      onClick={() => dispatch({ type: "ADVANCE_CLOCK", role: "demo", now, minutes })}
    >
      advance clock
    </button>
  );
}

function renderAdvancedBy(minutes: number) {
  renderAllDelays(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <AdvanceClock minutes={minutes} />
      <DelaysScreen />
    </WardFlowProvider>,
  );
  fireEvent.click(screen.getByTestId("test-advance-clock"));
}

/** The fixture's own answer to "who should show a deadline at this instant", derived not typed. */
function expectedToShow(now: number) {
  return wardMovements
    .filter((movement) => isOpen(movement))
    .filter((movement) => {
      const dueAt = movement.legalForm?.dueAt;
      return dueAt !== undefined && clockState(dueAt, now) !== "clear";
    });
}

describe("the delays screen states the legal deadline it is already reacting to", () => {
  it("fixture sanity: the seed actually carries a deadline in range, or every assertion below is vacuous", () => {
    /*
     * ⚠️ The anti-vacuity check, and it is not decoration. `delayGroups` only returns a legal cause
     * for a BREACHED or CRITICAL deadline, and no seeded `dueAt` is either at `NOW_ANCHOR` — so a
     * test that waited for the legal GROUP to appear would render nothing and pass. This screen
     * shows the figure from "due" (inside three hours) onward, mirroring `ward-priority`, which is
     * why the seed exercises it at all.
     */
    const showing = expectedToShow(NOW_ANCHOR);
    expect(showing.length, "no open movement carries a non-clear deadline at NOW_ANCHOR").toBeGreaterThan(0);
    for (const movement of showing) {
      expect(movement.legalForm?.code, `${movement.id} carries a deadline with no form code`).toBeDefined();
    }
  });

  it("names the form and the minutes remaining, for every movement whose deadline is in range", () => {
    /*
     * ⚠️ **RE-POINTED 2026-09-07.** The delays screen no longer renders every patient's full state
     * chips at once — only the SELECTED one's, inside the panel named "The person you have chosen".
     * Selecting one patient at a time is required before its legal-deadline sentence exists in the
     * document at all; the property being walked — "for every movement whose deadline is in range"
     * — is unchanged, it is just proved one selection at a time now instead of one page-wide scan.
     */
    renderAt(NOW_ANCHOR);
    for (const movement of expectedToShow(NOW_ANCHOR)) {
      inspectDelayPerson(movement.id);
      const minutes = legalDeadlineMinutes(movement, NOW_ANCHOR);
      expect(minutes, `${movement.id} lost its deadline between the filter and the assertion`).toBeDefined();
      const form = movement.legalForm;
      expect(form, `${movement.id} lost its form between the filter and the assertion`).toBeDefined();
      expect(
        screen.getAllByText(`${legalFormName(form!)} due in ${splitDuration(minutes!)}`).length,
        `${movement.id}: the delays row does not state its legal deadline`,
      ).toBeGreaterThan(0);
    }
  });

  it("says a passed deadline has passed, rather than counting down from a negative", () => {
    /*
     * The breached wording is `ward-priority`'s, not a second one invented here. A negative rendered
     * raw — "due in -10 min" — is the shape this branch exists to prevent, and it is exactly what a
     * screen shows when somebody formats a countdown without asking what happens after zero.
     */
    const wf006 = wardMovements.find((movement) => movement.id === "WF-006");
    const dueAt = wf006?.legalForm?.dueAt;
    expect(dueAt, "WF-006 no longer carries the deadline this case is built on").toBeDefined();
    // Ten minutes past WF-006's own deadline, derived from the fixture rather than typed.
    renderAdvancedBy((dueAt as number) - NOW_ANCHOR + 10);
    // The state chip carrying this sentence only exists for the SELECTED patient now (see the
    // "RE-POINTED" note above), so WF-006 must be chosen before its wording can be read at all.
    inspectDelayPerson("WF-006");
    expect(
      screen.getAllByText(`${legalFormName(wf006!.legalForm!)} passed its deadline ${splitDuration(10)} ago`).length,
    ).toBeGreaterThan(0);
    expect(screen.queryByText(/due in -\d+ min/), "a passed deadline is counting down past zero").toBeNull();
  });

  it("names the form from the OFFICIAL REGISTER, never the bare code the register falls back to", () => {
    /*
     * 🔴 **THE FIRST VERSION OF THIS SCREEN RENDERED `Form ${code}`, MIRRORED FROM `ward-priority`.**
     *
     * That is `legalFormName`'s FALLBACK — what it returns only when the register does not list the
     * code — so emitting it unconditionally makes a listed form indistinguishable from an unlisted
     * one and silently drops a title the register holds. The product owner approved adopting the
     * official titles on 2026-08-24 **after being shown that this prototype's own labels had drifted
     * from them**, which is why the register is the authority and a neighbouring surface is not.
     *
     * ⚠️ Pinned as the TITLE APPEARING, not as an exact sentence: the guard is that the register was
     * consulted at all. A reworded countdown stays green; a return to the bare code does not.
     */
    renderAt(NOW_ANCHOR);
    const titled = expectedToShow(NOW_ANCHOR).filter(
      (movement) => legalFormName(movement.legalForm!) !== `Form ${movement.legalForm!.code}`,
    );
    expect(
      titled.length,
      "no in-range movement carries a form the register titles — this case proves nothing",
    ).toBeGreaterThan(0);
    // Select each one in turn — see the "RE-POINTED" note above: the state chip carrying the form's
    // name only exists for whoever is currently selected.
    for (const movement of titled) {
      inspectDelayPerson(movement.id);
      const withTitle = legalFormName(movement.legalForm!);
      expect(
        // A substring matcher, not a built RegExp: the title contains "(" and ")", and escaping a
        // dynamic string into a pattern is how the first attempt produced an unparseable file.
        screen.getAllByText((content) => content.includes(withTitle)).length,
        `${movement.id}: the row names the form without its register title (${withTitle})`,
      ).toBeGreaterThan(0);
    }
  });

  it("says nothing at all for a movement whose form carries no deadline", () => {
    /*
     * 🔴 `LegalForm`'s own rule: an absent `dueAt` must NEVER read as "clear" or "not yet due", and
     * no fallback number may be substituted. **Saying nothing is how that is obeyed here** — a row
     * with no legal state claims nothing, whereas a rendered "—" or a zero would be a statement
     * about a statutory position this prototype has no figure for.
     */
    renderAt(NOW_ANCHOR);
    /*
     * ⚠️ **`isOpen` ADDED 2026-09-07, AND WITHOUT IT THIS CASE WOULD HAVE GONE QUIETLY VACUOUS.**
     * The compact index only offers a `delays-select-*` button for OPEN movements (`delayGroups`
     * filters to `isOpen` before classifying anyone), so a closed movement in this list could never
     * be selected and this loop would throw on `getByTestId` rather than assert anything. Verified
     * against the fixture: every `legalForm` with no `dueAt` today belongs to an open movement, so
     * this filter narrows nothing the case currently exercises — it only guards against a future
     * fixture change silently emptying the loop's body instead of reddening it.
     */
    const withoutDeadline = wardMovements.filter(
      (movement) => isOpen(movement) && movement.legalForm !== undefined && movement.legalForm.dueAt === undefined,
    );
    expect(withoutDeadline.length, "the fixture no longer has a deadline-free form to test").toBeGreaterThan(0);
    // Select each one in turn — see the "RE-POINTED" note above. Without selecting, nothing about
    // ANY movement's legal state renders at all, which would make this absence check vacuous rather
    // than a genuine proof that the sentence is withheld for this specific patient.
    for (const movement of withoutDeadline) {
      inspectDelayPerson(movement.id);
      const form = movement.legalForm;
      expect(
        screen.queryByText(new RegExp(`${legalFormName(form!)} (due in|passed its deadline)`)),
        `${movement.id} carries no dueAt, so no deadline may be stated for its form`,
      ).toBeNull();
    }
  });
});
