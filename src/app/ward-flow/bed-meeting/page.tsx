import type { Metadata } from "next";

import { BedMeetingTvScreen } from "@/components/ward-management/bed-meeting/bed-meeting-tv";

export const metadata: Metadata = {
  title: "Bed meeting TV — Ward Flow",
  description:
    "Read only, large type TV views for the state or a health service bed meeting, a ward or an ED. Synthetic data only.",
};

type Param = string | string[] | undefined;
const one = (value: Param) => (typeof value === "string" ? value : undefined);

/** `?service=` (a health service, or `all`), `?ward=` (a unit id) or `?ed=` (an ED id) picks the screen. */
export default async function WardBedMeetingTvPage({
  searchParams,
}: {
  searchParams?: Promise<{ service?: Param; ward?: Param; ed?: Param }>;
}) {
  const { service, ward, ed } = (await searchParams) ?? {};
  return <BedMeetingTvScreen service={one(service)} ward={one(ward)} ed={one(ed)} />;
}
