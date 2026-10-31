import type { BedRelease } from "@/components/ward-management/ward-model";
import { durMinutes } from "@/components/wf";
import { BLOCKER_CATEGORIES, barrierCategory, barrierLabel, type GroupKey } from "./discharge-board-model";

/**
 * The one action a bed release row offers, named for what it needs next (approved 31 Oct 2026). Each
 * opens the release's panel on the part it names (Chase: its barriers; Confirm date: the expected
 * departure date), so no button here records anything on its own.
 *
 * `canChangeDate`: only the ward or the coordinator can change an expected date (`canChange` in
 * discharge-dependencies-panel.tsx). The site bed manager cannot, so there an expected release offers
 * Open, on its milestones, rather than a Confirm date that would open no date control (Josh, 30 Oct).
 */
export function releaseActionLabel(release: Pick<BedRelease, "state" | "blocker">, canChangeDate = true): string {
  if (release.blocker !== null) return "Chase";
  if (release.state === "expected" && canChangeDate) return "Confirm date";
  return "Open";
}

/** The part of the release panel a row's action opens on. */
export type ReleasePanelPart = "milestones" | "barriers" | "date";

export function releaseActionPart(
  release: Pick<BedRelease, "state" | "blocker">,
  canChangeDate = true,
): ReleasePanelPart {
  if (release.blocker !== null) return "barriers";
  if (release.state === "expected" && canChangeDate) return "date";
  return "milestones";
}

/**
 * Josh, 30 Oct: one word for a release with a recorded blocker, "Held up" (WT-17's word, and
 * Capacity's). The model keeps `blocked` as its own key; only the words on screen change.
 */
export const HELD_UP = "Held up";

/** Group headings on this page: "Held up" for the model's `blocked` group. */
export const GROUP_TITLES: Record<GroupKey, string> = {
  blocked: HELD_UP,
  confirmed: "Confirmed",
  expected: "Expected",
  "discharged-today": "Discharged in last 24 hours",
};

/** Phone group headings: as above, with the 24 hours said short. */
export const PHONE_GROUP_TITLES: Record<GroupKey, string> = {
  ...GROUP_TITLES,
  "discharged-today": "Discharged · 24h",
};

/** Josh, 30 Oct: the held-up and discharged groups lose their sentence; the other two keep theirs. */
export const GROUP_NOTES: Partial<Record<GroupKey, string>> = {
  confirmed: "Waiting only on the clock, not held up.",
  expected: "Not yet confirmed by the ward, and not held up.",
};

/** Rows a group shows before its Show more row, on every width (Josh, 30 Oct: as the phone does). */
export const GROUP_CAP = 6;

/** "2d past", not "2d 0h past": a zero unit is dropped (Josh, 30 Oct). */
export function pastWords(minutes: number): string {
  return `${durMinutes(minutes).replace(/ 0h$/, "")} past`;
}

/**
 * The held-up figure, by reason. THE reference derivation for this page and Capacity (Josh, 30 Oct):
 * the releases in scope with a recorded blocker, whatever their date and stage, that have not been
 * discharged. That set is exactly `groupDischarges(scopedReleases, now, { heldUpAnyDate: true }).blocked`
 * (`discharge-board-model.ts`), which the hero chip counts, so the panel total and the chip can never
 * differ. Reasons are named by `barrierCategory` and `barrierLabel` from the same model.
 */
export function heldUpByReason(heldUp: readonly BedRelease[]): { id: string; label: string; count: number }[] {
  return [...BLOCKER_CATEGORIES.map((category) => category.id), "other"]
    .map((id) => ({
      id,
      label: barrierLabel(id),
      count: heldUp.filter((release) => release.blocker !== null && barrierCategory(release.blocker) === id).length,
    }))
    .sort((a, b) => b.count - a.count);
}
