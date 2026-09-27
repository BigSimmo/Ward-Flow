"use client";

import { ArrowLeftRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { ignoreUnavailableActivation } from "@/components/ui-primitives";
import { wardChromeRole } from "@/components/ward-management/ward-chrome-role";
import { useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { edById } from "@/components/ward-management/ward-sites";

import styles from "./ward-role-switcher.module.css";

const COORDINATOR_HREF = "/mockups/ward-flow";
const OFFICER_HREF = "/mockups/ward-flow/transport/officer";

/**
 * Task 12 (addendum R41/R42/R48/R52/R67). The role switcher: four roles, one control, and the
 * one piece of navigation the whole eleven-step journey (spec §14) relies on to prove the loop
 * survives a role change without a `page.goto()` resetting the world underneath it. Every
 * destination below is a real `<Link>`, never a `router.push` from a click handler that only
 * happens to look like navigation, so the routes stay reachable the same way the rest of this
 * phase's rail links do.
 *
 * **The coordinator has no place.** Spec §9 and the addendum both say this explicitly: the
 * coordinator is statewide, so this control shows that as a real fact ("Statewide — no ward or
 * department") rather than inventing a location for it the way a naive "current role's screen"
 * design would.
 *
 * **Ward and Emergency department are inferred from the shared `focusMovementId`** — the patient
 * last selected on the coordinator screen (`coordinator-screen.tsx`'s `selectMovement`, mirrored
 * into `WardFlowProvider` so it survives the screen unmounting on a role switch). Addendum R52:
 * where that movement implies exactly one destination, it is a direct link; where it implies
 * several — a live parallel referral, up to `PARALLEL_REFERRAL_CAP` units at once — every
 * candidate is offered rather than any one silently chosen. That is the same conservative-failure
 * discipline `shortlist-panel.tsx`'s `canRefer` and `ward-screen.tsx`'s blocked-reason helpers
 * already hold to, applied to navigation instead of a dispatch: this is a `?? array[0]` in
 * interaction form the moment it picks for you, and the addendum forbids exactly that. Where no
 * destination is implied at all (no patient selected yet), the control names that reason rather
 * than guessing — `aria-disabled` plus `title` plus an `ignoreUnavailableActivation` handler,
 * the same pattern `ed-screen.tsx`'s `examinationBlockedReason`/`handoverBlockedReason` and
 * every other conditionally-available control in this phase already use.
 *
 * ⚠️ **EVERY DESTINATION BELOW IS THAT ROLE'S OWN HOME, NEVER THE REFERRAL YOU WERE JUST LOOKING
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
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  // Owner answer 38 (17 Sept 2026): other wards in the switcher are coordinators-only. `?? ""` is
  // the same fallback `ward-chrome-header.tsx`/`ward-standing-strip.tsx`/`ward-chrome-search.tsx`
  // already use — `wardChromeRole("")` reads as "coordinator", the widest default, rather than
  // throwing or silently narrowing when no App Router pathname context is mounted (a bare render in
  // a test, for instance).
  const pathname = usePathname() ?? "";
  const isCoordinatorRoute = wardChromeRole(pathname) === "coordinator";

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // The provider's own live `movements`, never a frozen fixture lookup — a movement referred or
  // accepted moments ago on the coordinator screen must resolve here too, on the very next
  // render, exactly like `coordinator-screen.tsx`'s own `selectedMovement` derivation.
  const focusMovement = focusMovementId ? movements.find((movement) => movement.id === focusMovementId) : undefined;

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
   * project. The menu's own "No ward implied" empty state is untouched and still does its job.
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
   * `data-referred-ward-count` — and the Ward group in the menu says "Open the coordinator view to
   * see which wards this patient was referred to." instead of naming any of them. On the coordinator
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

  const menuRef = useRef<HTMLDivElement>(null);
  // ED is never ambiguous — a movement carries exactly one `originEdId` — so this is always a
  // direct link once a patient is selected, never a picker.
  const edCandidate = focusMovement ? edById(focusMovement.originEdId) : undefined;

  const isCoordinatorActive = pathname === COORDINATOR_HREF || pathname === `${COORDINATOR_HREF}/`;
  const isOfficerActive = pathname === OFFICER_HREF || pathname.startsWith("/mockups/ward-flow/transport/officer");
  const isWardActive = (unitId: string) => pathname === `/mockups/ward-flow/ward/${unitId}`;
  const isEdActive = Boolean(edCandidate && pathname === `/mockups/ward-flow/ed/${edCandidate.id}`);

  function getFocusableMenuItems(): HTMLElement[] {
    if (!menuRef.current) return [];
    const elements = menuRef.current.querySelectorAll<HTMLElement>(
      'a[role="menuitem"], button[role="menuitem"]:not([aria-disabled="true"])',
    );
    return Array.from(elements);
  }

  function handleMenuKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      const items = getFocusableMenuItems();
      if (items.length === 0) return;
      const currentIndex = items.indexOf(document.activeElement as HTMLElement);
      const nextIndex = currentIndex >= 0 && currentIndex < items.length - 1 ? currentIndex + 1 : 0;
      items[nextIndex]?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      const items = getFocusableMenuItems();
      if (items.length === 0) return;
      const currentIndex = items.indexOf(document.activeElement as HTMLElement);
      const prevIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
      items[prevIndex]?.focus();
    } else if (event.key === "Home") {
      event.preventDefault();
      const items = getFocusableMenuItems();
      items[0]?.focus();
    } else if (event.key === "End") {
      event.preventDefault();
      const items = getFocusableMenuItems();
      items[items.length - 1]?.focus();
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  }

  function handleTriggerKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown") {
      if (!open) {
        event.preventDefault();
        setOpen(true);
        setTimeout(() => {
          const items = getFocusableMenuItems();
          items[0]?.focus();
        }, 0);
      }
    } else if (event.key === "ArrowUp") {
      if (!open) {
        event.preventDefault();
        setOpen(true);
        setTimeout(() => {
          const items = getFocusableMenuItems();
          items[items.length - 1]?.focus();
        }, 0);
      }
    }
  }

  function close() {
    setOpen(false);
  }

  return (
    <div className={styles.switcher} ref={containerRef}>
      <button
        type="button"
        ref={triggerRef}
        className={styles.trigger}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="ward-role-switcher-menu"
        aria-label={switcherLabel}
        title={switcherLabel}
        // Off the coordinator route the attribute is absent, not zero — owner answer 38 draws a
        // hard line ("coordinators only"), and a present-but-zero attribute would still be a signal
        // that something was being counted for this viewer.
        {...(isCoordinatorRoute ? { "data-referred-ward-count": referredWardCount } : {})}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={handleTriggerKeyDown}
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
      {open ? (
        <div
          id="ward-role-switcher-menu"
          ref={menuRef}
          className={styles.menu}
          role="menu"
          aria-label="Change view"
          onKeyDown={handleMenuKeyDown}
        >
          <Link
            href={COORDINATOR_HREF}
            role="menuitem"
            className={styles.menuItem}
            data-active={isCoordinatorActive ? "true" : undefined}
            aria-current={isCoordinatorActive ? "page" : undefined}
            onClick={close}
          >
            <div className={styles.menuItemHeader}>
              <span className={styles.menuItemLabel}>Coordinator</span>
              {isCoordinatorActive ? (
                <span className={styles.activeIndicator} aria-hidden="true">
                  Active
                </span>
              ) : null}
            </div>
            <span className={styles.menuItemDetail}>Statewide — no ward or department</span>
          </Link>

          <div className={styles.menuGroup} role="group" aria-label="Ward">
            <span className={styles.menuGroupLabel}>Ward</span>
            {!isCoordinatorRoute ? (
              // Owner answer 38: off the coordinator route, no ward name is named here — not the
              // patient's accepted ward, not any of several live referrals. The sentence points at
              // where that information does live rather than narrowing silently to zero, the same
              // "say what is missing, don't just go quiet" discipline the disabled menu items below
              // already use for "no ward implied".
              <p className={styles.menuItemDetail}>
                Open the coordinator view to see which wards this patient was referred to.
              </p>
            ) : wardCandidates.length > 0 ? (
              wardCandidates.map((unit) => {
                const isActive = isWardActive(unit.id);
                return (
                  <Link
                    key={unit.id}
                    href={`/mockups/ward-flow/ward/${unit.id}`}
                    role="menuitem"
                    className={styles.menuItem}
                    data-active={isActive ? "true" : undefined}
                    aria-current={isActive ? "page" : undefined}
                    onClick={close}
                  >
                    <div className={styles.menuItemHeader}>
                      <span className={styles.menuItemLabel}>{unit.name}</span>
                      {isActive ? (
                        <span className={styles.activeIndicator} aria-hidden="true">
                          Active
                        </span>
                      ) : null}
                    </div>
                  </Link>
                );
              })
            ) : (
              <button
                type="button"
                role="menuitem"
                aria-disabled="true"
                aria-describedby="ward-role-switcher-ward-unavailable"
                title="Select a patient on the coordinator screen to see their ward."
                className={styles.menuItemDisabled}
                onClick={ignoreUnavailableActivation}
              >
                <span className={styles.menuItemLabel}>No ward implied</span>
              </button>
            )}
          </div>

          <Link
            href={OFFICER_HREF}
            role="menuitem"
            className={styles.menuItem}
            data-active={isOfficerActive ? "true" : undefined}
            aria-current={isOfficerActive ? "page" : undefined}
            onClick={close}
          >
            <div className={styles.menuItemHeader}>
              <span className={styles.menuItemLabel}>Officer</span>
              {isOfficerActive ? (
                <span className={styles.activeIndicator} aria-hidden="true">
                  Active
                </span>
              ) : null}
            </div>
            <span className={styles.menuItemDetail}>Every transport job, statewide</span>
          </Link>

          <div className={styles.menuGroup} role="group" aria-label="Emergency department">
            <span className={styles.menuGroupLabel}>Emergency department</span>
            {edCandidate ? (
              <Link
                href={`/mockups/ward-flow/ed/${edCandidate.id}`}
                role="menuitem"
                className={styles.menuItem}
                data-active={isEdActive ? "true" : undefined}
                aria-current={isEdActive ? "page" : undefined}
                onClick={close}
              >
                <div className={styles.menuItemHeader}>
                  <span className={styles.menuItemLabel}>{edCandidate.name}</span>
                  {isEdActive ? (
                    <span className={styles.activeIndicator} aria-hidden="true">
                      Active
                    </span>
                  ) : null}
                </div>
              </Link>
            ) : (
              <button
                type="button"
                role="menuitem"
                aria-disabled="true"
                aria-describedby="ward-role-switcher-ed-unavailable"
                title="Select a patient on the coordinator screen to see their department."
                className={styles.menuItemDisabled}
                onClick={ignoreUnavailableActivation}
              >
                <span className={styles.menuItemLabel}>No department implied</span>
              </button>
            )}
          </div>

          {isCoordinatorRoute && wardCandidates.length === 0 ? (
            <span id="ward-role-switcher-ward-unavailable" className="sr-only">
              Select a patient on the coordinator screen to see their ward.
            </span>
          ) : null}
          {!edCandidate ? (
            <span id="ward-role-switcher-ed-unavailable" className="sr-only">
              Select a patient on the coordinator screen to see their department.
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
