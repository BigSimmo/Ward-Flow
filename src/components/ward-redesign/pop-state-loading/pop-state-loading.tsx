"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { Spinner } from "@/components/wf";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";

import styles from "./pop-state-loading.module.css";

type Shape = "home" | "capacity" | "waiting" | "plain";

/** Which page the placeholder stands in for, read from the app path the shell is drawn for. */
function shapeOf(pathname: string): Shape {
  const path = pathname.replace(/\/+$/u, "");
  if (path === "/ward-flow") return "home";
  if (path === "/ward-flow/capacity") return "capacity";
  if (path === "/ward-flow/waiting") return "waiting";
  return "plain";
}

/** One grey block. `className` gives it its place and height. */
function Block({ className }: { className?: string }) {
  return <div className={`${styles.block} ${className ?? ""}`} />;
}

/** Home: hero band, ED strip, then My list beside Beds that fit and Placement. */
function HomeShape() {
  return (
    <>
      <Block className={styles.band} />
      <div className={styles.strip}>
        {["a", "b", "c", "d", "e", "f"].map((key) => (
          <Block key={key} className={styles.cell} />
        ))}
      </div>
      <div className={styles.columns}>
        <Block className={styles.list} />
        <div className={styles.side}>
          <Block className={styles.fit} />
          <Block className={styles.place} />
        </div>
      </div>
    </>
  );
}

/** Capacity: hero band, the five mismatch cards in one row, then the bed forecast. */
function CapacityShape() {
  return (
    <>
      <Block className={styles.band} />
      <div className={`${styles.strip} ${styles.five}`}>
        {["a", "b", "c", "d", "e"].map((key) => (
          <Block key={key} className={styles.mismatch} />
        ))}
      </div>
      <Block className={styles.forecast} />
    </>
  );
}

/** Waiting: the short band, the daily check line, four blocker cards, then the list beside its side column. */
function WaitingShape() {
  return (
    <>
      <Block className={styles.bandShort} />
      <Block className={styles.line} />
      <div className={`${styles.strip} ${styles.four}`}>
        {["a", "b", "c", "d"].map((key) => (
          <Block key={key} className={styles.blocker} />
        ))}
      </div>
      <div className={`${styles.columns} ${styles.wide}`}>
        <Block className={styles.table} />
        <div className={styles.side}>
          <Block className={styles.fit} />
          <Block className={styles.place} />
        </div>
      </div>
    </>
  );
}

/** Every other page keeps today's plain placeholder: one short block and one tall block. */
function PlainShape() {
  return (
    <>
      <Block className={styles.plain} />
      <Block className={styles.plainTall} />
    </>
  );
}

/**
 * The Loading mock-up: what a page shows inside the shell while its page code arrives. Built from the
 * shared placeholder (`src/app/ward-flow/loading.tsx`): the same "Loading page" status, `aria-busy`
 * main and pulsing blocks. Over Home, Capacity and Waiting the blocks take that page's shape, so
 * nothing jumps when the page lands; every other page keeps today's plain two blocks. The page is
 * not drawn: the state stands in its place, as the real placeholder does.
 */
export function PopStateLoading({ page }: { page: ReactNode }) {
  void page;
  const shape = shapeOf(usePathname() ?? "");
  return (
    <main id="main-content" className={styles.main} aria-busy="true" data-testid="ward-flow-loading" data-shape={shape}>
      <p className={styles.status} role="status">
        <Spinner />
        Loading page
      </p>
      <div className={styles.blocks} aria-hidden="true">
        {shape === "home" ? (
          <HomeShape />
        ) : shape === "capacity" ? (
          <CapacityShape />
        ) : shape === "waiting" ? (
          <WaitingShape />
        ) : (
          <PlainShape />
        )}
      </div>
      <WardPrototypeFooter />
    </main>
  );
}
