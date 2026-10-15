import type { Metadata } from "next";

import { BedMeetingTvScreen } from "@/components/ward-management/bed-meeting/bed-meeting-tv";

export const metadata: Metadata = {
  title: "Bed meeting TV - Ward Flow",
  description: "Read only, large type TV views for a meeting room, a ward or an ED. Synthetic data only.",
};

type Param = string | string[] | undefined;
const one = (value: Param) => (typeof value === "string" ? value : undefined);

/** `?ward=` (a unit id) or `?ed=` (an emergency department id) narrows the screen to one place. */
export default async function WardBedMeetingTvPage({
  searchParams,
}: {
  searchParams?: Promise<{ ward?: Param; ed?: Param; tiles?: Param }>;
}) {
  const { ward, ed, tiles } = (await searchParams) ?? {};
  return <BedMeetingTvScreen ward={one(ward)} ed={one(ed)} tiles={one(tiles)} />;
}
