import type { ReactNode } from "react";

import { WardLoadingRows } from "./ward-loading-rows";
import styles from "./ward-loading-shape.module.css";

/**
 * The grey rows each placeholder shape holds (shared design parts item 12, 13 Nov 2026), drawn by
 * the server. The route-level `loading.tsx` passes them into the client `WardLoadingShape`, so the
 * rows add no code to the boundary that loads on every navigation (phone size limits).
 */
export type WardLoadingShapeRows = Readonly<Record<"home" | "capacity" | "waiting" | "plain", ReactNode>>;

export function wardLoadingShapeRows(): WardLoadingShapeRows {
  return {
    home: <WardLoadingRows className={styles.list} rows={5} />,
    capacity: <WardLoadingRows className={styles.forecast} rows={4} />,
    waiting: <WardLoadingRows className={styles.table} rows={6} />,
    plain: <WardLoadingRows className={styles.plainTall} rows={3} />,
  };
}
