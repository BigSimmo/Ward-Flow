"use client";

import { useSyncExternalStore, type ReactNode } from "react";
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
 * Classes for a page's header tools, so every page's tools look the same: `tool` for a button or
 * link, `count` for the count inside it, and `label` for text that hides when the header is short
 * of room. Read at render, never at module load, because Node test runners load CSS modules empty.
 */
export { styles as wardBarToolStyles };
