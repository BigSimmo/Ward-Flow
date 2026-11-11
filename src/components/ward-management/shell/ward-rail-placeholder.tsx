"use client";

import { useState } from "react";

import styles from "./ward-rail.module.css";
import { readWardRailEarlyShape } from "./ward-rail-early";

/**
 * Count leak (D-137): the rail's empty shape while a held first load waits to know the desk, so the
 * page does not jump sideways when the rail draws. It carries no figures or links. The early script
 * (ward-rail-early.ts) gives it the stored closed or tablet shape, as it does the rail, and the
 * placeholder hydrates with the shape that script recorded, so React adopts the page as drawn
 * instead of reporting mismatched attributes it would not patch.
 */
export function WardRailPlaceholder() {
  const [early] = useState(readWardRailEarlyShape);
  return (
    <aside
      className={styles.rail}
      data-rail={early?.rail ?? "open"}
      data-tablet={early?.tablet ?? undefined}
      data-wf-rail-placeholder=""
      aria-hidden="true"
    />
  );
}
