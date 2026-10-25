import type { WardFeatureFlag } from "./ward-feature-flags";

/**
 * What each feature flag in `ward-feature-flags.ts` is for, who owns it, when it was added and what
 * retires it. Only Settings shows these, so they live here, off every page's first load (phone
 * budget, 22 Oct 2026). The record type makes a missing flag fail the build.
 */
type WardFeatureFlagNote = {
  /** What switching it on adds, in one sentence. */
  description: string;
  /** Who decides when it is finished. */
  owner: string;
  /** The date it was added, so a stale flag is easy to spot. */
  added: string;
  /** What has to happen before the flag and its off path are deleted. */
  removeWhen: string;
};

export const WARD_FEATURE_FLAG_NOTES: Record<WardFeatureFlag, WardFeatureFlagNote> = {
  "bed-meeting-tv": {
    description:
      "Read only, large type screens for the bed meeting, one ward or one ED, linked from the menu, Tools, Capacity, each ward and each ED.",
    owner: "Josh",
    added: "2026-10-15",
    removeWhen: "Josh signs off the TV views after a real bed meeting, ward and ED trial.",
  },
  "demo-reset": {
    description: "Quiet day, winter surge and ED crisis buttons in Tools that reload the whole synthetic network.",
    owner: "Josh",
    added: "2026-10-15",
    removeWhen: "Never in a demonstration build. Keep off in production, where there is no demo data to reset.",
  },
  "role-access": {
    description:
      "Each desk sees only the screens, patients and actions its role needs. Switch desk to see what a ward, ED, team, bed manager, officer, executive or access admin gets.",
    owner: "Josh",
    added: "2026-10-15",
    removeWhen: "The server enforces the same access table (role access plan PR 2) and Josh signs off the roles.",
  },
  "top25-criteria-led-discharge": {
    description:
      "For a voluntary patient, the treating psychiatrist sets discharge criteria and the ward can confirm the discharge once all are met.",
    owner: "Josh",
    added: "2026-10-15",
    removeWhen:
      "Josh signs off the item in the real screens after review, and clinical governance agrees the criteria list.",
  },
  "awol-bed-hold-review": {
    description:
      "The absent without leave tracker asks for a review of the held bed once the person has been away past the set time.",
    owner: "Josh",
    added: "2026-10-17",
    removeWhen: "Josh reviews the bed hold time against local procedure, then keeps or removes the review.",
  },
  "referral-opened-receipts": {
    description: "The referrer sees when a ward first opened a referral.",
    owner: "Josh",
    added: "2026-10-19",
    removeWhen: "Josh agrees the receipt with ward and ED leads.",
  },
  "referral-information-needs": {
    description: "A ward can ask the referrer for listed items before deciding.",
    owner: "Josh",
    added: "2026-10-19",
    removeWhen: "Josh agrees the list of items with ward and ED leads.",
  },
  "ward-closure-mode": {
    description: "Close a whole ward to admissions with a reason, then reopen it.",
    owner: "Josh",
    added: "2026-10-19",
    removeWhen: "Josh agrees the closure reasons with the coordinators.",
  },
  "pilot-measures": {
    description: "The weekly report adds the pilot's agreed measures.",
    owner: "Josh",
    added: "2026-10-19",
    removeWhen: "Josh agrees the measure definitions with the pilot sponsor.",
  },
};
