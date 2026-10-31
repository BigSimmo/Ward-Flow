"use client";

// Redesign (approved 31 Oct 2026): the kit's segmented filters and select, names that wrap, and a
// phone that opens on the first 8 beds, then Show more.

// The bed board's middle column: the bed grid with its filter, order and legend, and the people
// count beneath it. Split out of ward-board.tsx to keep that file under the line cap; WardBoard
// still owns every value and passes it in.
import { STAY_BANDS } from "@/components/ward-management/ward-admissions";
import { BED_STATE_LABELS } from "@/components/ward-management/ward-bed-states";
import type { Unit } from "@/components/ward-management/ward-model";
import { wardScrollBehavior } from "@/components/ward-management/ward-scroll";
import styles from "./board.module.css";
import {
  BAND_CLASS,
  BOARD_FILTERS,
  BOARD_FILTER_LABELS,
  BOARD_ORDERS,
  BOARD_ORDER_LABELS,
  BOARD_ORDER_NOTES,
  tileClassName,
  tileDomId,
  type BoardFilter,
  type BoardOrder,
  type Occupant,
  type Tile,
} from "./ward-board-model";

import { useState, type Dispatch, type SetStateAction } from "react";
import { Segmented, Select, ShowMoreRow } from "@/components/wf";
import redesign from "./ward-board-panels.module.css";

/** Redesign (Josh, 30 Oct): a phone opens on this many beds, then Show more (owner rule: long lists fold). */
const PHONE_TILE_CAP = 8;

