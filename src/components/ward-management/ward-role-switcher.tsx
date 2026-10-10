"use client";

import { ArrowLeftRight } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { OperatorSwitcherModal } from "@/components/ward-management/settings/operator-switcher-modal";
import { wardChromeRole } from "@/components/ward-management/ward-chrome-role";
import { isOpen as isOpenMovement } from "@/components/ward-management/ward-derivations";
import { useWardFlow } from "@/components/ward-management/ward-flow-provider";

import styles from "./ward-role-switcher.module.css";

/**
 * "Change view": the rail's and Tools drawer's trigger for the Switch workstation drawer
 * (`settings/operator-switcher-modal.tsx`, direction D, 9 October 2026). It used to open its own
 * four-item menu; it now opens the same drawer Settings does, so there is one workstation picker.
 * Every destination in that drawer is a real `<Link>` or a router push to a role's home, so the
 * proof journey (spec section 14) still changes role without a `page.goto()` resetting the world.
 *
 * The coordinator has no place: the drawer shows it as a statewide desk, never a location. The
 * focused patient's wards and department come from the shared `focusMovementId`, and the wards are
 * named to coordinators only (owner answer 38), both here on the trigger and inside the drawer.
 *
 * ⚠️ **EVERY DESTINATION IN THAT DRAWER IS THAT ROLE'S OWN HOME, NEVER THE REFERRAL YOU WERE JUST LOOKING
 * AT — AND THAT IS FORCED, NOT A SIMPLIFICATION.** Ward Flow navigation-shell plan
 * (`docs/superpowers/plans/2026-09-04-ward-flow-navigation-shell.md`, Decision 2). `ward-referral-
 * visibility.ts` (FD-23) states this as an ARCHITECTURE, not a rule a component could relax: the
 * two projections are two TYPES, `WardScopedReferral` has no `destinations` field at all, nothing
 * converts one into the other, and no function there takes a role, a scope or a viewer argument.
 * "Keep the coordinator on this referral, only showing less of it, once they switch to Ward" would
 * need either a converter (does not exist, by design) or a viewer flag (forbidden, by name, in
 * that module's own doc comment — "a flag is a thing that can be passed the other way"). A
 * coordinator's view of a referral and a ward's are different SHAPES, not the same shape with
 * fields hidden, so there is no projection this control could hand a ward screen that would let it
 * land on "the same referral, ward-scoped" instead of its own home.
 *
 * If "switching role loses my place" is ever filed as a bug against this file, the fix is not
 * here: it is a product decision about whether FD-23 itself should be relaxed, made in
 * `ward-referral-visibility.ts` and proved by widening its own allowlisted field sets — never by
 * threading a role/scope/viewer parameter through this component to reach across the boundary.
 * `tests/ward-role-switch-architecture.test.ts` pins the architectural facts above so that a
 * change attempting the shortcut fails a test instead of quietly reopening the leak.
 */
