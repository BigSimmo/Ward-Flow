"use client";

/**
 * WF-42: `/ward-flow/help` is not a page — Help is a shell sheet. An old or typed URL opens Help
 * on the desk home instead of 404.
 */
import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { openWardHelp } from "@/components/ward-management/help/ward-help-events";

export default function WardHelpRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    // Same order as Activity: settle the URL before Help opens, so Back does not return here.
    const home = "/ward-flow";
    if (typeof window !== "undefined") {
      window.history.replaceState(window.history.state, "", home);
    }
    openWardHelp("tasks");
    router.replace(home);
  }, [router]);
  return (
    <main>
      <p role="status">Opening Help</p>
    </main>
  );
}
