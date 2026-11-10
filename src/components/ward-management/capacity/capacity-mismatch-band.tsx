/** "A locked adult bed" to "Locked adult": the card title names the bed type only. */
export function shortNeed(need: string): string {
  const core = need.replace(/^an? /i, "").replace(/ bed$/, "").replace("-", " ");
  return core.charAt(0).toUpperCase() + core.slice(1);
}
