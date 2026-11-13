// "What would help tomorrow" (Capacity issue 3, Josh, 3 Nov 2026): its rows and tags, shared by the
// Forecast card on the page and the Beds ahead drawer. Kept apart from the drawer's chart so the
// drawer can load only when it opens (phone size limit, 13 Nov 2026).

import type { ForecastLever } from "@/components/ward-management/forecast/forecast-levers";
import { tallyBarriers } from "./capacity-held-up";
import { isConfirmationFresh } from "./capacity-gap-words";
import type { HelpItem } from "./capacity-lever-popup";
import type { NetworkWardRow } from "./capacity-derivations";

export function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/**
 * The rows of "What would help tomorrow": the forecast's levers, then two of the page's own
 * (Capacity issue 3, Josh, 3 Nov 2026): ward counts past their threshold, and beds being made
 * ready. Each opens its pop-up.
 */
export function helpItems(levers: readonly ForecastLever[], rows: readonly NetworkWardRow[], now: number): HelpItem[] {
  const items: HelpItem[] = levers.map((lever) =>
    lever.kind === "clear_held_up"
      ? {
          kind: lever.kind,
          // A16-25: due by tomorrow (overdue included), unlike the hero's held-up count on any date.
          title: `Chase ${plural(lever.beds, "held-up discharge", "held-up discharges")} due by tomorrow`,
          uplift: lever.likelyUplift,
          detail: tallyBarriers(lever.reasons)
            .map((entry) => `${entry.label} ${entry.count}`)
            .join(", "),
        }
      : lever.kind === "confirm_dates"
        ? {
            kind: lever.kind,
            title: `Confirm ${plural(lever.beds, "discharge", "discharges")} on ${plural(lever.wards.length, "ward", "wards")}`,
            uplift: lever.likelyUplift,
            detail: lever.wards.join(", "),
          }
        : {
            kind: lever.kind,
            // A16-19: what it counts, so it does not read against Discharges' "dates overdue", which
            // also holds the held-up ones and closed wards' dates.
            title: `Review ${plural(lever.beds, "overdue discharge", "overdue discharges")} not held up`,
            uplift: 0,
            detail: "Open wards only. Dates passed: they widen the range only",
          },
  );
  const stale = rows.filter((row) => !isConfirmationFresh(row.unit, now));
  if (stale.length > 0) {
    items.push({
      kind: "stale_counts",
      title: `Refresh ${plural(stale.length, "ward count", "ward counts")}`,
      rows: [...stale].sort((x, y) => x.confirmedAt - y.confirmedAt),
    });
  }
  const preparing = rows.filter((row) => (row.pendingPreparation ?? 0) > 0);
  if (preparing.length > 0) {
    const beds = preparing.reduce((sum, row) => sum + (row.pendingPreparation ?? 0), 0);
    items.push({
      kind: "being_made_ready",
      title: `Finish ${plural(beds, "bed", "beds")} being made ready`,
      rows: preparing,
    });
  }
  return items;
}

export function tagText(item: HelpItem): string {
  if (item.kind === "stale_counts") return "check";
  // A bed being made ready already counts as ready (owner, 1 Sep 2026), so finishing it is a task,
  // not an uplift to tomorrow's figure.
  if (item.kind === "being_made_ready") return "task";
  return item.uplift > 0 ? `up to +${item.uplift}` : "range only";
}

export function tagTone(item: HelpItem): boolean {
  if (item.kind === "stale_counts") return false;
  if (item.kind === "being_made_ready") return false;
  return item.uplift > 0;
}
