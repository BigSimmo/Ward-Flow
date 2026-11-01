"use client";

/**
 * The four "whose move" tiles above the Waiting table. Round 5 (Josh, 31 Oct 2026): clearer on a
 * laptop. Each tile says how long its longest wait is, names its key fact and how many are over 8h,
 * and one quiet key under the tiles says what the bar's colours mean and that a tile filters the
 * list. No coloured edges: tone is the status glyph by the fact. The phone keeps its sliding chips.
 */
import { splitDuration } from "@/components/ward-management/ward-clock";
import { H8, OVER_8H, WAIT_BANDS, type OwnerTile } from "./delays-board-model";
import { BandBar, Glyph } from "./delays-board-parts";
import type { DelayOwnerId } from "./delays-derivations";
import { phoneRows } from "@/components/wf";
import board from "./delays-board.module.css";
import waitingKeys from "./waiting.module.css";
import styles from "./waiting-polish.module.css";

export function WaitingOwnerTiles({
  tiles,
  pressed,
  isPhone,
  onPress,
}: {
  tiles: OwnerTile[];
  pressed: DelayOwnerId | null;
  isPhone: boolean;
  onPress: (owner: DelayOwnerId) => void;
}) {
  return (
    <section
      // Phone (Josh, 31 Oct 2026): one sliding row with Home's fade, in place of two by two.
      className={`${board.card} ${phoneRows.chipRow} ${isPhone ? board.owners : styles.owners}`}
      aria-label="Whose move"
      data-ward-primitive="panel"
    >
      <div className={isPhone ? styles.ownContents : styles.ownGrid}>
        {tiles.map((tile) => {
          const longest = tile.rows.reduce((most, row) => Math.max(most, row.waited), 0);
          const over8 = tile.rows.filter((row) => row.waited >= OVER_8H).length;
          return (
            <button
              key={tile.owner}
              type="button"
              className={`${board.own} ${phoneRows.chip} ${styles.own} ${tile.rows.length === 0 ? phoneRows.zero : ""}`}
              aria-pressed={pressed === tile.owner}
              onClick={() => onPress(tile.owner)}
              data-testid={`delays-owner-${tile.owner}`}
            >
              <span className={`${board.ownTop} ${waitingKeys.countFirst} ${styles.ownTop}`}>
                <b className={board.num}>{tile.rows.length}</b>
                <span className={board.ownName}>{tile.name}</span>
                {isPhone || tile.rows.length === 0 ? null : (
                  <span className={styles.ownLongest}>
                    longest <b className={board.num}>{splitDuration(longest)}</b>
                  </span>
                )}
              </span>
              <BandBar bands={tile.bands} />
              {/* Audit 11 Oct 2026, phone: one count per chip; the glyph alone flags the sub fact. */}
              {isPhone ? (
                tile.sub.count > 0 ? (
                  <small>
                    <Glyph tone={tile.sub.tone} />
                    <span className="sr-only">{`${tile.sub.count} ${tile.sub.text}`}</span>
                  </small>
                ) : null
              ) : (
                <small className={styles.ownFacts}>
                  <span>
                    <Glyph tone={tile.sub.count > 0 ? tile.sub.tone : undefined} />
                    <b className={board.ownSubCount}>{tile.sub.count}</b>
                    {` ${tile.sub.text}`}
                  </span>
                  {tile.sub.text === `over ${H8}` || tile.sub.text === "waiting" || over8 === 0 ? null : (
                    <span>
                      <Glyph tone="warning" />
                      <b className={board.ownSubCount}>{over8}</b>
                      {` over ${H8}`}
                    </span>
                  )}
                </small>
              )}
            </button>
          );
        })}
      </div>
      {isPhone ? null : (
        <p className={styles.ownKey}>
          <span className={styles.ownKeyBands} aria-hidden="true">
            {WAIT_BANDS.map((band, index) => (
              <span key={band}>
                <i className={board[`band${index}`]} />
                {band}
              </span>
            ))}
          </span>
          <span>Choose a group to show only its people.</span>
        </p>
      )}
    </section>
  );
}
