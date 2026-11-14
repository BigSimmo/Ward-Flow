/**
 * Labels for the sample day's choices that no one has signed, so a screen says so beside the figure
 * instead of letting a sample read as guidance. Synthetic data only.
 *
 * - The observation mix (D-189 item 2, Josh 13 Nov 2026; Q23 of the clinical sign-off sitting): the
 *   sample day's observation levels are a sample mix until Josh sets one. No level changes.
 * - The length-of-stay spread (D-181 item 8) is also a sample choice. Its note sits with the spread
 *   itself (`rearrangedForWard`, `ward-admissions-seed.ts`); no screen labels it yet.
 */

/** Beside the ward page's constant observation figure, and in its footer note. */
export const SAMPLE_OBSERVATION_MIX_LABEL = "Sample mix, not clinical guidance";
