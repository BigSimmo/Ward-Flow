"use client";

// The bed board's left column: the Going out / Coming in / Since yesterday tabs and their panels.
// Split out of ward-board.tsx to keep that file under the line cap; WardBoard still owns every
// value and passes it in.
import { type KeyboardEvent } from "react";
import { releaseBand } from "@/components/ward-management/ward-bed-availability";
import { ARROW_HORIZON_DAYS } from "@/components/ward-management/ward-board-derivations";
import { type Instant } from "@/components/ward-management/ward-clock";
import { pullHoldRemainingLabel } from "@/components/ward-management/ward-board-time-features";
import type { BedRelease } from "@/components/ward-management/ward-model";
import styles from "./board.module.css";
import {
  OUTGOING_BASES,
  OUTGOING_BASIS_LABEL,
  RELEASE_BAND_PHRASE,
  bedGonePhrase,
  type FlowTab,
  type Incoming,
  type OutgoingBasis,
} from "./ward-board-model";

import type { Dispatch, SetStateAction } from "react";
import type { ArrowTarget, SinceYesterday } from "@/components/ward-management/ward-board-derivations";

export function WardBoardFlowColumn({
  flowTab,
  incoming,
  movement,
  now,
  onFlowTabKeyDown,
  outgoing,
  outgoingBasis,
  setFlowTab,
  setOutgoingBasis,
  targets,
}: {
  flowTab: FlowTab;
  incoming: Incoming[];
  movement: SinceYesterday;
  now: Instant;
  onFlowTabKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
  outgoing: BedRelease[];
  outgoingBasis: OutgoingBasis;
  setFlowTab: Dispatch<SetStateAction<FlowTab>>;
  setOutgoingBasis: Dispatch<SetStateAction<OutgoingBasis>>;
  targets: ArrowTarget[];
}) {
  return (
    <div className={styles.flowColumn}>
      <div className={styles.flowHeader}>
        <h2 id="ward-board-flow-heading">Either side of this ward</h2>
        <span>
          {outgoing.length} going out · {incoming.length} coming in
        </span>
      </div>
      <div className={styles.tabList} role="tablist" aria-label="Which side of the ward is shown">
        <button
          type="button"
          id="ward-board-flow-tab-outgoing"
          role="tab"
          data-flow-tab="outgoing"
          aria-selected={flowTab === "outgoing"}
          aria-controls="ward-board-outgoing"
          tabIndex={flowTab === "outgoing" ? 0 : -1}
          onClick={() => setFlowTab("outgoing")}
          onKeyDown={onFlowTabKeyDown}
        >
          Going out <span>{outgoing.length}</span>
        </button>
        <button
          type="button"
          id="ward-board-flow-tab-incoming"
          role="tab"
          data-flow-tab="incoming"
          aria-selected={flowTab === "incoming"}
          aria-controls="ward-board-incoming"
          tabIndex={flowTab === "incoming" ? 0 : -1}
          onClick={() => setFlowTab("incoming")}
          onKeyDown={onFlowTabKeyDown}
        >
          Coming in <span>{incoming.length}</span>
        </button>
        <button
          type="button"
          id="ward-board-flow-tab-since"
          role="tab"
          data-flow-tab="since"
          aria-selected={flowTab === "since"}
          aria-controls="ward-board-since-yesterday"
          tabIndex={flowTab === "since" ? 0 : -1}
          onClick={() => setFlowTab("since")}
          onKeyDown={onFlowTabKeyDown}
        >
          Since yesterday
        </button>
      </div>
      {/*
       * COMING IN. Two states with a real difference between them: `"pulled"` means this ward
       * has ALREADY given the bed away and the person is travelling — the grid draws that bed
       * as "Empty, waiting" and it is gone from the ward's count — while `"waitlisted"` means
       * accepted in principle with nothing held. Merging them would let a reader plan against
       * a bed that is already spoken for.
       */}
      <section
        id="ward-board-incoming"
        className={styles.flowPanel}
        role="tabpanel"
        aria-labelledby="ward-board-flow-tab-incoming"
        data-testid="ward-board-incoming"
        hidden={flowTab !== "incoming"}
        tabIndex={0}
      >
        <h2 id="ward-board-incoming-heading" className={styles.flowHeading}>
          Coming in
        </h2>
        <p className={styles.flowIntro} data-testid="ward-board-incoming-count">
          {incoming.length === 0
            ? "Nobody is recorded as coming in to this ward."
            : `${incoming.length} recorded as coming in.`}
        </p>
        {incoming.length > 0 && (
          <ol className={styles.flowList} data-testid="ward-board-incoming-list">
            {incoming.map((person) => (
              <li
                key={person.key}
                className={styles.flowRow}
                data-testid={`ward-board-incoming-${person.key}`}
                data-incoming-state={person.state}
              >
                <p className={styles.flowRowLead}>
                  {person.state === "pulled" ? "Bed already given away" : "Waiting — no bed given"}
                </p>
                <p className={styles.flowRowLine}>
                  {person.sex} · Gender: {person.gender ?? "Not recorded"},{" "}
                  {person.homeRegion === null ? "home region not recorded" : `from ${person.homeRegion}`}
                </p>
                {person.state === "pulled" && (
                  <p className={styles.flowRowLine}>{bedGonePhrase(person.bedGoneHours)}</p>
                )}
                {person.state === "pulled" && person.pullExpiresAt !== null ? (
                  <p className={styles.flowRowLine} data-testid={`ward-board-incoming-pull-hold-${person.key}`}>
                    Bed pull {pullHoldRemainingLabel(person.pullExpiresAt, now)}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        )}
        {/* Said rather than left as an absence a reader might read as "not yet loaded". The
                record holds when a bed was given away and nothing else about the journey. */}
        <p className={styles.flowNote}>Expected arrival time is not recorded.</p>
      </section>

      {/*
       * GOING OUT TODAY, on whichever of the two bases the triage bar's toggle selects. The row
       * count here EQUALS the figure on the bar above by construction — `outgoingToday` applies
       * the same filter `capacityBreakdown` counts with — so a reader can check the board
       * against itself without trusting either.
       */}
      <section
        id="ward-board-outgoing"
        className={styles.flowPanel}
        role="tabpanel"
        aria-labelledby="ward-board-flow-tab-outgoing"
        data-testid="ward-board-outgoing"
        hidden={flowTab !== "outgoing"}
        tabIndex={0}
      >
        <h2 id="ward-board-outgoing-heading" className={styles.flowHeading}>
          Going out today and tomorrow
        </h2>
        {/* The basis is stated in WORDS as well as by the toggle's pressed state, so a printed
                sheet — where the toggle is gone with every other button — still says which of the
                two lists it is. */}
        <p className={styles.flowIntro} data-testid="ward-board-outgoing-count">
          Showing {OUTGOING_BASIS_LABEL[outgoingBasis]}: {outgoing.length} bed{outgoing.length === 1 ? "" : "s"}.
        </p>
        {/*
         * THE TOGGLE SITS WITH THE LIST IT CHANGES. Owner, 2026-08-30.
         *
         * It was on the far right of the triage bar, a full screen-width away from the only
         * thing it alters — so a reader who pressed it watched a list move in the corner of
         * their eye, and a reader looking at the list had no idea it had two states. A
         * control belongs beside its effect.
         *
         * The count line directly above states the basis in WORDS as well, which is what
         * keeps a printed sheet honest: every button is stripped from paper, so the toggle's
         * pressed state cannot be the only thing saying which list this is.
         */}
        <div
          className={styles.flowToggle}
          role="group"
          aria-label="Which of today's departures the Going out list shows"
        >
          <span className={styles.flowToggleLabel}>Going out shows</span>
          {OUTGOING_BASES.map((basis) => (
            <button
              key={basis}
              type="button"
              className={`${styles.flowToggleButton}${outgoingBasis === basis ? ` ${styles.flowToggleButtonOn}` : ""}`}
              aria-pressed={outgoingBasis === basis}
              onClick={() => setOutgoingBasis(basis)}
              data-testid={`ward-board-basis-${basis}`}
            >
              {OUTGOING_BASIS_LABEL[basis]}
            </button>
          ))}
        </div>
        {outgoing.length === 0 ? (
          <p className={styles.flowRowLine}>No bed on this ward carries that today.</p>
        ) : (
          <ol className={styles.flowList} data-testid="ward-board-outgoing-list">
            {outgoing.map((release) => {
              const band = releaseBand(release, now);
              return (
                <li key={release.id} className={styles.flowRow} data-testid={`ward-board-outgoing-${release.id}`}>
                  <p className={styles.flowRowLead}>
                    {band === "beyond-today" ? "Expected today" : RELEASE_BAND_PHRASE[band]}
                  </p>
                  {/* A ROLE, never a personal name — `BedRelease.confirmedBy`'s own rule. */}
                  <p className={styles.flowRowLine}>Reported by {release.confirmedBy}</p>
                  {release.blocker !== null && (
                    <p className={styles.flowRowBlocker}>
                      Held up by: {release.blocker}
                      {release.blockedBy !== null ? ` — recorded by ${release.blockedBy}` : ""}.
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        )}
        {/* The honest limit of this list, stated on it. A `BedRelease` deliberately carries
                NOTHING about the departing patient — not an id, not a sex, not a destination — so
                these rows are beds and can never become people without breaking that. */}
        <p className={styles.flowNote}>Beds, not people; bed-release records carry no patient identifier.</p>
        {/* 🟢 **FOLDED IN FROM ITS OWN PANEL.** The drawing's footnote: *"Where these beds free
                  up to was folded into Going out. Both panels listed the same beds, the ones with a
                  discharge date."* **Two panels, one population** — so it is now a group inside the
                  list it duplicated, not a second landmark beside it.

                  ⚠️ **An `h3` and a `<div>`, not an `h2` and an `<aside>`.** It stopped being a panel,
                  so it stops being a landmark and stops competing with its parent's heading. The
                  destination team, whether that team has been told, and the no-date note all come
                  with it — the footnote's "no count, note or action was dropped" is a promise this
                  fold has to keep. */}
        {targets.length > 0 && (
          <div className={styles.destinations}>
            <h3 className={styles.destinationsHeading}>Where these beds free up to</h3>
            {/* Device audit, 11 Oct 2026: the no-team sentence is said once for the list, not
                      in bold under every region (owner instruction 2026-09-18 below still holds:
                      the absence is shown, never a region lookup). */}
            <p className={styles.destinationsIntro}>
              Expected within {ARROW_HORIZON_DAYS} days, soonest first. No community team is recorded for these regions.
            </p>
            <ol className={styles.destinationList} data-testid="ward-board-destinations">
              {targets.map((target) => {
                return (
                  <li
                    key={target.region}
                    className={styles.destination}
                    data-testid={`ward-board-destination-${target.region}`}
                  >
                    <p className={styles.destinationRegion}>{target.region}</p>
                    <p className={styles.destinationCount}>
                      {target.count} {target.count === 1 ? "person" : "people"}
                      {" · "}
                      {target.nearestDays === 0
                        ? "soonest due now or overdue"
                        : `soonest in ${target.nearestDays} day${target.nearestDays === 1 ? "" : "s"}`}
                    </p>
                    {/*
                            🔴 **NO TEAM IS NAMED HERE, AND THE ABSENCE IS THE CORRECT ANSWER
                            RATHER THAN AN UNFINISHED ONE. Owner instruction, 2026-09-18.**

                            This panel groups by `admission.homeRegion` (`arrowTargets`). Until today
                            it printed `teamForRegion(region)` — ten hand-written names each ending
                            "(placeholder)" — while the community screen and the referral picker one
                            click away showed the 64 REAL catchment teams. The owner asked for the real
                            list to be wired in here too.

                            ⚠️ **It must not be, and swapping the names would have been worse
                            than leaving them.** A real clinic name derived from a patient's home region
                            is a routing CLAIM — "these people go to Butler" — produced from
                            where somebody lives. Owner decision 8 (2026-09-17, answer 20): referral
                            lists narrow by sending and receiving service, **never home area**. The
                            research pack forbids the same move in its own words, by name: never match
                            on suburb, postcode, LGA or proximity. A "(placeholder)" suffix reads on
                            sight as a stand-in; "Butler Community Mental Health Service" reads as a
                            fact, so the swap would have converted an obvious stub into a false claim.

                            ✅ **Nothing records a team for these people.** `Admission`
                            (`ward-admissions.ts:288`) carries no team field; `bookedBy.placeId`
                            identifies a community team that booked TRANSPORT, which is a different
                            fact about a different act. So this line says so, in the words this panel
                            already used for the same situation — "there is nobody to ring about
                            this region" is exactly what a coordinator chasing a discharge needs to
                            see rather than infer from a gap.

                            When a recorded team field exists, read THAT here. Do not reintroduce a
                            region lookup.
                          */}
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </section>

      {/* SINCE YESTERDAY — `sinceYesterday`'s first consumer. The last whole day, which carries
              no clinical or legal meaning and is simply the window between one morning and the
              next. */}
      <section
        id="ward-board-since-yesterday"
        className={styles.flowPanel}
        role="tabpanel"
        aria-labelledby="ward-board-flow-tab-since"
        data-testid="ward-board-since-yesterday"
        hidden={flowTab !== "since"}
        tabIndex={0}
      >
        <h2 id="ward-board-since-heading" className={styles.flowHeading}>
          Since yesterday
        </h2>
        <ul className={styles.sinceList}>
          <li className={styles.sinceItem} data-testid="ward-board-since-discharged">
            <span className={styles.sinceValue}>{movement.discharged}</span> left this ward
          </li>
          <li className={styles.sinceItem} data-testid="ward-board-since-pulled">
            <span className={styles.sinceValue}>{movement.pulled}</span> bed{movement.pulled === 1 ? "" : "s"} given
            away
          </li>
          <li className={styles.sinceItem} data-testid="ward-board-since-dates-moved">
            <span className={styles.sinceValue}>{movement.datesMoved}</span> expected date
            {movement.datesMoved === 1 ? "" : "s"} moved
          </li>
        </ul>
        {/* `discharged` counts departures of every destination and must never be summed across
                wards as beds returned to the network — see `sinceYesterday`'s own doc comment. */}
        <p className={styles.flowNote}>
          A transfer to another psychiatric ward counts here: this ward gets its bed back, the state does not.
        </p>
      </section>
    </div>
  );
}
