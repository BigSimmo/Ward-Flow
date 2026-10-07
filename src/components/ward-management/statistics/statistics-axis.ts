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