export function WardRoleSwitcher() {
  const { movements, units, focusMovementId } = useWardFlow();
  const [open, setOpen] = useState(false);
  // Owner answer 38 (17 Sept 2026): other wards in the switcher are coordinators-only. `?? ""` is
  // the same fallback `ward-chrome-header.tsx`/`ward-standing-strip.tsx`/`ward-chrome-search.tsx`
  // already use — `wardChromeRole("")` reads as "coordinator", the widest default, rather than
  // throwing or silently narrowing when no App Router pathname context is mounted (a bare render in
  // a test, for instance).
  const pathname = usePathname() ?? "";
  const isCoordinatorRoute = wardChromeRole(pathname) === "coordinator";

  // The provider's own live `movements`, never a frozen fixture lookup — a movement referred or
  // accepted moments ago on the coordinator screen must resolve here too, on the very next
  // render, exactly like `coordinator-screen.tsx`'s own `selectedMovement` derivation.
  // Open movements only, as the drawer's Patient in focus row does, so the count never names wards
  // the drawer will not show.
  const focusMovement = focusMovementId
    ? movements.find((movement) => movement.id === focusMovementId && isOpenMovement(movement))
    : undefined;

  // Ward candidates: an accepted destination is the definitive single answer (ACCEPT_IN_PRINCIPLE's
  // own reducer case empties `referredUnitIds` the moment one unit accepts — see
  // `ward-flow-reducer.ts`'s `case "ACCEPT_IN_PRINCIPLE"`), so it is checked first. Short of
  // that, every currently live referral is a candidate destination — never just the first one.
  const wardCandidateIds = focusMovement
    ? focusMovement.acceptedUnitId
      ? [focusMovement.acceptedUnitId]
      : focusMovement.referredUnitIds
    : [];
  // Whole-branch review Critical 1: resolved from the live `units`. Names/ids cannot go stale in
  // this prototype (no event ever renames a unit), so this specific read was never a capacity
  // hazard the way `ward-screen.tsx`'s `unitById` was — but `units` was already free to read
  // here via `useWardFlow()`, so converting it costs nothing and keeps this file off the units
  // guard's allow-list entirely rather than needing a documented identity-only exception.
  const wardCandidates = wardCandidateIds
    .map((unitId) => units.find((unit) => unit.id === unitId))
    .filter((unit): unit is NonNullable<typeof unit> => unit !== undefined);

  /*
   * ⚠️ THE TRIGGER SAYS WHAT IS BEHIND IT, BUT ONLY WHEN SOMETHING IS. Owner ruling 2026-09-03,
   * "resolve this" — the route from a referral to the receiving ward existed and was unfindable.
   *
   * The label used to describe the CONTROL rather than what is currently in it, so a coordinator
   * who had just referred a patient to two wards had no way to know those two wards were behind it.
   * ⚠️ It was never an accessibility gap — `aria-label` and `title` were both already present —
   * which is why the fix is different from the one that shape of defect usually gets.
   *
   * ⚠️ AND THE TRIGGER IS ALWAYS RENDERED AND ALWAYS THE SAME SIZE. Only the words and the count
   * change. A control that appears only when it has something to offer reads, at every other
   * moment, as a control that is simply missing — which is exactly what the shortlist taught this
   * project.
   *
   * ⚠️ **"CHANGE VIEW", NOT "SWITCH ROLE" — OWNER RULING, 2026-09-03. NO LONGER A PLACEHOLDER.**
   * Two alternatives were put to him and both were rejected, for reasons worth keeping because they
   * are reasons about clinical safety rather than about wording:
   *
   *   · *Name the current role on every screen* — rejected because it would assert "Coordinator" on
   *     28 screens that have no role at all. A control that states a clinical role the user may not
   *     hold is worse than one that states nothing.
   *   · *Name the role only on the four screens that have one* — rejected here rather than by him,
   *     for a reason worth keeping even though the next paragraph now qualifies it: **at the time,
   *     this component had no idea which screen it was on.** It took no route prop and called no
   *     `usePathname`. Telling would have meant giving it a new input, which was not the "costs
   *     nothing" the ruling allowed for — and a label carrying a role on four screens and not on
   *     twenty-eight is a button that changes shape as you move.
   *
   * So "Change view" everywhere, unconditionally. It is true on all 32 screens, and it describes
   * what the control does rather than what the person using it is. **This part of the 2026-09-03
   * ruling is untouched by everything below.**
   *
   * ⚠️ **THE REFERRED-WARD SIGNPOST IS NOW COORDINATORS-ONLY — OWNER ANSWER 38, 17 SEPTEMBER 2026,
   * SUPERSEDING THE 3 SEPTEMBER "RESOLVE THIS" RULING'S REACH ACROSS EVERY ROUTE.** That earlier
   * ruling was right that the trigger must say what is behind it rather than only that it changes
   * the view — but it never asked "behind it, to whom?", and answered as though every route ought
   * to see the same thing. `docs/ward-flow/owner-answers-2026-09-17.md` item 38: *"Other wards in
   * the ward switcher: coordinators only."* A ward's own nurse-in-charge screen, or an ED clinician's,
   * has no legitimate reason to be told which OTHER wards a patient was referred to — that is
   * coordinator-only traffic, the same way the coordinator's own inbox is. So this component now
   * DOES take a route input, the same way every other route-aware piece of Ward Flow chrome already
   * does (`ward-chrome-header.tsx`, `ward-standing-strip.tsx`, `ward-chrome-search.tsx`): it reads
   * `usePathname()` and asks `wardChromeRole()` whether the route is the coordinator's. Giving it
   * that input was ruled out in 2026-09-03 only because nothing yet needed it; item 38 is that need.
   *
   * Off the coordinator route, the trigger reverts to plain "Change view" — no count, no
   * `data-referred-ward-count` — and the drawer's Patient in focus row names no ward. On the coordinator
   * route, nothing changes: the count and the named links from the 2026-09-03 ruling survive exactly
   * as they were. `tests/ward-role-switcher-signpost.dom.test.tsx` was rewritten to pin this route
   * split rather than the every-route behaviour it used to pin.
   */
  // Coordinators-only (owner answer 38): off the coordinator route the count is not merely hidden
  // from the label, it is zero here — nothing downstream (the trigger, the badge, the
  // `data-referred-ward-count` attribute) can leak it back in by reading `wardCandidates` directly.
  const referredWardCount = isCoordinatorRoute ? wardCandidates.length : 0;
  const switcherLabel =
    referredWardCount > 0
      ? `Change view — ${referredWardCount} ${referredWardCount === 1 ? "ward" : "wards"} this patient was referred to`
      : "Change view";

  return (
    <div className={styles.switcher}>
      <button
        type="button"
        className={styles.trigger}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={switcherLabel}
        title={switcherLabel}
        // Off the coordinator route the attribute is absent, not zero — owner answer 38 draws a
        // hard line ("coordinators only"), and a present-but-zero attribute would still be a signal
        // that something was being counted for this viewer.
        {...(isCoordinatorRoute ? { "data-referred-ward-count": referredWardCount } : {})}
        onClick={() => setOpen(true)}
      >
        <ArrowLeftRight aria-hidden="true" />
        {referredWardCount > 0 ? (
          /* aria-hidden: the accessible name above already carries this count in words. Announcing
             the bare digit as well would read the same fact twice, in the worse of the two forms. */
          <span className={styles.triggerCount} aria-hidden="true" data-testid="ward-role-switcher-ward-count">
            {referredWardCount}
          </span>
        ) : null}
      </button>
      {open ? <OperatorSwitcherModal isOpen onClose={() => setOpen(false)} /> : null}
    </div>
  );
}
