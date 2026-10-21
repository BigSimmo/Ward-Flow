"use client";

// The bed board's header: the ward and hospital names, the headline Ready now figure, the band
// stats, the constraint sentences and the as-at stamp. Split out of ward-board.tsx to keep that
// file under the line cap; WardBoard still owns every value and passes it in.
import { designationSummary } from "@/components/ward-management/ward-bed-designation";
import type { BedRelease, Site, Unit } from "@/components/ward-management/ward-model";
import styles from "./board.module.css";
import { type Incoming } from "./ward-board-model";

import type { HealthService } from "@/components/ward-management/ward-model";
import type { BedStateCounts } from "@/components/ward-management/ward-bed-states";

export function WardBoardHeader({
  available,
  constraint,
  incoming,
  outgoing,
  pendingPreparation,
  pulledIn,
  service,
  site,
  stamp,
  states,
  unit,
}: {
  available: number;
  constraint: string | null;
  incoming: Incoming[];
  outgoing: BedRelease[];
  pendingPreparation: number;
  pulledIn: Incoming[];
  service: HealthService | null;
  site: Site;
  stamp: { time: string | null; dayNote: string };
  states: BedStateCounts;
  unit: Unit;
}) {
  return (
    <div className={styles.header}>
      {/* 🔴 **THE SCREEN'S NAME IN THE `h1`, THE WARD'S IN AN `h2`** — the drawing's shape, and the
              same ruling already applied to the ward screen (A1). Until now the `h1` WAS the ward's
              name, so **every ward rendered a different `h1` and this screen had no stable name
              anywhere on it**.

              ⚠️ **The ward's name is DEMOTED, never dropped.** A board that lost it would be a grid of
              anonymous tiles that could have come from any ward in the state — which is the worse of
              the two defects, and is what `ward-board-third-edition-headings.dom.test.tsx` asserts
              alongside the `h1`, deliberately in the same file. **The class and the test id do not
              move**, so nothing that finds this by id or styles it by class is disturbed. */}
      <h2 id="ward-board-unit-name" className={styles.unitName} data-testid="ward-board-unit-name">
        {unit.name}
      </h2>
      {/* Phone review F-27: place first, then service, as the ward home's own place line reads. */}
      <p className={styles.siteName} data-testid="ward-board-site-name">
        {site.name} · <strong>{site.service}</strong>
      </p>
      {/* Item 44, build plan task G2, §3 "Bed board": this page is about ONE named place (§2
       *  "Never hidden", S4) and is never itself narrowed by the chosen service — this states
       *  how the choice relates to it. Two branches, same as the choice, never the same
       *  service ↔ different service the ward page's own F3 sentence deliberately avoided. */}
      {service !== null ? (
        <p className={styles.constraint} data-testid="ward-board-service-sentence">
          {service === site.service
            ? `The Service selector is set to ${service}, which is this ward's own service.`
            : `The Service selector is set to ${service}. This ward is in ${site.service}. The board always shows this one ward.`}
        </p>
      ) : null}
      {/*
       * THE LOCKED/OPEN SPLIT, which the owner asked for by name on 2026-09-04 — "some wards are a
       * combination with a number of designated locked beds and open beds" — and which this board
       * was the last screen not to say. Five others already render it.
       *
       * ⚠️ THROUGH `designationSummary`, NEVER `beds - lockedBeds` HERE. Open beds are derived and
       * never stored, on the owner's one-source ruling, and that module exists precisely because
       * the old flag was read in eight files: a subtraction repeated eight times is eight chances
       * to get it the wrong way round. It also says "All open" rather than "0 locked, 17 open",
       * because a zero beside a real number reads as a measurement, and a ward with no locked beds
       * has a kind of bed it does not have rather than zero of them.
       *
       * ⚠️ A COUNT, NOT AN ASSIGNMENT, and that is the whole of what this board may say. Which
       * TILE is a locked bed is not recorded — an `Admission` holds the unit and never a bed — so
       * the drawing this screen came from split the grid into a "locked bay" and an "open beds"
       * group and could not have. The ward's split is a fact; a tile's is not.
       *
       * ⚠️ AND IT SAYS NOTHING ABOUT PATIENTS. `ward-model.ts` puts it in terms: a locked bed is a
       * property of the WARD, an involuntary patient a property of the PERSON, and a voluntary
       * patient may be nursed on a locked ward. The drawing headed twelve tiles "these are the only
       * beds that can hold a detained patient" — false in both directions, and rendered nowhere here.
       */}
      <p className={styles.designation} data-testid="ward-board-designation">
        {unit.beds} bed{unit.beds === 1 ? "" : "s"} · {designationSummary(unit)}
      </p>
      <p className={styles.headline} data-testid="ward-board-headline">
        <span className={styles.headlineValue}>{available}</span>
        {/* Phone review F-27: the ward home's word for the same figure. */}
        <span className={styles.headlineLabel}>Ready now</span>
      </p>
      {/*
            Its OWN sentence, never a figure beside the figure — `ward-screen.tsx` found in a browser
            that rendering "Ready 2" immediately followed by "1 still being made ready" reads as 21
            on the screen whose whole job is telling a ward how many beds it has. It renders only
            when there is one: an absence here is silence, never a "0 being made ready", which would
            be a claim nobody made.
          */}
      {/* v6 band figures (design/pages-v6/WardBoard--bed-board.png). Each is a count this page
              already prints below — the triage bar, the incoming list and the Going out list — so the
              band cannot disagree with them. */}
      <dl className={styles.bandStats} data-testid="ward-board-band-stats">
        <div>
          <dt>Occupied</dt>
          <dd>{states.occupied}</dd>
        </div>
        <div>
          <dt>Going out today and tomorrow</dt>
          <dd>{outgoing.length}</dd>
        </div>
        <div>
          <dt>Coming in</dt>
          <dd>{incoming.length}</dd>
        </div>
        <div>
          <dt>
            {pulledIn.length > 0 ? (
              <span aria-hidden="true" className={styles.bandGlyph}>
                ▲
              </span>
            ) : null}
            Pulled, not arrived
          </dt>
          <dd>{pulledIn.length}</dd>
        </div>
      </dl>
      {pendingPreparation > 0 ? (
        <p className={styles.beingMadeReady} data-testid="ward-board-pending-preparation">
          {pendingPreparation} of them {pendingPreparation === 1 ? "is" : "are"} still being made ready. It stays
          counted but is not offered until the ward taps Ready.
        </p>
      ) : null}
      {/* `constraintSentence` returns null — never an empty string — when nothing is
            constraining, so nothing is rendered rather than a blank line that reads as a sentence
            which failed to load. */}
      {constraint !== null && (
        <p className={styles.constraint} data-testid="ward-board-constraint">
          {constraint}
        </p>
      )}
      {/*
       * THE "AS AT" STAMP — spec DB-10, DB-11 and DB-12, and it is load-bearing rather than
       * provenance.
       *
       * DB-11 dropped the frozen 08:00 view outright: this board and its printed sheet are one
       * LIVE picture, and the owner was shown the cost of that and took it. What was traded for
       * the freeze is exactly this line. Two sheets taken an hour apart are then visibly two
       * moments rather than two competing claims — so DB-10 puts the stamp in the HEADING, read
       * as part of the title, and says in terms that small print at the foot of the page does
       * not discharge the requirement.
       *
       * **It reads `now` — the same variable every figure on this page reads (DB-12).** Never
       * `wallClockNow()`. Ward Flow screens take their `now` from a shared value a demo control
       * can move, so a stamp on the wall clock beside figures from a moved clock would assert a
       * moment that is not the moment being shown. A stamp that can lie is worse than no stamp,
       * because the freeze was removed on the strength of it. That is invisible to any test
       * that does not move the clock, which is why `tests/ward-daily-sheet.dom.test.tsx`
       * renders this board at two different instants and asserts the stamp AND the figures both
       * moved.
       *
       * The DATE that DB-10 also asks for is absent, and since `b1198cf6e` that is a CHOICE
       * rather than a limitation: the clock gained a real date, so this could print one. It
       * does not, because a real date beside invented figures is the one combination that
       * makes a prototype look like a record. See `asAtStamp`'s own doc comment.
       */}
      <p className={styles.asAt} data-testid="ward-board-as-at">
        {stamp.time === null ? (
          "As at — the moment shown is not recorded."
        ) : (
          <>
            <span className={styles.asAtValue}>As at {stamp.time}</span>
            <span className={styles.asAtNote}>{stamp.dayNote}</span>
          </>
        )}
      </p>
      {/*
       * THE BOARD IS LIVE, and the note that said otherwise has gone with the fixture.
       *
       * Owner decision 2026-09-01. Two of his decisions had been sitting in this one file at
       * once: DB-11 (2026-08-29) dropped the frozen view and made everything live, and a
       * fixed-board decision (2026-08-30) kept this screen still. The board carried both, forty
       * lines apart, and the visible result was this screen reading `Held 1` at 10:42 while the
       * ward screen read `Held 0` at 12:32 for the same ward at the same moment. Under a note
       * mentioning only the clock, that reads as a fault rather than as a stated design — which
       * is exactly what the earlier comment here predicted would happen, and it did.
       *
       * Nothing renders a fixed-example note now, because there is no fixed example.
       */}
    </div>
  );
}
