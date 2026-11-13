import type { Movement } from "@/components/ward-management/ward-model";

/**
 * D-170 item 4 (Josh, 13 Nov 2026), as a rule for every sample ED stay rather than an edit to each
 * record: a sample person whose current form is a Form 4A and who has no examination recorded is
 * "Referred for psychiatric examination", not "Involuntary inpatient". Only sample data changes.
 *
 * Narrow on purpose. It touches only that one pairing and leaves every other legal status rule
 * alone, including the generator's 9 Oct 2026 rule that an arrived person is an involuntary
 * inpatient (`routineMovements`, `ward-movements.ts`): which status goes with which form is Josh's
 * clinical call (A16-15), and this applies only the pairing he ruled on.
 */
export function withSampleLegalStatusFromForm<T extends Movement>(movement: T): T {
  if (
    movement.legalForm?.code === "4A" &&
    movement.examination === undefined &&
    movement.legalStatus === "Involuntary inpatient"
  ) {
    return { ...movement, legalStatus: "Referred for psychiatric examination" };
  }
  return movement;
}