export function WardBoardGridColumn({
  bedFilter,
  bedOrder,
  chooseFilter,
  closeDetail,
  filterCounts,
  filteredTiles,
  cardNameByKey,
  isPhone,
  occupantByKey,
  occupants,
  orderedTiles,
  selectedKey,
  setBedOrder,
  setSelectedKey,
  tileIndexMap,
  tileMatchesFilter,
  tiles,
  unit,
}: {
  bedFilter: BoardFilter;
  bedOrder: BoardOrder;
  /** Sets the filter, and closes a chosen bed the new filter would hide. */
  chooseFilter: (filter: BoardFilter) => void;
  closeDetail: () => void;
  filterCounts: Record<BoardFilter, number>;
  filteredTiles: Tile[];
  /** Lead line per occupied tile: the surname, so a bed is found without opening every card. */
  cardNameByKey: Map<string, string>;
  /** Phone: the filters and order fold into one row of two controls (D-77 change 10, option B). */
  isPhone: boolean;
  occupantByKey: Map<string, Occupant>;
  occupants: Occupant[];
  orderedTiles: Tile[];
  selectedKey: string | null;
  setBedOrder: Dispatch<SetStateAction<BoardOrder>>;
  setSelectedKey: Dispatch<SetStateAction<string | null>>;
  tileIndexMap: Map<Tile, number>;
  tileMatchesFilter: (tile: Tile, filter: BoardFilter) => boolean;
  tiles: Tile[];
  unit: Unit;
}) {
  const [showAllBeds, setShowAllBeds] = useState(false);
  // Redesign: on a phone only the first beds the filter keeps are drawn until Show more; a chosen bed
  // past the fold stays drawn so its sheet and the focus return still have a tile.
  const capped = isPhone && !showAllBeds;
  const drawnKeys = new Set<string>();
  for (const tile of orderedTiles) {
    if (!tileMatchesFilter(tile, bedFilter)) continue;
    if (!capped || drawnKeys.size < PHONE_TILE_CAP || tile.key === selectedKey) drawnKeys.add(tile.key);
  }
  const foldedCount = filteredTiles.length - drawnKeys.size;
  const bedsClass = `${styles.beds} ${redesign.beds}`;
  const countText = (filter: BoardFilter) => (filterCounts[filter] === 0 ? "none" : filterCounts[filter]);
  // Final polish (31 Oct 2026): the kit's select, as the other redesigned pages, in place of the
  // browser's own. Same id, name and spoken label.
  const orderOptions = BOARD_ORDERS.map((order) => (
    <option key={order} value={order}>
      {BOARD_ORDER_LABELS[order]}
    </option>
  ));
  const orderSelect = (
    <select
      id="ward-board-order-select"
      name="wardBoardOrder"
      value={bedOrder}
      onChange={(event) => setBedOrder(event.target.value as BoardOrder)}
      aria-label="Order the beds"
    >
      {orderOptions}
    </select>
  );
  return (
    <div className={styles.gridColumn}>
      {/* ✅ **THE GRID HAD NO HEADING AT ALL** — measured across the whole component, not inferred.
                The drawing names it, and a grid of twenty tiles with nothing above it is unreachable
                for anybody navigating this screen by heading. */}
      <header className={`${styles.sectionHeading} ${redesign.gridHead}`}>
        <h2 id="ward-board-beds-heading">Every bed, and who is in it</h2>
        <span className={`${styles.sectionCount} ${redesign.gridCount}`}>
          Showing {drawnKeys.size} of {tiles.length} beds
        </span>
      </header>
      {isPhone ? (
        <div className={redesign.phoneBar}>
          {/* Final polish: the kit's select for Show; the sort button is still the order select
              itself, drawn as an icon, and its name is unchanged. */}
          <Select
            value={bedFilter}
            onChange={(event) => chooseFilter(event.target.value as BoardFilter)}
            aria-label="Show"
            data-testid="ward-board-filter-select"
          >
            {BOARD_FILTERS.map((filter) => (
              <option key={filter} value={filter}>
                {`${BOARD_FILTER_LABELS[filter]} · ${countText(filter)}`}
              </option>
            ))}
          </Select>
          <span className={styles.phoneSort}>
            {orderSelect}
            <svg
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M7 4v16M7 20l-3-3M7 20l3-3M17 20V4M17 4l-3 3M17 4l3 3" />
            </svg>
          </span>
        </div>
      ) : (
        // Final polish (31 Oct 2026): the filters as the kit's segmented control and Order as the
        // kit's select, as the other redesigned pages, in place of the board's black pills.
        <div className={redesign.boardBar}>
          <Segmented<BoardFilter>
            label="Narrow stays and discharges"
            size="md"
            value={bedFilter}
            onChange={chooseFilter}
            items={BOARD_FILTERS.map((filter) => ({
              id: filter,
              label: BOARD_FILTER_LABELS[filter],
              count: countText(filter),
            }))}
          />
          <label className={redesign.order} htmlFor="ward-board-order-select">
            <span>Order</span>
            <Select
              id="ward-board-order-select"
              name="wardBoardOrder"
              value={bedOrder}
              onChange={(event) => setBedOrder(event.target.value as BoardOrder)}
              aria-label="Order the beds"
              boxClassName={redesign.orderBox}
            >
              {orderOptions}
            </Select>
          </label>
        </div>
      )}
      {/* The legend explains the shades. It is not what makes the board readable without colour —
              the day count on every tile does that — it just saves a reader working the ranges out. */}
      <ul className={styles.legend} data-testid="ward-board-legend">
        {STAY_BANDS.map((band) => (
          <li key={band.id} className={styles.legendItem}>
            <span className={`${styles.legendSwatch} ${BAND_CLASS[band.id]}`} aria-hidden="true">
              <span className={styles.legendGlyph}>●</span>
            </span>
            <span className="sr-only">Stay length: </span>
            {band.label}
          </li>
        ))}
        <li className={styles.legendItem}>
          <span className={`${styles.legendSwatch} ${styles.legendSwatchPast}`} aria-hidden="true">
            <span className={styles.legendGlyph}>▲</span>
          </span>
          <span className="sr-only">Warning: </span>
          Past the ward&apos;s own expected date
        </li>
        {/* Listed beside the stay bands because a reader counting fillable beds needs to know
                this tile exists. The tile says so in words on its own face too — this is the index,
                not the explanation. */}
        <li className={styles.legendItem}>
          <span className={`${styles.legendSwatch} ${styles.legendSwatchBlocked}`} aria-hidden="true">
            <span className={styles.legendGlyph}>■</span>
          </span>
          <span className="sr-only">Out of service: </span>
          Out of service — not fillable
        </li>
        {/* Task B. Same reasoning as the blocked entry just above: the tile itself says
                "Closed" in words, this is only the index. (The `Held` style names predate the
                2026-09-01 ruling that renamed this box Closed; "Held" now means a leave bed only.) */}
        <li className={styles.legendItem}>
          <span className={`${styles.legendSwatch} ${styles.legendSwatchHeld}`} aria-hidden="true">
            <span className={styles.legendGlyph}>○</span>
          </span>
          <span className="sr-only">{BED_STATE_LABELS.closed}: </span>
          Empty, not offered — not fillable
        </li>
      </ul>

      {/*
       * THE TILES ARE NOW BUTTONS, and two things follow that are not negotiable.
       *
       * **The print restore.** `globals.css`'s print reset carries `header, nav, button {
       * display: none !important }`, so an unrestored tile button vanishes from paper and the
       * printed board is an empty grid — the exact defect this branch spent today fixing on
       * four other surfaces. `board.module.css`'s print block forces `.bed` back to
       * `display: flex !important`; a class selector outranks the bare element selector, so the
       * restore holds without touching the global reset.
       *
       * **Still no bed identity.** The button's accessible name is the tile's own content — a
       * day count, or the word Ready / Pulled / Closed / Out of service — and never an ordinal. Nothing
       * numbers these tiles and nothing may. The chosen presentation order changes only the
       * scan order; “Recorded order” restores the source order and none is a floor plan.
       */}
      {/* 🔴 **`<ul>`, NOT `<ol>` — THE GRID ASSERTS NO ORDER BECAUSE IT HAS NONE.** The rule at
                the top of this component says a tile carries no bed identity and that nothing here
                ever has an ordinal to print. `buildTiles` pushes occupants in seed order and then
                `blocked-n`, `closed-n`, `empty-n` — **counts rendered as tiles, with keys that are
                literally `empty-3`.** Reordering two of them changes nothing a reader could read, so
                an ordered list was claiming what the data cannot support.

                ⚠️ **An `<ol>` supplies a position IMPLICITLY**, with no `aria-posinset` anywhere — which
                is how a census of those two attribute names once reported this defect absent from the
                codebase while the grid was it. **Still a list: the tile count is real and a screen
                reader should keep it. Unordered, not unlisted.**

                ⚠️ **The board's other lists are a different matter and were left alone** — the
                destinations and people lists ARE ordered and say so in visible prose. */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- scrollable area: tabIndex lets keyboard users scroll it */}
      <ul className={bedsClass} data-testid="ward-board-beds" aria-label="Beds on this ward" tabIndex={0}>
        {orderedTiles.map((tile) => {
          const index = tileIndexMap.get(tile) ?? tiles.indexOf(tile);
          const selected = tile.key === selectedKey;
          const tileOccupant = occupantByKey.get(tile.key);
          return (
            <li
              key={tile.key}
              className={styles.bedSlot}
              data-testid={`ward-board-bed-${index + 1}`}
              data-bed-kind={tile.kind}
              hidden={!drawnKeys.has(tile.key)}
            >
              <button
                type="button"
                id={tileDomId(tile.key)}
                className={tileClassName(tile, selected)}
                aria-pressed={selected}
                aria-controls={selected ? "ward-board-detail" : undefined}
                onClick={() => {
                  if (selected) return closeDetail();
                  setSelectedKey(tile.key);
                  // Layout sweep WARD-05: on a tablet the record sits under the whole grid, out of
                  // sight, so bring it into view once it has rendered.
                  if (!isPhone)
                    requestAnimationFrame(() => {
                      const detail = document.getElementById("ward-board-detail");
                      if (detail && detail.getBoundingClientRect().top > window.innerHeight)
                        detail.scrollIntoView({ behavior: wardScrollBehavior(), block: "start" });
                    });
                }}
              >
                {tile.kind === "occupied" && (
                  <>
                    {/* UX audit, 21 Oct 2026 (Josh approved): the person leads the card. */}
                    {cardNameByKey.has(tile.key) && (
                      <span
                        className={`${styles.bedName} ${redesign.bedName}`}
                        data-testid={`ward-board-bed-${index + 1}-name`}
                      >
                        {cardNameByKey.get(tile.key)}
                      </span>
                    )}
                    <span className={styles.bedTop}>
                      <span className={styles.bedState}>Occupied</span>
                    </span>
                    <span className={styles.bedFigureRow}>
                      <span className={styles.days} data-testid={`ward-board-bed-${index + 1}-days`}>
                        {tile.days}
                        <span className={styles.daysUnit}> day{tile.days === 1 ? "" : "s"}</span>
                      </span>
                      {tileOccupant !== undefined && (
                        <span className={styles.bedWho}>
                          {tileOccupant.sex} · {tileOccupant.homeRegion ?? "home region not recorded"}
                        </span>
                      )}
                    </span>
                    {/* The stay band as four steps, the legend's own scale. It repeats the band
                            label beside it, so nothing is carried by the bar alone. */}
                    <span className={styles.stayBar} data-band={tile.bandId ?? "none"} aria-hidden="true">
                      <span />
                      <span />
                      <span />
                      <span />
                    </span>
                    <span className={styles.bedNote}>{tile.bandLabel}</span>
                    {/* The band in words, for the screen reader only: the visible number already
                            states it.

                            🔴 **THE ORIGINAL SENTENCE HERE SAID PRINTING BOTH "WOULD CROWD OUT THE NUMBER
                            THIS WHOLE TILE EXISTS TO SHOW". MEASURED IN A BROWSER, THAT IS FALSE.**
                            Revealing the band on every occupied tile: **zero horizontal overflow, and
                            the number's width unchanged to the pixel** (38→38, 19→19).
                            ⚠️ **Both fit.** The tile is not crowded and never was.

                            ✅ **THE REAL COST IS VERTICAL, AND IT IS WHY THE LABEL STAYS `sr-only`:** every
                            occupied tile grows **88px → 117px**, one to 138px, all seventeen — about a
                            third taller, and the grid a third longer. **On a phone that is a materially
                            longer scroll through the beds, and that is the cost we declined.**

                            ⚠️ **THE MEASUREMENT, carried with the conclusion so nobody re-runs it:**
                            Chromium, **375px viewport**, 17 occupied tiles, tile **109×88px**, three
                            columns of 109px. 🔴 **Note 109 and not 80: `minmax(5rem, 1fr)` under
                            `auto-fill` makes 5rem a FLOOR, not the width** — two earlier versions of this
                            comment named 390px and then 80px, and both were wrong.

                            ⚠️ **DESKTOP IS UNMEASURED.** This is a phone cost only; at a wider viewport the
                            same label might cost nothing anybody notices. **Nobody has the desktop
                            answer, and a viewport-conditional label is deliberately NOT explored — a
                            breakpoint-conditional difference is invisible to every gate here.**

                            🔴 **The reason the label stays in that channel at all is an ASYMMETRY OF NEED,
                            untouched by any of the above: a sighted reader sees the number and derives
                            the band; a screen-reader user cannot scan a grid of numbers to form one.** */}
                    <span className="sr-only">{tile.bandLabel}</span>
                    {tile.pastDate && (
                      <span className={styles.pastMark} data-testid={`ward-board-bed-${index + 1}-past`}>
                        <span aria-hidden="true" className={styles.statusGlyph}>
                          ▲{" "}
                        </span>
                        <span>Past date</span>
                      </span>
                    )}
                    {/* Words, never a fill or a colour — the same rule the past-date badge
                            above follows, and for the same reader: greyscale, forced-colors, or
                            paper. The short form is what fits the tile; the full sentence, including
                            that the bed is still theirs, is in the person panel.

                            ⚠️ **This said "a 390px tile" too — same error as the band-label comment
                            above, and the same direction.** The tile is 80px on a phone, not 390px.
                            **Two comments in one component carried the same wrong width**, which is
                            how a number gets believed: it was consistent with itself. */}
                    {tile.awayAtEd && (
                      <span className={styles.awayMark} data-testid={`ward-board-bed-${index + 1}-away`}>
                        <span aria-hidden="true" className={styles.statusGlyph}>
                          ◆{" "}
                        </span>
                        <span>At ED</span>
                      </span>
                    )}
                  </>
                )}
                {/* Rule 2 on screen: taken, but nobody is in it yet — the ruled Pulled box. */}
                {tile.kind === "waiting" && (
                  <>
                    <span className={styles.bedState}>{BED_STATE_LABELS.pulled}</span>
                    <span className={styles.bedNote}>The ward has already given this bed away.</span>
                  </>
                )}
                {/* Rule 1 on screen for the third bed state: the words say it, not the fill. A
                        coordinator reading this board in greyscale, in forced-colors, or on paper
                        must still be able to tell an unfillable bed from a fillable one, and "Out of
                        service" is what does that — the hatched fill only makes it quicker. */}
                {tile.kind === "blocked" && (
                  <>
                    <span className={styles.bedState}>Out of service</span>
                    <span className={styles.bedNote}>Not fillable today.</span>
                  </>
                )}
                {/* Task B on screen: physically empty, but not one of the beds this ward is
                        offering — the ruled Closed box, a different fact from Ready (fillable now)
                        and from "Out of service". The word is what makes it unambiguous; the dotted
                        edge and dot pattern only make it quicker to spot. */}
                {tile.kind === "closed" && (
                  <>
                    <span className={styles.bedState}>{BED_STATE_LABELS.closed}</span>
                    <span className={styles.bedNote}>Empty, not offered.</span>
                  </>
                )}
                {tile.kind === "empty" && (
                  <>
                    <span className={styles.bedState}>Ready</span>
                    <span className={styles.bedNote}>Empty and offered.</span>
                  </>
                )}
                {/* Selection in WORDS, beside the heavier edge that carries it visually. A sheet
                        that has made no decision must not show a filled element — a fill reads as a
                        decision taken — and a weight alone is a mark a greyscale reader can miss. */}
                {selected && <span className={styles.selectedMark}>Selected</span>}
              </button>
            </li>
          );
        })}
      </ul>
      {foldedCount > 0 ? (
        <ShowMoreRow onClick={() => setShowAllBeds(true)}>
          Show {foldedCount} more {foldedCount === 1 ? "bed" : "beds"}
        </ShowMoreRow>
      ) : null}
      {filteredTiles.length === 0 && <p className={styles.filterEmpty}>No bed matches this filter.</p>}

      {/*
       * The arithmetic a ward can do in its head, kept ON SCREEN even though the per-person list
       * has moved to the slide-out and the printed sheet. "18 of this ward's 20 beds are taken"
       * beside a grid of 20 tiles is the check that catches a panel fed the wrong collection —
       * the sibling panel that shipped "Kimberley 28 people" on a twenty-bed ward this morning
       * was invisible in a list and would have been obvious here. Both numbers come from the
       * same two values the grid and the printed list are built from, so no third figure exists
       * to drift.
       */}
      <p className={styles.occupancy} data-testid="ward-board-people-count">
        {occupants.length} of this ward&apos;s {unit.beds} bed{unit.beds === 1 ? "" : "s"}{" "}
        {occupants.length === 1 ? "is" : "are"} taken. {BOARD_ORDER_NOTES[bedOrder]}
      </p>
      {/*
       * THE LINE THAT QUALIFIES EVERY DIAGNOSIS ON THIS PAGE, and it replaced — deliberately,
       * on 2026-08-29 — the sentence that used to stand here saying the record held none.
       *
       * The owner reversed that decision ("It can give a tentative diagnosis. This is because
       * most referrals will require a diagnosis"), so the honest line is no longer about an
       * absence; it is about what the values ARE. It stays in exactly this position, under the
       * grid rather than inside the slide-out, for the reason the old line was put here: it is
       * on the page whether or not anybody has selected a tile, and it prints.
       *
       * It is the ONE place the qualification is stated in full, and every per-person line
       * repeats the word "tentative" rather than relying on a reader having scrolled past this.
       */}
      <p className={styles.peopleAbsence}>
        Any diagnosis shown is tentative: a broad category, not a diagnosis this ward has confirmed.
      </p>
    </div>
  );
}
