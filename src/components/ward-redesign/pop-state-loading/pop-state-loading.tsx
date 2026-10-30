"use client";

import type { ReactNode } from "react";

import { Spinner } from "@/components/wf";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";

import styles from "./pop-state-loading.module.css";

/**
 * The Loading mock-up: what Home shows inside the shell while its page code arrives. Built from the
 * shared placeholder (`src/app/ward-flow/loading.tsx`): the same "Loading page" status, `aria-busy`
 * main and pulsing blocks, but the blocks take Home's shape (hero band, ED strip, My list beside
 * Beds that fit) so nothing jumps when the page lands. The page itself is not drawn: the state stands
 * in its place, as the real placeholder does.
 */
export function PopStateLoading({ page }: { page: ReactNode }) {
  void page;
  return (
    <main id="main-content" className={styles.main} aria-busy="true" data-testid="ward-flow-loading">
      <p className={styles.status} role="status">
        <Spinner />
        Loading page
      </p>
      <div className={`${styles.block} ${styles.band}`} aria-hidden="true" />
      <div className={styles.strip} aria-hidden="true">
        {["a", "b", "c", "d", "e", "f"].map((key) => (
          <div key={key} className={`${styles.block} ${styles.cell}`} />
        ))}
      </div>
      <div className={styles.columns} aria-hidden="true">
        <div className={`${styles.block} ${styles.list}`} />
        <div className={styles.side}>
          <div className={`${styles.block} ${styles.fit}`} />
          <div className={`${styles.block} ${styles.place}`} />
        </div>
      </div>
      <WardPrototypeFooter />
    </main>
  );
}
