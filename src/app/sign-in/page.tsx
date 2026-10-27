import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { FrontDoorPage } from "@/components/front-door/front-door-page";
import { WARD_BED_MEETING_TV_HREF } from "@/components/ward-management/ward-nav";
import { frontDoorRequired, safeNextPath } from "@/lib/front-door-pass";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign in — Ward Flow",
  description: "Sign in to Ward Flow, a prototype with synthetic data.",
};

/**
 * The front door's own page (see `@/lib/front-door-pass`). A sibling of `/ward-flow`, so it carries
 * no rail or bar. It only exists while the `WARD_FRONT_DOOR` switch is on; otherwise the app's own
 * signed-out screen is the front door, and this address simply opens Ward Flow.
 */
export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const { next } = await searchParams;
  const target = safeNextPath(typeof next === "string" ? next : null);
  if (!frontDoorRequired()) redirect(target);
  const shared = process.env.NEXT_PUBLIC_WARD_SHARED_ENABLED === "true";
  const tv = target.split("?")[0] === WARD_BED_MEETING_TV_HREF;
  return <FrontDoorPage next={target} mode={shared ? "account" : "demo-code"} tv={tv} />;
}
