"use client";

import { useState } from "react";

import {
  type CatchmentAnswer,
  type CatchmentLookup,
  lookupCatchment,
} from "@/components/ward-management/ward-catchment";

import styles from "./ward.module.css";

/**
 * 🔴 **WHICH COMMUNITY TEAM COVERS THIS SUBURB — AND TWO OF ITS FIVE ANSWERS REFUSE TO NAME ONE.**
 *
 * Task A3's lookup half, built from `ward-third-edition.html`'s *Where to refer* panel.
 *
 * ⚠️ **THE HEADING IS NOT THE DRAWING'S.** Owner ruling: *"Where to refer"* is already rendered by
 * `referrals/referral-intake.tsx` for a different thing — the destination-kind picker, which is about
 * the ACT of referring. **One phrase over two meanings on two screens is the defect this project has
 * ruled on repeatedly**, and the established use wins. This panel is named for the question it
 * answers.
 *
 * ⚠️ **AND THE HEADING IS DELIBERATELY NOT HEDGED.** *"The team for this suburb"* implies there is
 * one, and twice in five outcomes there is not. **A heading that qualified itself to cover those two
 * would read as evasive on a clinical screen; the states below do the correcting in their own
 * words.** That was argued and ruled, not overlooked.
 *
 * 🔴 **THE DRAWING'S WORKED EXAMPLES ARE WRONG AND WERE NOT COPIED.** It illustrates the
 * marked-but-routing state with **Calista**; `lookupCatchment("Calista")` returns `contested`,
 * because contested is checked first and — in `ward-catchment.ts`'s own words — *"contested wins,
 * because it is the state that refuses to route"*. **Building from the drawing's suburbs would have
 * shipped a panel whose example demonstrated the opposite of its own caption.** Routed to the
 * drawing's owner; the code is right.
 *
 * 🔴 **FOUR STATES, FIVE OUTCOMES. `unknown` SPLITS AND MUST NEVER BE MERGED** — pinned by
 * `ward-catchment.test.ts:281`, and the reason is operational rather than tidy: **the two differ in
 * what a coordinator does next.** A suburb missing from the table may be a wrong address or someone
 * out of area — something to CHECK. A suburb present with an empty cell is a real place whose mapping
 * was never written down — something to FILL IN. **Neither is called "Unknown."**
 */

const HEADING_ID = "ward-suburb-team-heading";

/**
 * ⚠️ **THIS SENTENCE IS RENDERED IN EVERY STATE, NOT ONLY THE EMPTY ONE.** An honest qualifier that
 * lives in the empty state disappears exactly when an answer arrives, which is when a reader most
 * needs it — owner instruction, and `ward-suburb-team-panel.dom.test.tsx` asserts it both before and
 * after a lookup. Copied from the drawing's own lede.
 */
const QUALIFIER =
  "The key is the suburb and never the postcode. Nothing on this panel asks for a bed, and nothing here is sent until somebody sends it.";

const FREQUENT_SUBURBS = [
  { name: "Albany", region: "Great Southern" },
  { name: "Belmont", region: "Inner City" },
  { name: "Calista", region: "Rockingham/Kwinana" },
  { name: "Joondalup", region: "North Metro" },
  { name: "Fremantle", region: "South Metro" },
  { name: "Rockingham", region: "South Metro" },
];

/** One reading, with the document that says it — never collapsed, so a reader can audit the source. */
function Reading({ answer }: { answer: CatchmentAnswer }) {
  return (
    <li className={styles.suburbReading}>
      <span className={styles.suburbTeam}>{answer.clinics.join(" and ")}</span>{" "}
      <span className={styles.suburbSource}>
        {answer.document.id}
        {answer.document.date === null ? "" : `, ${answer.document.date}`}
        {answer.pages.length === 0 ? "" : `, page ${answer.pages.join(" and ")}`}
        {/* The source cell before slash-splitting. A slash is a SET written by somebody with no
            field for one, and showing the raw cell is what lets a reader see that rather than
            trust this component's parsing of it. */}
        {answer.verbatim === answer.clinics.join("/") ? "" : ` — the cell reads “${answer.verbatim}”`}
      </span>
    </li>
  );
}

