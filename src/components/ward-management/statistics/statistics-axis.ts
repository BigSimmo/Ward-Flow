/**
 * The top of a bar-list axis that is never below the largest value.
 *
 * The kit's `BarList` draws its axis with ticks that stop at the last step at or under the largest
 * value, so 65.6 days drew ticks to 60 and its bar clipped at the track's end. Passing this as
 * `max` rounds the top up to the next step the kit would itself choose, so every bar fits and
 * the tick labels still land on round numbers. Remove once the kit extends its own ticks.
 */
export function axisMax(values: readonly number[], count = 4): number {
  const largest = Math.max(1, ...values);
  const rough = largest / count;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= rough) ?? rough;
  return Math.ceil(largest / step - 1e-9) * step;
}

/**
 * `axisMax` for a count of people: never below 4, so the ticks are whole people (0, 1, 2, 3, 4)
 * rather than quarters of one when the largest count is 1. The kit steps by 2.5 for a top above 8
 * and up to 10, so that range is raised to 12, which the kit ticks in fives.
 */
export function countAxisMax(values: readonly number[]): number {
  const top = axisMax([4, ...values]);
  return top > 8 && top <= 10 ? 12 : top;
}
