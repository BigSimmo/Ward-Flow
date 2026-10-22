"use client";

import { MissingValue } from "@/components/wf/missing-value";
import { type Instant } from "@/components/ward-management/ward-clock";
import { bedReleaseStateLabels } from "@/components/ward-management/ward-derivations";
import { WardFreshness } from "@/components/ward-management/ward-freshness";
import type { BedRelease, Unit } from "@/components/ward-management/ward-model";
import { WardTable } from "@/components/ward-management/ward-table/ward-table";
import { StatusGlyph } from "@/components/wf";
import styles from "./discharges.module.css";
import pageStyles from "./discharges-third-edition.module.css";
import {
  GROUP_LABELS,
  type GroupKey,
  releaseTimingWords,
  EMPTY_REASON,
  GROUP_DESCRIPTIONS,
  unitLabel,
  healthServiceLabel,
  type WorkStatus,
  WORK_STATUS_LABELS,
  stageTone,
} from "./discharge-board-model";

/* The discharge board's small shared parts, moved unchanged from `discharge-board.tsx`. */

/** The stage badge on a list row. */
export const badge = (stage: WorkStatus) => (
  <span className={pageStyles.badge} data-status={stage}>
    <StatusGlyph tone={stageTone(stage)} size={9} />
    <span className="sr-only">
      {stage === "blocked"
        ? "Blocked: "
        : stage === "departed"
          ? "Departed: "
          : stage === "confirmed"
            ? "Confirmed: "
            : "Expected: "}
    </span>
    <span>{WORK_STATUS_LABELS[stage]}</span>
  </span>
);

export function RecordedDischargeMilestones({
  milestones,
  title = "Recorded discharge milestones",
}: {
  milestones: { label: string; detail: string; state: "complete" | "pending" | "blocked" }[];
  /** v10 phone sheet reads "Milestones". */
  title?: string;
}) {
  return (
    <div className={pageStyles.milestones}>
      <span className={pageStyles.sectionLabel}>{title}</span>
      <ol className={pageStyles.timeline}>
        {milestones.map((milestone) => (
          <li className={pageStyles.timelineItem} key={milestone.label} data-state={milestone.state}>
            <StatusGlyph
              tone={milestone.state === "complete" ? "success" : milestone.state === "blocked" ? "danger" : "neutral"}
              size={10}
            />
            <span className={pageStyles.timelineText}>
              <span className={pageStyles.timelineTitle}>{milestone.label}</span>
              <span className={pageStyles.secondary}>{milestone.detail}</span>
            </span>
          </li>
        ))}
      </ol>
      <p className={pageStyles.note}>
        Medical summary, pharmacy verification and transport booking are not recorded here. Departure does not verify
        bed preparation.
      </p>
    </div>
  );
}

/**
 * Exported for `tests/ward-discharge-blocked-emphasis.dom.test.tsx`, which has to render this
 * section with an EMPTY `releases` array — the arm that stops an empty Blocked group being the
 * loudest thing on a board where nothing is stuck. The seeded state always has blocked releases in
 * it, so through `DischargeBoard` that arm is unreachable and a guard over it would be true and
 * unfalsifiable. `groupDischarges` above is already exported on the same grounds.
 */
