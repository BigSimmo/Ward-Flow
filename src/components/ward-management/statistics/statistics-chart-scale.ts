/** Zero-based, readable ticks. Counts never acquire fractional people or beds. */
export function statisticsChartScale(value: number, integer = true) {
  const highest = Number.isFinite(value) && value > 0 ? value : 1;
  const roughStep = highest / 4;
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const multiple = [1, 2, 5, 10].find((step) => step * magnitude >= roughStep) ?? 10;
  const step = Math.max(integer ? 1 : 0.01, multiple * magnitude);
  const maximum = Number((Math.ceil(highest / step) * step).toPrecision(12));
  const ticks = Array.from({ length: Math.round(maximum / step) + 1 }, (_, index) =>
    Number((index * step).toPrecision(12)),
  );
  return { maximum, ticks };
}
