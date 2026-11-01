"use client";

import { usePathname } from "next/navigation";

import styles from "./ward-loading-shape.module.css";

type Shape = "home" | "capacity" | "waiting" | "plain";

/** Which page the placeholder stands in for, read from the address the navigation is going to. */
function shapeOf(pathname: string): Shape {
  const path = pathname.replace(/\/+$/u, "");
  if (path === "/ward-flow") return "home";
  if (path === "/ward-flow/capacity") return "capacity";
  if (path === "/ward-flow/waiting") return "waiting";
  return "plain";
}

const SIX = ["a", "b", "c", "d", "e", "f"] as const;

/** One grey block. `className` gives it its place and height. */
function Block({ className }: { className?: string }) {
  return <div className={`${styles.block} ${className ?? ""}`} />;
}

/** Home: hero band, ED strip, then My List beside Beds that fit and Placement. */
function HomeShape() {
  return (
    <>
      <Block className={styles.band} />
      <div className={styles.strip}>
        {SIX.map((key) => (
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
        {SIX.slice(0, 5).map((key) => (
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
        {SIX.slice(0, 4).map((key) => (
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

/**
 * Loading state (pop-state-loading, approved by Josh 31 Oct 2026): the shared placeholder's grey
 * blocks take the shape of the page that is on its way, so Home, Capacity and Waiting land where
 * the blocks were instead of jumping. Every other page keeps today's plain two blocks. Decoration
 * only: the placeholder's "Loading page" status says what is happening.
 */
export function WardLoadingShape() {
  const shape = shapeOf(usePathname() ?? "");
  return (
    <div className={styles.blocks} aria-hidden="true" data-shape={shape}>
      {shape === "home" ? (
        <HomeShape />
      ) : shape === "capacity" ? (
        <CapacityShape />
      ) : shape === "waiting" ? (
        <WaitingShape />
      ) : (
        <>
          <Block className={styles.plain} />
          <Block className={styles.plainTall} />
        </>
      )}
    </div>
  );
}
