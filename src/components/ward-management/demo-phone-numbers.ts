/**
 * A15-19 (Josh, 13 Nov 2026): the one place that hands out invented landline numbers.
 *
 * Every invented landline in Ward Flow is in the ACMA range kept for fiction, (08) 5550 xxxx, so it
 * cannot reach a real person or service (A15-14 retired the old (08) 0000 exchange, which the app's
 * own synthetic-data guard did not treat as fictional). Each seed file owns one block of that range,
 * so two files can never hand out the same number under two different names.
 * `tests/ward-fix-F2-phone-and-email.test.ts` reads every number in `src/` and checks it sits in the
 * block of the file it is typed in, and that no number sits under two names.
 *
 * A file named under a block may also quote that block's numbers (the community contact mapping
 * explains which reference team's line it chose). Nothing else may.
 */

export const DEMO_LANDLINE_EXCHANGE = "08 5550";

type Block = { readonly first: number; readonly last: number; readonly files: readonly string[] };

/** Paths are relative to `src/components/ward-management/`. Blocks never overlap. */
export const DEMO_NUMBER_BLOCKS = {
  /** Generated from the reference pack (scripts/ward-flow/build-reference-teams.mjs). */
  referenceTeams: {
    first: 100,
    last: 199,
    files: ["reference/ward-reference-teams.ts", "community/community-team-contact-mapping.ts"],
  },
  settingsProfile: { first: 200, last: 299, files: ["settings/settings-profile.ts"] },
  midlandDemo: { first: 500, last: 599, files: ["community/team-2026/midland-demo.ts"] },
  referralDossiers: { first: 600, last: 899, files: ["ward-referral-dossier-seed.ts"] },
  patientsSeed: { first: 900, last: 999, files: ["ward-patients-seed.ts"] },
  onCallDirectory: { first: 1000, last: 1999, files: ["on-call/on-call-directory.ts"] },
  referralIntake: { first: 2000, last: 2099, files: ["ward-referral-intake-seed.ts"] },
  patientRecords: { first: 3000, last: 4999, files: ["patients/patient-record-extras.ts"] },
} as const satisfies Record<string, Block>;

export type DemoNumberBlock = keyof typeof DEMO_NUMBER_BLOCKS;

/** The invented landline at `offset` in a file's block, e.g. "08 5550 1001". Throws past the block. */
export function demoLandline(block: DemoNumberBlock, offset: number): string {
  const { first, last } = DEMO_NUMBER_BLOCKS[block];
  const serial = first + offset;
  if (!Number.isInteger(offset) || offset < 0 || serial > last)
    throw new Error(`${block} has no number at offset ${offset}: its block is ${first} to ${last}.`);
  return `${DEMO_LANDLINE_EXCHANGE} ${String(serial).padStart(4, "0")}`;
}

/** The four-digit serial of an invented landline in any written form, or null when it is not one. */
export function demoLandlineSerial(number: string): number | null {
  const digits = number.replace(/\D/gu, "");
  const match = /^(?:61|0)?85550(\d{4})$/u.exec(digits);
  return match ? Number(match[1]) : null;
}

/** The block a serial belongs to, or null when no block covers it. */
export function demoNumberBlockOf(serial: number): DemoNumberBlock | null {
  for (const [name, block] of Object.entries(DEMO_NUMBER_BLOCKS) as [DemoNumberBlock, Block][])
    if (serial >= block.first && serial <= block.last) return name;
  return null;
}
