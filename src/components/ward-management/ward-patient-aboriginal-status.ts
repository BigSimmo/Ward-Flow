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

/**
 * M119 (master audit list, D-123): the short identity label a record preview may show, worded as
 * recorded. Only the three statuses that record an identity get a label; "Neither", "Not stated",
 * an empty answer or any unknown text show nothing, so the app never shortens an answer into a
 * different meaning.
 */
const IDENTITY_LABELS: Readonly<Partial<Record<string, string>>> = {
  "Aboriginal, not Torres Strait Islander": "Aboriginal",
  "Torres Strait Islander, not Aboriginal": "Torres Strait Islander",
  "Aboriginal and Torres Strait Islander": "Aboriginal and Torres Strait Islander",
};

export function aboriginalOrTorresStraitIslanderIdentityLabel(status: string | undefined): string | undefined {
  // Own keys only, so a malformed status such as "toString" never reaches the screen.
  return status !== undefined && Object.hasOwn(IDENTITY_LABELS, status) ? IDENTITY_LABELS[status] : undefined;
}
