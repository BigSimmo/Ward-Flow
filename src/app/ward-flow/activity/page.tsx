"use client";

/**
 * WF-42: `/ward-flow/activity` is not a page — Activity is a shell panel. An old or typed URL
 * opens that panel on the desk home instead of 404.
 */
import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { openActivityPanel } from "@/components/ward-management/shell/ward-activity-panel-store";

export default function WardActivityRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    openActivityPanel({ tab: "notices" });
    router.replace("/ward-flow");
  }, [router]);
  return (
    <main>
      <p role="status">Opening Activity</p>
    </main>
  );
}
