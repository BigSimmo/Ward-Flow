"use client";

import { StatusGlyph, type WfTone } from "@/components/wf";
import { plural } from "@/components/ward-management/ward-plural";

import styles from "./home.module.css";
import type { ChangesSinceLastLook } from "./since-last-look";
import type { SinceActivityLine } from "./since-last-look-panel";
import {
  acceptanceWithdrawnLinks,
  dischargeMovedLinks,
  SinceRecordLinks,
  type SinceRecordLink,
} from "./since-last-look-links";

// The "Since you last looked" sheet's body, kept apart from `since-last-look-panel.tsx` so a screen
// that shows the Updates count loads the sheet's lines only when it opens (phone script budget,
// PR #1742).

/** One group row of the phone sheet: a glyph, a bold count line, and a quiet detail line. */
type SinceGroup = { key: string; tone: WfTone; title: string; detail?: string; links?: SinceRecordLink[] };

function sinceGroups(changes: ChangesSinceLastLook): SinceGroup[] {
  const groups: SinceGroup[] = [];
  for (const [kind, label] of [
    ["referral", "referral"],
    ["movement", "movement"],
    ["release", "discharge"],
  ] as const) {
    const count = changes.updates?.filter((update) => update.kind === kind).length ?? 0;
    if (count) groups.push({ key: kind, tone: "info", title: `${plural(count, label, `${label}s`)} updated` });
  }
  const bedsTotal = changes.bedsFreed.reduce((sum, entry) => sum + entry.count, 0);
  if (changes.newReferralIds.length > 0) {
    groups.push({
      key: "referrals",
      tone: "info",
      title: plural(changes.newReferralIds.length, "new referral", "new referrals"),
    });
  }
  if (changes.newMovementIds.length > 0) {
    groups.push({ key: "journeys", tone: "neutral", title: `${changes.newMovementIds.length} new movements` });
  }
  if (bedsTotal > 0) {
    groups.push({
      key: "beds",
      tone: "success",
      title: `${bedsTotal} ${bedsTotal === 1 ? "bed" : "beds"} freed`,
      detail: changes.bedsFreed.map((entry) => `${entry.count} at ${entry.unitName}`).join(", "),
    });
  }
  if (changes.newDelays.length > 0) {
    const delayCounts = new Map<string, number>();
    for (const delay of changes.newDelays) delayCounts.set(delay.title, (delayCounts.get(delay.title) ?? 0) + 1);
    groups.push({
      key: "delays",
      tone: "warning",
      title: plural(changes.newDelays.length, "new delay", "new delays"),
      detail: [...delayCounts].map(([title, count]) => `${title}, ${count}`).join(" · "),
    });
  }
  if (changes.newEscalationIds.length > 0) {
    groups.push({
      key: "escalations",
      tone: "warning",
      title: plural(changes.newEscalationIds.length, "new escalation", "new escalations"),
      detail: "No suitable bed",
    });
  }
  groups.push(...closingLoopGroups(changes));
  return groups;
}

/** Closing-the-loop (package E): acceptances withdrawn and discharge dates moved, by ward name. */
function closingLoopGroups(changes: ChangesSinceLastLook): SinceGroup[] {
  const groups: SinceGroup[] = [];
  const wards = (rows: readonly { unitName?: string }[]) =>
    [...new Set(rows.flatMap((row) => (row.unitName ? [row.unitName] : [])))].join(", ") || undefined;
  const withdrawn = changes.acceptanceWithdrawn ?? [];
  if (withdrawn.length > 0) {
    groups.push({
      key: "acceptance-withdrawn",
      tone: "warning",
      title: plural(withdrawn.length, "acceptance withdrawn", "acceptances withdrawn"),
      detail: wards(withdrawn),
      links: acceptanceWithdrawnLinks(changes),
    });
  }
  const moved = changes.dischargeDatesMoved ?? [];
  if (moved.length > 0) {
    groups.push({
      key: "discharge-date-moved",
      tone: "info",
      title: plural(moved.length, "discharge date moved", "discharge dates moved"),
      // Audit three #7: the ward rows under the title name the wards, so no detail line repeats them.
      links: dischargeMovedLinks(changes),
    });
  }
  return groups;
}

/**
 * Phone sheet body (v10 Home phone, "Since you looked"): one card of group rows, each a glyph,
 * a bold count and a quiet detail line. The sheet's own title and description carry the time.
 * A look with nothing new says so in one line; a first look says new events count from the next
 * look. The event-by-event list lives in Activity, never here (it named records by id and read as
 * news under "Nothing new").
 */
export function SinceLastLookSheetBody({
  changes,
}: {
  changes: ChangesSinceLastLook | undefined;
  /** Accepted for the band panel's signature; the phone sheet lists counts only. */
  activity?: readonly SinceActivityLine[];
}) {
  const groups = changes ? sinceGroups(changes) : [];
  const rows: SinceGroup[] =
    groups.length > 0
      ? groups
      : [
          {
            key: "quiet",
            tone: changes ? "success" : "neutral",
            title: !changes
              ? "New events count from your next look"
              : changes.basis === "shift"
                ? "Nothing new since the previous shift started"
                : "Nothing new since you last looked",
            detail: !changes || changes.basis === "shift" ? "This is your first look this session" : undefined,
          },
        ];
  return (
    <ul className={styles.sinceSheetList} data-testid="ward-since-last-look" aria-label="Since you last looked">
      {rows.map((row) => (
        <li key={row.key} className={styles.sinceSheetRow} data-change={row.key}>
          <StatusGlyph tone={row.tone} size={10} />
          <span className={styles.sinceSheetText}>
            <span className={styles.sinceSheetTitle}>{row.title}</span>
            {row.detail ? <span className={styles.sinceSheetDetail}>{row.detail}</span> : null}
            {row.links ? <SinceRecordLinks links={row.links} label={`${row.title}: records`} /> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}
