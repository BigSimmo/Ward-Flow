"use client";

import { useId, useRef, useState } from "react";
import { Search } from "lucide-react";
import { Button, StatusGlyph } from "@/components/wf";
import type { Instant } from "@/components/ward-management/ward-clock";
import { candidateReason, referralEligibility } from "@/components/ward-management/ward-eligibility";
import { useOptionalWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { wardRaise } from "@/components/ward-management/ward-flow-raise";
import {
  type Referral,
  type ReferralAddressing,
  type ReferralDestination,
  type Rejection,
  type Unit,
} from "@/components/ward-management/ward-model";
import { isAwaitingAnswer, referralWithdrawn } from "@/components/ward-management/ward-referrals";
import type { WardCommandDispatch } from "@/components/ward-management/ward-shared-client";
import { siteByCode } from "@/components/ward-management/ward-sites";
import { useWardFormSave } from "@/components/ward-management/use-ward-form-save";
import { useHoldOpenForm } from "@/components/ward-management/use-hold-open-form";
import { referralClosedForFollowUp } from "./referral-owner-and-calls-model";
import ph from "./referral-match-phone.module.css";
import styles from "./referral-ask-more-wards.module.css";

/**
 * Fix plan item 16 (D-76, mock-up version 2 locked in by Josh on 22 Oct 2026): the coordinator asks
 * more wards about an open community referral from the decision pane. The card lists every ward
 * asked and its answer, how many are waiting out of the cap, and one control. The list it opens is
 * A to Z and never ranked (D-71); only a ward that fits can be ticked. While it is open the pane's
 * footer shows Cancel and Ask instead of Decline and Accept, so there is only one set of actions.
 */

type WardArm = ReferralAddressing & { destination: Extract<ReferralDestination, { kind: "psychiatric_ward" }> };

export type AskMoreWards = ReturnType<typeof useAskMoreWards>;

export function useAskMoreWards({
  referral,
  units,
  now,
  dispatch,
  rejections,
}: {
  referral: Referral;
  units: Unit[];
  now: Instant;
  dispatch: WardCommandDispatch;
  rejections: Rejection[];
}) {
  const configuration = useOptionalWardFlowSelect("configuration")?.configuration;
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [showReview, setShowReview] = useState(false);
  const [attemptedAt, setAttemptedAt] = useState<number | null>(null);
  // Audit 24-3 SV-3: the list and its ticks stay until the ask is accepted, with the reason if not.
  const save = useWardFormSave(referral.id);
  // Audit CS3-01: the open ward list is checked against the board it opened on, so another desk's
  // answer meanwhile is reported, not asked over. Not scoped to the card: its Ask button can sit in
  // a footer outside it.
  useHoldOpenForm(open);

  const wardArms = referral.destinations.filter(
    (addressing): addressing is WardArm => addressing.destination.kind === "psychiatric_ward",
  );
  const template = wardArms[0]?.destination;
  // The cap is the network's own setting, so outside a provider (some screen tests) there is no card.
  const cap = configuration?.parallelReferralCap ?? 0;
  // The engine's own preconditions, so the card never offers what ASK_MORE_WARDS would refuse.
  const applies =
    configuration !== undefined &&
    referral.source === "community" &&
    template !== undefined &&
    wardArms.every((addressing) => addressing.destination.unitId !== undefined) &&
    referralClosedForFollowUp(referral) === undefined &&
    !referralWithdrawn(referral);
  const waiting = wardArms.filter((addressing) => isAwaitingAnswer(addressing)).length;
  const slots = Math.max(0, cap - waiting);

  const askedIds = new Set(wardArms.map((addressing) => addressing.destination.unitId));
  const unitsByWardId = new Map(units.map((unit) => [unit.id, unit]));
  const asked = wardArms.map((addressing) => ({
    addressing,
    unit: unitsByWardId.get(addressing.destination.unitId ?? ""),
  }));

  const others =
    applies && template
      ? units
          .filter((unit) => !askedIds.has(unit.id))
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((unit) => {
            const verdict = referralEligibility(referral, { ...template, unitId: unit.id }, unit, now);
            // The engine refuses a ward closed to admissions, so it is never offered as a fit.
            const fit = verdict.eligible && !unit.isClosed;
            return { unit, fit, reason: unit.isClosed ? "Closed to admissions" : candidateReason(verdict) };
          })
      : [];
  // Ticks come from every fitting ward, so a ward the search hides still counts and is still asked.
  const chosen = picked.filter((id) => others.some((row) => row.fit && row.unit.id === id));
  const q = query.trim().toLowerCase();
  const shown = others.filter((row) => !q || row.unit.name.toLowerCase().includes(q));
  const fits = shown.filter((row) => row.fit);
  const review = shown.filter((row) => !row.fit);

  const rejection =
    attemptedAt === null
      ? undefined
      : rejections
          .slice(attemptedAt)
          .findLast((entry) => entry.attempted === "ASK_MORE_WARDS" && entry.movementId === referral.id);

  // Each opening of the list is its own form: an answer to an ask from an earlier opening, after
  // Cancel, must not close and clear the ticks of the current one.
  const opening = useRef(0);
  function close() {
    opening.current += 1;
    save.clearError();
    setOpen(false);
    setPicked([]);
    setQuery("");
    setShowReview(false);
  }

  return {
    referral,
    applies,
    open,
    cap,
    waiting,
    slots,
    asked,
    fits,
    review,
    chosen,
    query,
    showReview,
    rejection,
    // A refusal this desk already lists as a rejection is said once, by that line.
    failure: rejection ? undefined : save.error,
    pending: save.pending,
    setQuery,
    setShowReview,
    start() {
      setAttemptedAt(null);
      setOpen(true);
    },
    close,
    toggle(unitId: string, on: boolean) {
      setPicked((current) => (on ? [...current, unitId] : current.filter((id) => id !== unitId)));
    },
    ask() {
      if (chosen.length === 0 || chosen.length > slots || save.pending) return;
      setAttemptedAt(rejections.length);
      const asked = opening.current;
      save.submit(
        () => wardRaise(dispatch, "coordinator", now)("ASK_MORE_WARDS", { referralId: referral.id, unitIds: chosen }),
        () => {
          if (opening.current === asked) close();
        },
      );
    },
  };
}

function answerOf(addressing: ReferralAddressing): string {
  if (addressing.withdrawnAt !== undefined) return "Withdrawn";
  if (addressing.state === "accepted") return "Accepted";
  if (addressing.state === "declined") return "Declined";
  if (addressing.state === "cancelled") return "Cancelled";
  return addressing.waitlistedAt !== undefined ? "On waiting list" : "Waiting";
}

const plural = (n: number) => (n === 1 ? "" : "s");

export function AskMoreWardsCard({ ask }: { ask: AskMoreWards }) {
  const baseId = useId();
  if (!ask.applies) return null;
  const full = ask.slots === 0;
  return (
    <section className={styles.card} aria-labelledby={`${baseId}-title`} data-testid="ward-referral-ask-more-wards">
      <div className={styles.head}>
        <h3 id={`${baseId}-title`}>Wards asked</h3>
        <span className={styles.pill} data-full={full ? "true" : undefined} data-testid="ward-referral-ask-waiting">
          {ask.waiting} of {ask.cap} waiting
        </span>
      </div>
      <ul className={styles.asked}>
        {ask.asked.map(({ addressing, unit }) => {
          const site = unit ? siteByCode(unit.siteCode)?.name : undefined;
          return (
            <li key={addressing.destination.unitId}>
              <b>{unit?.name ?? "Ward not in this network"}</b>
              <small>
                {[site, addressing.addedBy ? `asked by ${addressing.addedBy.toLowerCase()}` : undefined]
                  .filter(Boolean)
                  .join(" · ")}
              </small>
              <em>{answerOf(addressing)}</em>
            </li>
          );
        })}
      </ul>
      {ask.rejection ? (
        <p className={styles.hint} role="alert" data-testid="ward-referral-ask-rejection">
          Not asked: {ask.rejection.reason}
        </p>
      ) : null}
      {ask.failure ? (
        <p className={styles.hint} role="alert" data-testid="ward-referral-ask-failure">
          {ask.failure}
        </p>
      ) : null}
      {ask.open ? (
        <div className={styles.list} data-testid="ward-referral-ask-list">
          <label className={styles.search}>
            <Search size={15} aria-hidden="true" />
            <input
              type="search"
              aria-label="Find a ward"
              placeholder="Find a ward"
              value={ask.query}
              onChange={(event) => ask.setQuery(event.target.value)}
            />
          </label>
          {ask.fits.length + ask.review.length === 0 ? (
            <p className={styles.hint}>No ward matches that search.</p>
          ) : null}
          {ask.fits.length > 0 ? (
            <>
              <p className={ph.ch}>
                Fits, bed ready <span className={ph.k}>{ask.fits.length}</span>
              </p>
              <div className={ph.cands} role="group" aria-label="Fits, bed ready">
                {ask.fits.map(({ unit }) => {
                  const checked = ask.chosen.includes(unit.id);
                  const site = siteByCode(unit.siteCode)?.name;
                  return (
                    <label
                      key={unit.id}
                      className={`${ph.cand} ${styles.row}`}
                      data-kind="yes"
                      data-testid={`ward-referral-ask-ward-${unit.id}`}
                    >
                      <input
                        type="checkbox"
                        className={styles.box}
                        aria-label={unit.name}
                        aria-describedby={`${baseId}-sub-${unit.id}`}
                        checked={checked}
                        disabled={!checked && ask.chosen.length >= ask.slots}
                        onChange={(event) => ask.toggle(unit.id, event.target.checked)}
                      />
                      <span className={ph.who}>
                        <span className={`${ph.nm} ${styles.wrap}`}>{unit.name}</span>
                        <span className={`${ph.sub} ${styles.wrap}`} id={`${baseId}-sub-${unit.id}`}>
                          {[site, `${unit.allocatable.value} ready`].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      <span className={ph.lab}>
                        <StatusGlyph tone="success" size={9} />
                        Fits
                      </span>
                    </label>
                  );
                })}
              </div>
            </>
          ) : null}
          {ask.review.length > 0 ? (
            <>
              <p className={ph.ch}>
                Needs review <span className={ph.k}>{ask.review.length}</span>
              </p>
              {ask.showReview || ask.query.trim() ? (
                <div className={ph.cands} role="group" aria-label="Needs review">
                  {ask.review.map(({ unit, reason }) => (
                    <label key={unit.id} className={`${ph.cand} ${styles.row}`} data-kind="review">
                      <input
                        type="checkbox"
                        className={styles.box}
                        aria-label={unit.name}
                        aria-describedby={`${baseId}-sub-${unit.id}`}
                        checked={false}
                        disabled
                      />
                      <span className={ph.who}>
                        <span className={`${ph.nm} ${styles.wrap}`}>{unit.name}</span>
                        <span className={`${ph.sub} ${styles.wrap}`} id={`${baseId}-sub-${unit.id}`}>
                          {[siteByCode(unit.siteCode)?.name, reason].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      <span className={ph.lab}>
                        <StatusGlyph tone="neutral" size={9} />
                        Review
                      </span>
                    </label>
                  ))}
                </div>
              ) : (
                <button type="button" className={ph.more} onClick={() => ask.setShowReview(true)}>
                  Show {ask.review.length} more to review
                </button>
              )}
            </>
          ) : null}
          <p className={styles.hint}>
            Listed A to Z, never ranked. Each ward asked gets the same referral and bed details, with its own clock.
          </p>
        </div>
      ) : (
        <>
          <p className={styles.hint}>
            {full
              ? `${ask.waiting} wards are waiting, the most at once. You can ask another when one of them answers.`
              : `Up to ${ask.cap} wards can be waiting at once. A ward that declines frees its place.`}
          </p>
          <Button
            variant="sec"
            size="md"
            type="button"
            className={styles.open}
            data-testid="ward-referral-ask-open"
            disabledReason={full ? `${ask.cap} wards are already waiting.` : undefined}
            reasonDisplay="tooltip"
            onClick={full ? undefined : ask.start}
          >
            Ask more wards
          </Button>
        </>
      )}
    </section>
  );
}

/** The pane footer while the list is open: Cancel first and Ask second, as `.foot` expects. */
export function AskMoreWardsFoot({ ask }: { ask: AskMoreWards }) {
  const n = ask.chosen.length;
  // A ward can start waiting elsewhere while the list is open, so the ticks can outgrow the slots.
  const over = n > ask.slots;
  const reason =
    n === 0
      ? "Tick at least one ward that fits."
      : over
        ? `Only ${ask.slots} more can be waiting now.`
        : ask.pending
          ? "Still asking the wards ticked."
          : undefined;
  return (
    <>
      <Button variant="sec" size="md" type="button" data-testid="ward-referral-ask-cancel" onClick={ask.close}>
        Cancel
      </Button>
      <Button
        variant="pri"
        size="md"
        type="button"
        data-testid="ward-referral-ask-submit"
        disabledReason={reason}
        reasonDisplay="tooltip"
        onClick={reason ? undefined : ask.ask}
      >
        <span className={ph.ell}>
          {n === 0 ? `Pick up to ${ask.slots} ward${plural(ask.slots)}` : `Ask ${n} ward${plural(n)}`}
        </span>
      </Button>
    </>
  );
}
