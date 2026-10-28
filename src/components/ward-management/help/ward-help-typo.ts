/**
 * Typo tolerance for Help search (P9), with no dependency. Distance counts one inserted, removed,
 * changed or swapped letter (optimal string alignment), so "trasnport" and "handovr" are one away.
 */
export function editDistance(a: string, b: string, max = Number.POSITIVE_INFINITY): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let before: number[] = [];
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    let rowBest = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) value = Math.min(value, before[j - 2] + 1);
      current.push(value);
      rowBest = Math.min(rowBest, value);
    }
    if (rowBest > max) return max + 1;
    before = previous;
    previous = current;
  }
  return previous[b.length];
}

/** How many slips a word may hold: none under 4 letters, 1 up to 6, then 2. */
export function allowedSlips(word: string): number {
  if (word.length < 4) return 0;
  return word.length <= 6 ? 1 : 2;
}

/**
 * The known word closest to `word`, or `word` itself when it is known or nothing is near enough.
 * Ties keep the vocabulary's own order, so the same typo always gives the same word.
 */
export function nearestWord(word: string, vocabulary: readonly string[], known: ReadonlySet<string>): string {
  if (known.has(word)) return word;
  const max = allowedSlips(word);
  if (!max) return word;
  let best = word;
  let bestDistance = max + 1;
  for (const candidate of vocabulary) {
    if (candidate.length < 4) continue;
    const distance = editDistance(word, candidate, max);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
      if (distance === 1) break;
    }
  }
  return best;
}