function Answer({ found }: { found: CatchmentLookup }) {
  switch (found.state) {
    case "reviewed":
      return (
        <div className={styles.suburbAnswer} data-testid="ward-suburb-team-answer" data-state="reviewed">
          <div className={styles.suburbResultPanel}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "8px",
                flexWrap: "wrap",
              }}
            >
              <p className={styles.suburbVerdict}>One team covers {found.suburb}.</p>
              <span className={`${styles.statusPillBadge} ${styles.good}`}>Single Team Catchment</span>
            </div>
            <ul className={styles.suburbReadings}>
              {found.answers.map((answer) => (
                <Reading key={answer.document.id} answer={answer} />
              ))}
            </ul>
          </div>
        </div>
      );

    case "unreviewed":
      return (
        <div className={styles.suburbAnswer} data-testid="ward-suburb-team-answer" data-state="marked">
          <div className={styles.suburbResultPanel}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "8px",
                flexWrap: "wrap",
              }}
            >
              <p className={styles.suburbVerdict}>{found.suburb} has an answer, and the row it came from is marked.</p>
              <span className={`${styles.statusPillBadge} ${styles.warn}`}>Marked Row</span>
            </div>
            <ul className={styles.suburbReadings}>
              {found.answers.map((answer) => (
                <Reading key={answer.document.id} answer={answer} />
              ))}
            </ul>
            {/* 🔴 The mark travels WITH the answer. Rendering the team without it would make a marked
                row indistinguishable from a clean one on screen while they stay distinct in the model —
                which is the whole difference between `reviewed` and `unreviewed`. */}
            <p className={styles.suburbNote}>{found.note}</p>
          </div>
        </div>
      );

    case "contested":
      return (
        <div className={styles.suburbAnswer} data-testid="ward-suburb-team-answer" data-state="contested">
          <div className={styles.suburbResultPanel}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "8px",
                flexWrap: "wrap",
              }}
            >
              <p className={styles.suburbVerdict}>
                {found.suburb} has two readings that disagree
                {found.withinOneDocument ? ", in the same document" : ""}.
              </p>
              <span className={`${styles.statusPillBadge} ${styles.danger}`}>Contested Readings</span>
            </div>
            <ul className={styles.suburbReadings}>
              {found.answers.map((answer, index) => (
                <Reading key={`${answer.document.id}-${index}`} answer={answer} />
              ))}
            </ul>
            <p className={styles.suburbNote}>{found.note}</p>
            {/* The refusal is stated, not merely enacted. Rendering both readings and then quietly
                routing on one would make the display honest and the behaviour dishonest. */}
            <p className={styles.suburbNote}>
              Both readings are shown and neither is chosen. Nothing is sent from a contested answer — a person picks.
            </p>
          </div>
        </div>
      );

    case "unknown":
      return found.reason === "suburb-in-source-table-but-no-follow-up-clinic-recorded" ? (
        <div className={styles.suburbAnswer} data-testid="ward-suburb-team-answer" data-state="no-team-recorded">
          <div className={styles.suburbResultPanel}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "8px",
                flexWrap: "wrap",
              }}
            >
              {/* 🔴 NOT "unknown". The place is real and the mapping is missing — something to FILL IN. */}
              <p className={styles.suburbVerdict}>No team is recorded for {found.suburb ?? found.query}.</p>
              <span className={`${styles.statusPillBadge} ${styles.warn}`}>No Clinic Recorded</span>
            </div>
            <p className={styles.suburbNote}>{found.note}</p>
            {/* ⚠️ **WHAT TO DO, NOT WHAT THE NOTE ALREADY SAID.** An earlier draft restated the source
                facts here — that the row exists and the cell is empty — which `found.note` says one line
                above. **The tests could not see it: they assert presence, and a duplicated sentence is
                present twice.** Found by reading the rendered panel in a browser. */}
            <p className={styles.suburbNote}>
              The place is real and the mapping was never written down. This is a gap to fill in, not an address to
              re-check — which is the whole reason it is not the same answer as a suburb the table does not carry.
            </p>
          </div>
        </div>
      ) : (
        <div className={styles.suburbAnswer} data-testid="ward-suburb-team-answer" data-state="not-in-table">
          <div className={styles.suburbResultPanel}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "8px",
                flexWrap: "wrap",
              }}
            >
              {/* 🔴 NOT "unknown" either, and not the same as the case above — something to CHECK. */}
              <p className={styles.suburbVerdict}>{found.query} is not in the source table.</p>
              <span className={`${styles.statusPillBadge} ${styles.danger}`}>Not In Catchment Table</span>
            </div>
            <p className={styles.suburbNote}>{found.note}</p>
            <p className={styles.suburbNote}>
              Check the spelling and the address. A suburb absent from the table may be a misspelling, or somebody out
              of this catchment altogether — no answer is guessed at from a similar name.
            </p>
          </div>
        </div>
      );
  }
}

