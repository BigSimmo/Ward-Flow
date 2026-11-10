"use client";

import { useOptionalWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { useNextNavCounts } from "@/components/ward-management/shell-next/next-nav-counts";
import { CountChip } from "@/components/ward-management/shell/ward-phone-menu-parts";
import styles from "./ward-global-search.module.css";

/**
 * Search Go to tiles carry the same figure as the phone dock and rail (Josh, 10 Nov 2026, "add
 * smart, high-yield features to search"): the screen's own lead count, in its own words (rule A2).
 * Capacity's free-bed figure is left off, as it is on the dock (D-112). Outside the ward data
 * (a bare search in a test, the public search) there is no count, so nothing shows.
 */
const COUNTED_VIEWS = new Set(["delays", "referrals", "movements"]);

type Props = { id: string; spoken?: boolean };

/** The number on the tile's corner, or (`spoken`) the same figure in words for the link's name. */
export function ViewCount({ id, spoken = false }: Props) {
  const hasWardData = useOptionalWardFlowSelect("movements") !== null;
  if (!hasWardData || !COUNTED_VIEWS.has(id)) return null;
  return <CountedView id={id} spoken={spoken} />;
}

function CountedView({ id, spoken }: Props) {
  const { counts } = useNextNavCounts();
  const count = counts[id as keyof typeof counts];
  if (!spoken) return <CountChip value={count?.value} className={styles.viewCount} />;
  if (!count) return null;
  return <span className="sr-only">{`, ${count.value} ${count.noun}`}</span>;
}
