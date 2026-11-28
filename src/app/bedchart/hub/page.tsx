import type { Metadata } from "next";

import { FindScreen } from "@/components/ward-management/hub/find-screen";

export const metadata: Metadata = {
  title: "Find — BedChart",
  description:
    "Synthetic prototype: find a person, a ward, an emergency department or a community team from one page, one tab each.",
};

/**
 * Find (mock-up, 26 Nov 2026): the Places address holds Search, All wards, All EDs and the community
 * teams index as four tabs. `?tab=wards|eds|teams`; no tab is People. The tab is read here, on the
 * server, so the first paint is the right page; each tab is a link, so switching is a history entry.
 */
export default async function FindPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { tab } = await searchParams;
  const known = tab === "wards" || tab === "eds" || tab === "teams" || tab === "suburbs" ? tab : "people";
  return <FindScreen tab={known} />;
}
