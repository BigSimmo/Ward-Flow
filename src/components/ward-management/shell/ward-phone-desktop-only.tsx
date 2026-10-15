"use client";

import Link from "next/link";
import { Monitor } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { buttonClass, Button } from "@/components/wf";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import {
  WARD_BED_MEETING_TV_HREF,
  WARD_HOME_HREF,
  resolveWardScreenTitle,
} from "@/components/ward-management/ward-nav";
import styles from "./ward-phone-desktop-only.module.css";

/**
 * Phone plan tier 3 (Josh, 8 Oct 2026) gated Governance and Add a patient on a phone with this
 * card. v10 (10 Oct 2026) gave both their own phone layouts (Governance: compact hero, review list
 * and sheets; Add a patient: search first), so neither is gated any more and the list is empty.
 * The card stays mounted for a future wide-only route: add its href here. Statistics was never
 * gated (`tests/ui-ward-statistics-journey.spec.ts`). Hidden above 48rem, so desktop and tablet
 * never see it; Show anyway still opens the page.
 */
const DESKTOP_ONLY_PREFIXES: readonly string[] = [
  // The bed meeting TV view (15 Oct 2026) is a meeting room screen, and is left out of the phone menu.
  WARD_BED_MEETING_TV_HREF,
];

export function isPhoneDesktopOnlyPath(pathname: string): boolean {
  return DESKTOP_ONLY_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function WardPhoneDesktopOnly() {
  const pathname = usePathname() ?? "";
  const { units } = useWardFlowSelect("units");
  const [shownPath, setShownPath] = useState<string | null>(null);
  if (!isPhoneDesktopOnlyPath(pathname) || shownPath === pathname) return null;
  const title = resolveWardScreenTitle(pathname, units);

  return (
    <div className={styles.ground} data-phone-desktop-only>
      <section className={styles.card} aria-labelledby="ward-phone-desktop-only-title">
        <Monitor aria-hidden="true" className={styles.icon} strokeWidth={1.75} />
        <h1 id="ward-phone-desktop-only-title" className={styles.title}>
          {title} needs a larger screen
        </h1>
        <p className={styles.line}>Open it on a tablet or computer.</p>
        <div className={styles.actions}>
          <Link href={WARD_HOME_HREF} className={buttonClass({ variant: "pri" })}>
            Home
          </Link>
          <Button onClick={() => setShownPath(pathname)}>Show anyway</Button>
        </div>
      </section>
    </div>
  );
}
