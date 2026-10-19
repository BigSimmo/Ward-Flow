"use client";

// One row of the Places network list, split out of hub-screen.tsx to keep that file under the
// line cap. Renders what hub-derivations.ts returns; no figure is computed here.
import { memo } from "react";
import { Star } from "lucide-react";
import { SrOnly, StatusGlyph, cx, durMinutes } from "@/components/wf";
import { type HubEntry } from "@/components/ward-management/hub/hub-derivations";
import { BedStrip } from "@/components/ward-management/wards/bed-strip";
import { toggleHubPin } from "@/components/ward-management/hub/hub-browser-memory";
import styles from "./hub.module.css";

export const HubPlaceRow = memo(function HubPlaceRow({
  entry,
  active,
  dimmed,
  pinned,
  isPhone,
  now,
  edWaiting,
  edLongestWaitMinutes,
  onSelect,
}: {
  entry: HubEntry;
  active: boolean;
  dimmed: boolean;
  pinned: boolean;
  isPhone: boolean;
  now: number;
  edWaiting: number;
  edLongestWaitMinutes: number;
  onSelect: (id: string) => void;
}) {
  const wardFigures =
    entry.kind === "ward" && entry.ready !== undefined
      ? {
          ready: entry.ready,
          pulled: entry.pulled ?? 0,
          closed: entry.closed ?? 0,
          occupied: entry.occupied ?? 0,
          pendingPreparation: entry.pendingPreparation,
        }
      : undefined;
  return (
    <li
      className={cx(styles.resultRow, active && styles.resultRowActive)}
      data-dim={dimmed ? "true" : undefined}
      data-hub-row={entry.id}
    >
      <button
        type="button"
        className={styles.resultMain}
        aria-current={active ? "true" : undefined}
        onClick={() => onSelect(entry.id)}
      >
        <span className={styles.resultText}>
          <span className={styles.resultName}>
            {entry.name}
            {/* Phone (v10): a pinned place carries a filled star by its name; pinning is in its sheet. */}
            {isPhone && pinned ? (
              <>
                <Star className={styles.phonePinMark} size={14} aria-hidden="true" />
                <SrOnly>, pinned</SrOnly>
              </>
            ) : null}
          </span>
          <span className={styles.resultSub}>
            {(entry.kind === "ward" ? [entry.site, entry.cohort, entry.security] : [entry.site, entry.service])
              .filter(Boolean)
              .join(" · ")}
          </span>
        </span>
        <span className={styles.resultBeds}>
          {wardFigures === undefined ? null : (
            <>
              <BedStrip bar counts={wardFigures} wardName={entry.name} />
              <span
                className={styles.resultFigures}
                title={`${wardFigures.ready} ready, ${wardFigures.pulled} pulled, ${wardFigures.closed} closed, of ${entry.beds ?? 0} beds`}
              >
                <span aria-hidden="true">
                  {wardFigures.ready}/{wardFigures.pulled}/{wardFigures.closed} of {entry.beds ?? 0}
                </span>
                <SrOnly>
                  {wardFigures.ready} ready, {wardFigures.pulled} pulled, {wardFigures.closed} closed, of{" "}
                  {entry.beds ?? 0} beds
                </SrOnly>
              </span>
              {entry.pendingPreparation === undefined || entry.pendingPreparation === 0 ? null : (
                <span className={styles.resultPrep}>{entry.pendingPreparation} being made ready</span>
              )}
            </>
          )}
        </span>
        <span className={styles.resultConfirmed}>
          {entry.kind === "ed" ? (
            edWaiting > 0 ? (
              <>
                {durMinutes(edLongestWaitMinutes)} <span className={styles.resultAgo}>longest</span>
              </>
            ) : null
          ) : entry.kind !== "ward" || entry.confirmedAt === undefined ? null : entry.stale === true ? (
            <>
              {/* The word, not only the colour — a stale reading must survive a reader who cannot see it. */}
              <StatusGlyph tone="warning" size={8} />
              {durMinutes(now - entry.confirmedAt)} <span className={styles.flagPill}>stale</span>
            </>
          ) : (
            <>
              {durMinutes(now - entry.confirmedAt)} <span className={styles.resultAgo}>ago</span>
            </>
          )}
        </span>
        <span className={styles.resultReady}>
          {entry.kind === "ed" ? (
            <>
              <span className={styles.resultReadyNum}>{edWaiting}</span>
              <span className={styles.resultReadyWord}>waiting</span>
            </>
          ) : entry.kind !== "ward" ? null : entry.ready === undefined ? (
            <span className={styles.resultReadyWord}>Not reported</span>
          ) : (
            <>
              <span className={styles.resultReadyNum}>{entry.ready}</span>
              {/* Phone review F-24: "0 to check" read as a count of checks; the stale flag beside it
                  already says the count needs checking. */}
              <span className={styles.resultReadyWord}>ready</span>
            </>
          )}
        </span>
      </button>
      {/* ⚠️ A sibling of the row button, not a child: a button inside a button is invalid HTML. */}
      {isPhone ? null : (
        <button
          type="button"
          className={cx(styles.pinButton, pinned && styles.pinButtonOn)}
          aria-pressed={pinned}
          aria-label={`${pinned ? "Unpin" : "Pin"} ${entry.name}`}
          onClick={() => toggleHubPin(entry.id)}
        >
          <Star className={styles.pinIcon} size={15} aria-hidden="true" />
        </button>
      )}
    </li>
  );
});
