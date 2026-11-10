"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

import styles from "./ward-bar-page-tools.module.css";

/** The empty slot `WardBar` renders beside the service badge for a page's own header tools. */
export const WARD_BAR_PAGE_TOOLS_ID = "ward-bar-page-tools";

const subscribeNever = () => () => {};
const findSlot = () => document.getElementById(WARD_BAR_PAGE_TOOLS_ID);
const noSlotOnServer = () => null;

/**
 * Page tools in the header (owner, 9 Oct 2026: each page's header carries its own useful tools).
 * The bar lives in the ward layout and the page below it, so a page portals its tools into the
 * slot the bar leaves for them. Desktop only: the slot is hidden on a phone, where the page keeps
 * the same actions in its own hero. Without a bar (a page rendered alone in a test) nothing shows.
 */
export function WardBarPageTools({ label, children }: { label: string; children: ReactNode }) {
  const host = useSyncExternalStore(subscribeNever, findSlot, noSlotOnServer);
  if (!host) return null;
  return createPortal(
    <div role="group" aria-label={label} className={styles.tools}>
      {children}
    </div>,
    host,
  );
}

/**
 * A page's own name for the bar while one of its views is open (page tops, 10 Nov 2026: Legal
 * forms' Seclusion tab names the bar "Seclusion"). The name carries the path it was set on, so a
 * name left behind never shows on another page. Wording only: nothing else in the bar changes.
 */
type PageTitle = { pathname: string; title: string };
let pageTitle: PageTitle | undefined;
const titleListeners = new Set<() => void>();
const setPageTitle = (next: PageTitle | undefined) => {
  pageTitle = next;
  titleListeners.forEach((listener) => listener());
};
const subscribeTitle = (listener: () => void) => {
  titleListeners.add(listener);
  return () => titleListeners.delete(listener);
};
const readTitle = () => pageTitle;
const noTitleOnServer = () => undefined;

/** Page side: name the bar `title` while mounted on `pathname`; `undefined` keeps the route's name. */
export function useWardBarPageTitle(pathname: string, title: string | undefined) {
  useEffect(() => {
    if (title === undefined) {
      // A name handed over for this path (`presetWardBarPageTitle`) does not outlive its view.
      if (pageTitle?.pathname === pathname) setPageTitle(undefined);
      return;
    }
    const own = { pathname, title };
    setPageTitle(own);
    return () => {
      if (pageTitle === own) setPageTitle(undefined);
    };
  }, [pathname, title]);
}

/**
 * A route that hands over to `pathname` names its bar ahead of the page (phone load audit, 10 Nov
 * 2026: the old Seclusion address flipped the bar Seclusion, Legal forms, Seclusion). Not cleared
 * on unmount: the page takes the name over, or drops it, when it mounts.
 */
export function presetWardBarPageTitle(pathname: string, title: string) {
  setPageTitle({ pathname, title });
}

/** Bar side: the page's own name for `pathname`, if the page set one. */
export function useWardBarPageTitleFor(pathname: string): string | undefined {
  const current = useSyncExternalStore(subscribeTitle, readTitle, noTitleOnServer);
  return current?.pathname === pathname ? current.title : undefined;
}
