/** "6 short" or "3 spare that fit", from a gap where negative is short (WF-16: spare ≠ all ready). */
export function gapWords(gap: number): string {
  if (gap === 0) return "exactly enough";
  return gap < 0 ? `${-gap} short` : `${gap} spare that fit`;
}
