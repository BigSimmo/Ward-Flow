"use client";

/**
 * THE SCOPE BAR — the one control a scoped screen mounts to say, in the exact words build plan
 * `docs/ward-flow/plans/2026-09-17-build-plan-screens.md` §3 "Scope bar" fixes, that its list has
 * been narrowed to one health service, plus what that narrowing left out. Task S2 builds this
 * component and wires nothing to it yet — "Don't scope any screen yet... you only provide the
 * store, the wired chooser and the scope bar component" (S2's own brief). Lanes B–H (Command,
 * Capacity, Delays, Movements, Referrals, ...) each mount it later against their own `shown`/
 * `total`/`noun`, after `S2` releases the `ward-bar.tsx` token.
 *
 * **"Show all services" lives HERE, not in each caller.** Every scoped screen's clear button does
 * the identical thing — clear `ward-service-store.ts`'s choice and announce "Service set to all."
 * (§3 "Choosing: unchanged") — so this component owns that behaviour outright rather than handing
 * a caller a callback to reimplement seven times, one per screen lane, with seven chances to get
 * the announcement wording or the clearing call slightly wrong.
 *
 * **Every sentence below is optional independently, and absence is not the same as zero:**
 * - `noRecordedServiceCount` omitted → the "no recorded service" sentence does not render at all,
 *   for a population `ward-service-scope.ts` can always resolve fully (there is none today, but a
 *   future population might prove that rather than assume it). Passed as `0` → the sentence DOES
 *   render, "0 with no recorded service are included" — a screen that checked and found none, on
 *   the record, not a screen that never checked.
 * - `urgentOutside` omitted → S2's own "never hidden" sentence (§2's OTHER "S2": "every scoped
 *   movement list states the urgent movements outside the service") does not render — for a list
 *   that is not a movement list at all (Referrals, Capacity's ward table, ...), where there is no
 *   such figure to report. Passed with `count: 0` → the zero-case sentence below renders, never
 *   blank.
 *
 * ⚠️ **D-a (Ward Lead's decisions, 2026-09-17): BOTH `urgentOutside` SENTENCES NOW STATE THE
 * DEFINITION, NOT JUST THE WORD "urgent".** An Opus adversarial review (R1) found that the old
 * wording — "a legal deadline has passed or the patient is flagged urgent" — undersold what
 * `count` actually measures once `ward-service-scope.ts`'s own `movementIsUrgentForServiceSafety`
 * feeds it: a legal deadline RUNNING OUT (not only passed), no suitable bed anywhere, or an
 * escalation, count too. The zero-case sentence is Ward Lead's own exact wording; the non-zero
 * sentence states the identical list of conditions so the two can never describe the count
 * differently depending on whether it is nought.
 */
import { type HealthService } from "@/components/ward-management/ward-model";
import { announceToWardShell } from "./ward-live-region";
import { setServiceScope } from "./ward-service-store";
import styles from "./ward-service-scope-bar.module.css";

export type WardServiceScopeBarProps = {
  /** The chosen service this bar is reporting against. The bar itself decides nothing about
   *  whether a service is chosen — a caller only mounts this while `useServiceScope()` is
   *  non-null, per this file's own header ("only while a service is chosen"). */
  service: HealthService;
  /** How many of `total` remain once narrowed to `service`. */
  shown: number;
  /** The population's whole size before narrowing. */
  total: number;
  /** The plural noun naming what is counted — "movements", "referrals", "wards", ... */
  noun: string;
  noRecordedServiceCount?: number;
  urgentOutside?: { count: number };
};

export function WardServiceScopeBar({
  service,
  shown,
  total,
  noun,
  noRecordedServiceCount,
  urgentOutside,
}: WardServiceScopeBarProps) {
  return (
    <div className={styles.bar} role="group" aria-label="Service scope" data-testid="ward-service-scope-bar">
      <p className={styles.line} data-testid="ward-service-scope-bar-summary">
        {`Showing ${shown} of ${total} ${noun}, in ${service}.`}
        <button
          type="button"
          className={styles.clear}
          data-testid="ward-service-scope-bar-clear"
          onClick={() => {
            setServiceScope(null);
            announceToWardShell("Service set to all.");
          }}
        >
          Show all services
        </button>
      </p>
      {noRecordedServiceCount === undefined ? null : (
        <p className={styles.note} data-testid="ward-service-scope-bar-unresolved">
          {`${noRecordedServiceCount} with no recorded service ${noRecordedServiceCount === 1 ? "is" : "are"} included.`}
        </p>
      )}
      {urgentOutside === undefined ? null : (
        <p className={styles.note} data-testid="ward-service-scope-bar-urgent">
          {urgentOutside.count === 0
            ? `Nothing flagged urgent, a legal form running out, without a bed anywhere, waited past the access target, or escalated is outside ${service}.`
            : `${urgentOutside.count} ${urgentOutside.count === 1 ? "movement" : "movements"} outside ${service}: flagged urgent, a legal form running out, without a bed anywhere, waited past the access target, or escalated.`}
        </p>
      )}
    </div>
  );
}
