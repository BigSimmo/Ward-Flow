"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import type { WardLoadingShapeRows } from "./ward-loading-shape-rows";
import styles from "./ward-loading-shape.module.css";

type Shape = "home" | "capacity" | "waiting" | "plain";

/**
 * The addresses of the three pages with a page-shaped placeholder. The route-level `loading.tsx`
 * passes them in, so shell/ types no route of its own and this boundary, which loads on every
 * navigation, imports nothing heavier than its own styles.
 */
export type WardLoadingShapePaths = Readonly<Record<Exclude<Shape, "plain">, string>>;

/** Which page the placeholder stands in for, read from the address the navigation is going to. */
function shapeOf(pathname: string, paths: WardLoadingShapePaths): Shape {
  const path = pathname.replace(/\/+$/u, "");
  if (path === paths.home) return "home";
  if (path === paths.capacity) return "capacity";
  if (path === paths.waiting) return "waiting";
  return "plain";
}

const SIX = ["a", "b", "c", "d", "e", "f"] as const;

/** One grey block. `className` gives it its place and height. */
function Block({ className }: { className?: string }) {
  return <div className={`${styles.block} ${className ?? ""}`} />;
}

/** Home: hero band, ED strip, then My List beside Beds that fit and Placement. */
function HomeShape({ list }: { list: ReactNode }) {
  return (
    <>
      <Block className={styles.band} />
      <div className={styles.strip}>
        {SIX.map((key) => (
          <Block key={key} className={styles.cell} />
        ))}
      </div>
      <div className={styles.columns}>
        {list}
        <div className={styles.side}>
          <Block className={styles.fit} />
          <Block className={styles.place} />
        </div>
      </div>
    </>
  );
}

/** Capacity: hero band, the five mismatch cards in one row, then the bed forecast. */
function CapacityShape({ forecast }: { forecast: ReactNode }) {
  return (
    <>
      <Block className={styles.band} />
      <div className={`${styles.strip} ${styles.five}`}>
        {SIX.slice(0, 5).map((key) => (
          <Block key={key} className={styles.mismatch} />
        ))}
      </div>
      {forecast}
    </>
  );
}

/** Waiting: the short band, the daily check line, four blocker cards, then the list beside its side column. */
function WaitingShape({ table }: { table: ReactNode }) {
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
        {table}
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
 * only: the placeholder's "Loading page" status says what is happening. Item 12 (13 Nov 2026): the
 * list-shaped blocks hold grey rows (`WardLoadingRows`); the others are filled with the track. The
 * server draws those rows (`wardLoadingShapeRows`) and passes them in, so they add no client code.
 */
export function WardLoadingShape({ paths, rows }: { paths: WardLoadingShapePaths; rows: WardLoadingShapeRows }) {
  const shape = shapeOf(usePathname() ?? "", paths);
  return (
    <div className={styles.blocks} aria-hidden="true" data-shape={shape}>
      {shape === "home" ? (
        <HomeShape list={rows.home} />
      ) : shape === "capacity" ? (
        <CapacityShape forecast={rows.capacity} />
      ) : shape === "waiting" ? (
        <WaitingShape table={rows.waiting} />
      ) : (
        <>
          <Block className={styles.plain} />
          {rows.plain}
        </>
      )}
    </div>
  );
}
