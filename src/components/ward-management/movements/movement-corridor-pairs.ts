import type { CorridorCount } from "./movements-derivations";

/**
 * Accepted corridors merged per ED and ward pair, busiest first (the timeline's Corridors rail and
 * the phone's ED to ward routes sheet). Its own file so the screen can rank pairs without loading
 * the timeline, which is code split (`movement-horizon-gantt-lazy.tsx`).
 */
export function rankCorridorPairs(corridors: CorridorCount[]) {
  const acceptedPairs = new Set(corridors.map((corridor) => `${corridor.originEdId} ${corridor.acceptedUnitId}`));
  return Array.from(acceptedPairs, (key) => {
    const stages = corridors.filter((corridor) => `${corridor.originEdId} ${corridor.acceptedUnitId}` === key);
    return { ...stages[0], count: stages.reduce((total, stage) => total + stage.count, 0), stages };
  }).sort((a, b) => b.count - a.count);
}
