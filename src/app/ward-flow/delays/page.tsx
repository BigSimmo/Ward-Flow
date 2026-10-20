import { redirect } from "next/navigation";

import { querySuffix } from "@/components/ward-management/shell/ward-record-address";

type DelaysRedirectProps = { searchParams?: Promise<Record<string, string | string[] | undefined>> };

/**
 * B4 step 3 (Josh, 19 Oct 2026) renamed Delays to Waiting. This route stays so an existing
 * bookmark or shared link still opens the list, with its filters and view (`?view=`, `?owner=`…)
 * carried across.
 */
export default async function WardDelaysRedirect({ searchParams }: DelaysRedirectProps) {
  redirect(`/ward-flow/waiting${querySuffix(await searchParams)}`);
}
