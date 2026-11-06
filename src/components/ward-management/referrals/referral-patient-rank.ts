import { foldPatientSearchText } from "@/components/ward-management/ward-patients";

/**
 * F6 (audit, 5 Nov 2026): New referral's patient search lists family names that start with the
 * typed text first, then given names that start with it, then every other match, each group in its
 * original order. `name` is "Family, Given". Typing "Ridge" lists Ridgewell before Slateridge.
 */
export function rankByNameStart<T extends { name: string }>(items: readonly T[], query: string): T[] {
  const needle = foldPatientSearchText(query.replace(/,/g, " "));
  if (!needle) return [...items];
  const tier = ({ name }: T) => {
    const [family = "", given = ""] = name.split(",").map(foldPatientSearchText);
    if (family.startsWith(needle)) return 0;
    if (given.startsWith(needle)) return 1;
    return 2;
  };
  return items
    .map((item, index) => ({ item, index, rank: tier(item) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map(({ item }) => item);
}
