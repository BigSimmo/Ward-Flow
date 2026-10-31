"use client";

// One row of the Places directory, split out of hub-screen.tsx to keep that file under the line
// cap. Review point 21 (Josh approved 31 Oct 2026): Places finds a place and opens it, so a row
// carries no bed figures; Capacity's bed map and All wards carry beds. A ward's last confirmation
// stays, and a stale count says so on its row. Renders what hub-derivations.ts returns.
import { memo } from "react";
import { Star } from "lucide-react";
import { SrOnly, StatusGlyph, cx, durMinutes } from "@/components/wf";
import { type HubEntry } from "@/components/ward-management/hub/hub-derivations";
import { toggleHubPin } from "@/components/ward-management/hub/hub-browser-memory";
import { SECURITY_WORD } from "@/components/ward-management/hub/hub-screen-helpers";
import styles from "./hub.module.css";

export const HubPlaceRow = memo(function HubPlaceRow({
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
            {(entry.kind === "ward"
              ? [
                  entry.site,
                  entry.cohort,
                  entry.security === undefined ? undefined : SECURITY_WORD[entry.security],
                  entry.authorised === false ? "Voluntary only" : undefined,
                ]
              : [entry.site, entry.service]
            )
              .filter(Boolean)
              .join(" · ")}
          </span>
        </span>
        <span className={styles.resultConfirmed}>
          {entry.kind !== "ward" || entry.confirmedAt === undefined ? null : entry.stale === true ? (
            <>
              {/* The word, not only the colour — a stale reading must survive a reader who cannot see it. */}
              <StatusGlyph tone="warning" size={8} />
              <span className={styles.flagPill}>Stale</span>
              {durMinutes(now - entry.confirmedAt)}
              <SrOnly>: the ward has not confirmed its bed count in time</SrOnly>
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
