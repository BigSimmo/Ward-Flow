"use client";

// One row of the Places directory (redesign), forked from hub-place-row.tsx. Review point 21: Places
// finds a place and opens it, so a row carries no bed figures; Capacity's bed map and All wards
// carry beds. A ward's last confirmation stays, and a stale count says so on its row.
import { memo } from "react";
import { Star } from "lucide-react";
import { SrOnly, StatusGlyph, cx, durMinutes } from "@/components/wf";
import { type HubEntry } from "@/components/ward-management/hub/hub-derivations";
import { toggleHubPin } from "@/components/ward-management/hub/hub-browser-memory";
import styles from "@/components/ward-management/hub/hub.module.css";

import directory from "./places-redesign.module.css";

export const PlaceRow = memo(function PlaceRow({
  entry,
  active,
  pinned,
  isPhone,
  now,
  onSelect,
}: {
  entry: HubEntry;
  active: boolean;
  pinned: boolean;
  isPhone: boolean;
  now: number;
  onSelect: (id: string) => void;
}) {
  return (
    <li className={cx(styles.resultRow, active && styles.resultRowActive)} data-hub-row={entry.id}>
      <button
        type="button"
        className={cx(styles.resultMain, directory.rowMain)}
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
            {(entry.kind === "ward"
              ? [entry.site, entry.cohort, entry.security, entry.authorised === false ? "Voluntary only" : undefined]
              : [entry.site, entry.service]
            )
              .filter(Boolean)
              .join(" · ")}
          </span>
        </span>
        <span className={cx(styles.resultConfirmed, directory.rowConfirmed)}>
          {entry.kind !== "ward" || entry.confirmedAt === undefined ? null : entry.stale === true ? (
            <>
              {/* The word, not only the colour — a stale reading must survive a reader who cannot see it. */}
              <StatusGlyph tone="warning" size={8} />
              <span className={styles.flagPill}>Stale count</span>
              {durMinutes(now - entry.confirmedAt)}
            </>
          ) : (
            <>
              {durMinutes(now - entry.confirmedAt)} <span className={styles.resultAgo}>ago</span>
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
