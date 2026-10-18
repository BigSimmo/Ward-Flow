"use client";

// The bed board's last sections: the folded shift brief (the ward's daily sheet), the printed
// people list and the footnote. Split out of ward-board.tsx to keep that file under the line cap;
// WardBoard still owns every value and passes it in.
import { type Instant } from "@/components/ward-management/ward-clock";
import type { BedRelease, Unit } from "@/components/ward-management/ward-model";
import { WardDailySheet } from "./ward-daily-sheet";
import styles from "./board.module.css";
import { OUTGOING_BASIS_LABEL, type Incoming, type Occupant, type OutgoingBasis, type Tile } from "./ward-board-model";

import type { Dispatch, SetStateAction } from "react";
import type { ArrowTarget, SinceYesterday } from "@/components/ward-management/ward-board-derivations";
import { PersonEntry } from "./ward-board-person-entry";

export function WardBoardPrintSections({
  incoming,
  movement,
  now,
  occupants,
  outgoing,
  outgoingBasis,
  selectedKey,
  setSheetOpen,
  sheetOpen,
  targets,
  tiles,
  unit,
}: {
  incoming: Incoming[];
  movement: SinceYesterday;
  now: Instant;
  occupants: Occupant[];
  outgoing: BedRelease[];
  outgoingBasis: OutgoingBasis;
  selectedKey: string | null;
  setSheetOpen: Dispatch<SetStateAction<boolean>>;
  sheetOpen: boolean;
  targets: ArrowTarget[];
  tiles: Tile[];
  unit: Unit;
}) {
  return (
    <>
      {/*
       * WHERE THESE BEDS FREE UP TO — from `arrowTargets`, which existed fully tested with zero
       * consumers until this board became its first.
       *
       * **It has moved out of the left column, and the reason is a measured one rather than a
       * preference.** In a 17rem sidebar it was 746px tall — 55% of a 1362px column, and by itself
       * taller than the whole middle column beside it (439px) — because the longest team name,
       * "Goldfields-Esperance Community Mental Health Team (placeholder)", needs roughly 380px to
       * sit on one line and had 272px to do it in. Eight entries each wrapped to two lines, and the
       * panel's height was almost entirely the cost of that wrapping. **The content is wide; the
       * column was not.** Nothing here was shortened, generalised or dropped to fix it: all eight
       * regions, their counts, their soonest days and their team names are on the page exactly as
       * before, in a full-width band where each one fits on a single line.
       *
       * The alternative considered and REJECTED was stating the naming convention once in the intro
       * and dropping the per-row team name. It reads well against today's fixture — every value in
       * `COMMUNITY_TEAMS` is "<Region> Community Mental Health Team (placeholder)" — but that file's
       * own comment says the product owner may later supply real team names, at which point a
       * sentence claiming the convention becomes a false statement on a clinical screen that no test
       * would catch. A layout must not depend on a fixture happening to be formulaic.
       *
       * It sits BELOW the three zones rather than inside one, for the same reason the triage bar
       * sits above them: this is a ward-level aggregate, not a per-bed or per-column fact. The
       * left-to-right reading is untouched — coming in and going out are still LEFT, the beds
       * MIDDLE, the chosen bed RIGHT — and this band is the tail of the "Going out today" list,
       * read last, which is where a departure story ends.
       *
       * **There are deliberately no drawn arrows, and that is a correctness decision rather than
       * a simplification.** Connector geometry on the coordinator's diagrams is measured in
       * JavaScript from the live screen layout and never re-measured for print, so a printed
       * route line points at whichever ward has since moved under it — proven on paper this
       * session, and the reason those connectors are now hidden in print entirely. Drawing
       * eighteen bed-to-region arrows would import that failure and add a spaghetti of lines
       * nobody can follow. The connection is carried by a shared REGION NAME on both sides
       * instead. Words survive greyscale, a stripped-background print and forced-colors;
       * measured coordinates survive none of it.
       *
       * Scoped to `ARROW_HORIZON_DAYS`, so this is a short list a flow meeting can read, not a
       * second copy of the bed list. Someone with no expected date is absent entirely rather
       * than defaulted — nobody has said when they are leaving, so the board says nothing.
       */}

      {/*
       * WHO IS IN THESE BEDS — every occupant with their discharge plan, and on paper only.
       *
       * **This is the 281bdf83f deliverable, kept whole rather than lost to the slide-out.** That
       * commit's panel listed every occupant with when they are expected out, who set the date, how
       * many times it has moved, whether the ward has confirmed it and what is holding it up. The
       * owner has replaced it ON SCREEN with a per-selection panel, which is his call; none of that
       * makes the printed sheet worse, and a sheet carrying only whoever was last clicked would be
       * a page whose content depends on an interaction that left no mark on it. So the screen shows
       * one person on request and the paper shows all of them, which is what each medium is good
       * at: the screen is interactive and the sheet is not.
       *
       * It is `display: none` on screen and restored in the print block — the only hidden content on
       * this board, and hidden in the direction that ADDS to the sheet rather than removing from it.
       * The rendered rows are what the existing suite in `tests/ward-board-people-panel.dom.test.tsx`
       * asserts against (rows + blocked + closed + empty === `unit.beds`, ordering, provenance, no
       * diagnosis), so every one of those invariants still has a live subject after the rebuild.
       *
       * The list is NOT truncated and must not become so. Eighteen people is a long sheet, and a
       * "top 5" with the rest hidden is worse than no list, because nobody reading it can tell that
       * anything is missing.
       */}
      {/*
       * THE WARD'S DAILY SHEET — LAST ON SCREEN, AND FOLDED AWAY UNTIL SOMEBODY WANTS IT.
       *
       * **Moved here from directly under the heading, owner 2026-08-30.** Measured before the
       * move: the sheet was 995px of a 2493px page — **40% of the ward board, sitting second**,
       * pushing the beds themselves below the fold. The board's subject is the beds; the sheet is
       * what the board PRINTS.
       *
       * **Folded because on screen it repeats the board almost entirely, and that was by design.**
       * The sheet was built as a printout of these same panels, so its "Since yesterday", "Who
       * came in", "Who is going" and destinations list are the board's own since-panel, incoming
       * panel, outgoing panel and destinations panel a second time. Two answers to one question,
       * a screen apart, is exactly what this board refuses everywhere else.
       *
       * **Folding removes the duplication from the screen and removes nothing from the paper.**
       * `<details>` keeps it one click away so nobody has to print to see what will print, and
       * the print stylesheet forces it open — see `.sheetFold[open]` and the `@media print` rule,
       * which must stay together: a fold that stayed shut on paper would print a blank page where
       * the handover sheet belongs, which is the worst outcome of the three.
       */}
      <section className={styles.sheetFold} data-testid="ward-board-sheet-fold" id="ward-board-daily-sheet">
        <button
          type="button"
          className={styles.sheetFoldSummary}
          aria-expanded={sheetOpen}
          aria-controls="ward-board-sheet-body"
          onClick={() => setSheetOpen((open) => !open)}
        >
          {sheetOpen ? "Hide" : "Show"} shift brief
        </button>
        <div
          id="ward-board-sheet-body"
          className={sheetOpen ? styles.sheetBody : styles.sheetBodyHidden}
          data-testid="ward-board-sheet-body"
        >
          <WardDailySheet
            movement={movement}
            incomingPulled={incoming.filter((person) => person.state === "pulled").length}
            incomingWaitlisted={incoming.filter((person) => person.state === "waitlisted").length}
            outgoingCount={outgoing.length}
            outgoingBasisLabel={OUTGOING_BASIS_LABEL[outgoingBasis]}
            destinations={targets}
            people={occupants}
            now={now}
          />
        </div>
      </section>

      <aside className={styles.people} aria-labelledby="ward-board-people-heading">
        <h2 id="ward-board-people-heading" className={styles.peopleHeading}>
          Who is in these beds
        </h2>
        <p className={styles.peopleIntro}>
          Every occupant of this ward, soonest expected out first; anyone with no date set is last.
        </p>
        {/* An empty list under a heading reads as a panel that failed to load rather than as a ward
            with nobody in it, so the absence is said in words. `constraintSentence` returns null for
            the same reason a few lines up. */}
        {occupants.length === 0 && <p className={styles.personLine}>Nobody is recorded in a bed on this ward.</p>}
        <ol className={styles.peopleList} data-testid="ward-board-people">
          {occupants.map((occupant) => (
            <li
              key={occupant.key}
              className={`${styles.person}${occupant.key === selectedKey ? ` ${styles.personSelected}` : ""}`}
              data-testid={`ward-board-person-${occupant.key}`}
            >
              {/* Selection on paper is WEIGHT and a word, never a fill: on a sheet that has made no
                  decision a filled element reads as a decision made. */}
              {occupant.key === selectedKey && <p className={styles.personSelectedMark}>Selected on screen</p>}
              <PersonEntry occupant={occupant} idPrefix="ward-board-person" />
            </li>
          ))}
        </ol>
      </aside>

      <p className={styles.footnote} data-testid="ward-board-footnote">
        {unit.name} · {tiles.length} recorded bed{tiles.length === 1 ? "" : "s"}
      </p>
    </>
  );
}
