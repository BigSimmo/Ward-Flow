/**
 * Finding 51 (Josh, 27 Oct 2026): Add a patient saves the answer to "Aboriginal or Torres Strait
 * Islander" on `Patient.aboriginalOrTorresStraitIslanderStatus`. It never blocks a registration.
 * The values are the wording the seeded records already hold, so a new record reads the same way.
 */
export const ABORIGINAL_OR_TORRES_STRAIT_ISLANDER_STATUSES = [
  "Aboriginal, not Torres Strait Islander",
  "Torres Strait Islander, not Aboriginal",
  "Aboriginal and Torres Strait Islander",
  "Neither Aboriginal nor Torres Strait Islander",
  "Not stated",
] as const;

export type AboriginalOrTorresStraitIslanderStatus = (typeof ABORIGINAL_OR_TORRES_STRAIT_ISLANDER_STATUSES)[number];