export function DischargeGroupSection({
  groupKey,
  releases,
  units,
  now,
}: {
  groupKey: GroupKey;
  releases: BedRelease[];
  units: Unit[];
  now: Instant;
}) {
  /*
   * ⚠️ **ONE ELEVATED PANEL ON THE BOARD, AND IT MARKS WORK RATHER THAN A HEADING.** The four
   * groups render in the fixed scan order `GROUP_ORDER` sets — blocked first, because those are
   * the rows somebody must act on — and until this pass nothing but that order said so. Measured
   * at 1100px: all four sections painted `rgb(251, 252, 253)` behind the same border, so the
   * stuck releases and the beds already free were indistinguishable as objects.
   *
   * ⚠️ **AND IT IS CONDITIONAL ON THERE BEING ROWS, WHICH IS THE WHOLE POINT.** Elevating the
   * Blocked heading unconditionally would make an EMPTY panel the loudest thing on a board where
   * nothing is stuck — an absence promoted to a headline, and the good day would look like the
   * urgent one. The lift says "there is work here", not "this heading matters", so it appears only
   * when the group has releases in it. On a board with nothing blocked, no panel is raised and the
   * four read flat, which is the truth of that morning.
   */
  const marksOutstandingWork = groupKey === "blocked" && releases.length > 0;

  /*
   * ⚠️ **THE BLOCKER COLUMN EXISTS IN THE BLOCKED GROUP AND NOWHERE ELSE** (Ward Lead ruling E16,
   * 2026-09-05). `groupDischarges` sends every release with a non-null blocker to `blocked`, so in
   * the other three groups `release.blocker` is `null` BY CONSTRUCTION — the cell read "Not
   * applicable" on every row, seven times on the seeded board, filling a sixth of the table with a
   * fact about the column rather than about the patient.
   *
   * **This is not a new position; it is making one board's two layouts agree.** The card list
   * below already renders `{release.blocker && …}` and has ALWAYS omitted the blocker when it is
   * null. The table restated it. Two renderings of one board disagreeing about whether an absence
   * is worth stating is a defect, and the deliberate one wins over the repeated one.
   *
   * ⚠️ **`Stage` STAYS ON ALL FOUR, THOUGH IT IS ALSO CONSTANT IN THREE OF THEM.** It is a genuine
   * per-row fact and it is cheap — and keeping it everywhere makes the Blocked group's Stage the
   * only VARYING one on the page (Confirmed or Expected, because the flag is read before the
   * stage), which puts the emphasis exactly where this board exists to put it. Dropping it too
   * would flatten that signal to save four words.
   *
   * ⚠️ **AND THE FIRST MEASUREMENT OF THIS SAID SIX COLUMNS, NOT TWO.** Read off the rendered
   * table, `discharged-today` showed every one of its six columns as constant — because it has ONE
   * seeded row — and `Health service` looked constant in `blocked` on two rows. **A rendered table
   * cannot tell a column that is constant by construction from one that is constant because the
   * group is small**, and acting on that reading would have deleted four columns carrying real
   * per-row facts. Only `Stage` and `Blocker` survive when the branches are read instead.
   */
  const showsBlocker = groupKey === "blocked";

  return (
    <section
      className={marksOutstandingWork ? `${styles.section} ${styles.sectionLive}` : styles.section}
      data-testid={`ward-discharge-group-${groupKey}`}
      data-has-items={releases.length > 0 ? "true" : "false"}
    >
      <div className={pageStyles.groupHeading}>
        <h2 className={styles.sectionHeading}>{GROUP_LABELS[groupKey]}</h2>
        <p>{GROUP_DESCRIPTIONS[groupKey]}</p>
        <span className={styles.countBadge}>{releases.length}</span>
      </div>
      <div
        className={pageStyles.groupBody}
        role="region"
        aria-label={`${GROUP_LABELS[groupKey]} discharge records`}
        tabIndex={0}
      >
        {releases.length === 0 ? (
          <p className={styles.emptyNote} data-testid={`ward-discharge-group-${groupKey}-empty`}>
            None. No {EMPTY_REASON[groupKey]}.
          </p>
        ) : (
          <>
            <WardTable
              className={styles.table}
              wrapperClassName={styles.tableScroll}
              testId={`ward-discharge-table-${groupKey}`}
            >
              <thead>
                <tr>
                  <th scope="col">Unit</th>
                  <th scope="col">Health service</th>
                  <th scope="col">Expected</th>
                  <th scope="col">Stage</th>
                  {showsBlocker ? <th scope="col">Blocker</th> : null}
                  <th scope="col">Freshness</th>
                </tr>
              </thead>
              <tbody>
                {releases.map((release) => {
                  const unit = units.find((candidate) => candidate.id === release.unitId);
                  return (
                    <tr key={release.id}>
                      <td>{unitLabel(unit, release.unitId)}</td>
                      <td>{healthServiceLabel(unit)}</td>
                      <td className={styles.countdownBand}>{releaseTimingWords(release, now)}</td>
                      {/* Bed-model rework (2026-08-28): the stage is rendered on every row, in
                          every group. Without it the Blocked group would swallow the one fact
                          this rework exists to preserve — that a stuck discharge is still a
                          DECIDED one — and a coordinator could not tell a blocked prediction
                          from a blocked confirmation. */}
                      <td>{bedReleaseStateLabels[release.state]}</td>
                      {showsBlocker ? (
                        <td>
                          {/* SPEC §11: `blocker` is non-null only in `blocked` (ward-model.ts), so
                              a null here is a release to which a blocker cannot apply — not one
                              whose blocker nobody wrote down. A dash collapsed those two into one
                              glyph.

                              ⚠️ THE FALLBACK IS KEPT THOUGH `groupDischarges` CANNOT PRODUCE IT.
                              Every release reaching this branch came through the `blocker !== null`
                              test, so via `DischargeBoard` the `??` arm is unreachable — but
                              `DischargeGroupSection` is exported and rendered directly by
                              `tests/ward-discharge-blocked-emphasis.dom.test.tsx` with arbitrary
                              lists, so this component no longer controls its own input. A defensive
                              branch on a component that can be handed anything is not dead code. */}
                          {release.blocker ?? <MissingValue reason="not_applicable" density="cell" />}
                        </td>
                      ) : null}
                      <td>
                        <WardFreshness
                          confirmedAt={release.confirmedAt}
                          confirmedByRole={release.confirmedBy}
                          now={now}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </WardTable>

            <ul className={styles.cardList} data-testid={`ward-discharge-cards-${groupKey}`}>
              {releases.map((release) => {
                const unit = units.find((candidate) => candidate.id === release.unitId);
                return (
                  <li key={release.id} className={styles.card}>
                    <div className={styles.cardTop}>
                      <span className={styles.cardBand}>{releaseTimingWords(release, now)}</span>
                      <span className={styles.cardUnit}>{unitLabel(unit, release.unitId)}</span>
                    </div>
                    <p className={styles.cardService}>{healthServiceLabel(unit)}</p>
                    <p className={styles.cardService}>{bedReleaseStateLabels[release.state]}</p>
                    {release.blocker && <p className={styles.cardBlocker}>{release.blocker}</p>}
                    <WardFreshness confirmedAt={release.confirmedAt} confirmedByRole={release.confirmedBy} now={now} />
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}
