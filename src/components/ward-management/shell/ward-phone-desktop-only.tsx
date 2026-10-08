"use client";

import Link from "next/link";
import { Monitor } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { buttonClass, Button } from "@/components/wf";
import { useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { WARD_HOME_HREF, resolveWardScreenTitle } from "@/components/ward-management/ward-nav";
import styles from "./ward-phone-desktop-only.module.css";

/**
 * Phone plan tier 3 (Josh, 8 Oct 2026): pages built for a wide screen. On a phone a direct link
 * shows this card instead of a broken layout; Show anyway still opens the page. Hidden above
 * 48rem, so desktop and tablet never see it.
 */
const DESKTOP_ONLY_PREFIXES = [
  "/mockups/ward-flow/statistics",
  "/mockups/ward-flow/governance",
  "/mockups/ward-flow/people/new",
  "/mockups/ward-flow/sovereign",
] as const;

export function isPhoneDesktopOnlyPath(pathname: string): boolean {
  return DESKTOP_ONLY_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function WardPhoneDesktopOnly() {
  const pathname = usePathname() ?? "";
  const { units } = useWardFlow();
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
