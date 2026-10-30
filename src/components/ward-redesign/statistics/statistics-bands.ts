// Moved out of the Statistics fork to keep it under the line cap; unchanged from statistics-screen.tsx.
export const hoursLabel = (minutes: number) => `${Math.round(minutes / 60)}h`;

/**
 * Pull to arrival, banded against the configured pull hold rather than typed hours: under half the
 * hold, the rest of the hold, up to twice the hold, and longer.
 */
export function arrivalBandsFor(holdMinutes: number): Array<{ id: string; label: string; from: number; to: number }> {
  const half = holdMinutes / 2;
  const twice = holdMinutes * 2;
  return [
    { id: "half-hold", label: `Under ${hoursLabel(half)}`, from: 0, to: half },
    { id: "hold", label: `${hoursLabel(half)} to ${hoursLabel(holdMinutes)}`, from: half, to: holdMinutes },
    { id: "twice-hold", label: `${hoursLabel(holdMinutes)} to ${hoursLabel(twice)}`, from: holdMinutes, to: twice },
    { id: "longer", label: `Over ${hoursLabel(twice)}`, from: twice, to: Number.POSITIVE_INFINITY },
  ];
}
