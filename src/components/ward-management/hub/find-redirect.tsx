"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { useCanOpenHref } from "@/components/ward-management/shell/ward-access";

import { PLACES_HREF } from "./places-hrefs";
import { findHref, type FindTab } from "./find-tabs";

/**
 * Find (mock-up, 26 Nov 2026): the old index pages hand over to their Find tab. The desk's access is
 * known only in the browser, so this replaces the address (Back skips the old page) only when the desk
 * may open Find; a desk gated off Find keeps the old page, as before. The page shows until then.
 */
export function RedirectToFind({ tab, children }: { tab: FindTab; children: ReactNode }) {
  const router = useRouter();
  const canOpen = useCanOpenHref();
  const go = canOpen(PLACES_HREF);
  useEffect(() => {
    if (go) router.replace(findHref(tab));
  }, [go, router, tab]);
  return <>{children}</>;
}