export function SuburbTeamPanel() {
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState<string | null>(null);

  const found = submitted === null || submitted.trim().length === 0 ? null : lookupCatchment(submitted);

  const handleQuickLookup = (suburbName: string) => {
    setQuery(suburbName);
    setSubmitted(suburbName);
  };

  return (
    <section
      aria-labelledby={HEADING_ID}
      className={`${styles.listSection} ${styles.suburbLookupCard}`}
      data-testid="ward-suburb-team-panel"
    >
      <div className={styles.suburbLookupHead}>
        <div className={styles.suburbHeaderLeft}>
          <div className={styles.suburbHeaderIcon}>
            <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 1a5 5 0 00-5 5c0 3.5 5 9 5 9s5-5.5 5-9a5 5 0 00-5-5z" />
              <circle cx="8" cy="6" r="2" />
            </svg>
          </div>
          <div className={styles.suburbHeaderTitles}>
            <h2 id={HEADING_ID} className={styles.suburbHeaderMainTitle}>
              The team for this suburb
            </h2>
            <p className={styles.suburbHeaderSubText}>
              Find which Community Mental Health Team covers a patient&rsquo;s residence
            </p>
          </div>
        </div>
        <span className={styles.badgePill}>Community Catchment Directory</span>
      </div>

      <p className={styles.suburbQualifier} data-testid="ward-suburb-team-qualifier">
        {QUALIFIER}
      </p>

      <form
        className={styles.suburbForm}
        data-testid="ward-suburb-team-form"
        onSubmit={(event) => {
          event.preventDefault();
          setSubmitted(query);
        }}
      >
        <label className="sr-only" htmlFor="ward-suburb-team-input">
          Patient&rsquo;s suburb
        </label>
        <div className={styles.suburbSearchRow}>
          <div className={styles.suburbInputWrapper}>
            <svg
              className={styles.suburbInputIcon}
              viewBox="0 0 16 16"
              width="15"
              height="15"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <circle cx="7" cy="7" r="4.5" />
              <path d="M10.5 10.5L14 14" />
            </svg>
            <input
              id="ward-suburb-team-input"
              className={styles.suburbSearchInput}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search suburb (e.g. Albany, Belmont, Calista, Joondalup)..."
              autoComplete="off"
            />
          </div>
          <button type="submit" className={styles.btnLookupAction}>
            <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 8l3 3 7-7" />
            </svg>
            <span>Look up the team</span>
          </button>
        </div>

        <div className={styles.quickPillsRow}>
          <span className={styles.quickPillLabel}>Frequent:</span>
          {FREQUENT_SUBURBS.map((suburb) => (
            <button
              key={suburb.name}
              type="button"
              className={styles.quickPillBtn}
              onClick={() => handleQuickLookup(suburb.name)}
              title={`Quick lookup for ${suburb.name} (${suburb.region})`}
            >
              {suburb.name}
            </button>
          ))}
        </div>
      </form>

      {found === null ? (
        <p className={styles.placeholder} data-testid="ward-suburb-team-empty">
          No suburb has been looked up yet. Absence here means none was asked for, not that no team exists.
        </p>
      ) : (
        <Answer found={found} />
      )}
    </section>
  );
}
