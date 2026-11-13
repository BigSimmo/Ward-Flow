import { WardLoadingShape, type WardLoadingShapePaths } from "@/components/ward-management/shell/ward-loading-shape";
import { wardLoadingShapeRows } from "@/components/ward-management/shell/ward-loading-shape-rows";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";

import styles from "./loading.module.css";
import { WardLoadingStatus } from "./loading-status";

/** The three pages whose placeholder takes their shape. */
const SHAPED_PAGES: WardLoadingShapePaths = {
  home: "/ward-flow",
  capacity: "/ward-flow/capacity",
  waiting: "/ward-flow/waiting",
};

/**
 * shell-10 (13 Oct 2026): on slow signal a Menu or dock tap used to leave the old page up, with no
 * sign anything was happening, for seconds. This route-level placeholder renders inside the shell
 * (header and dock stay) the moment a navigation starts, so people can see the tap landed.
 *
 * Loading state (pop-state-loading, Josh 31 Oct 2026): the grey blocks take the shape of Home,
 * Capacity or Waiting when that is the page on its way (`WardLoadingShape`), and the Synthetic
 * prototype footer stays at the foot, so the page lands where the placeholder was.
 *
 * This boundary loads on every navigation, so it imports no kit barrel or navigation module: the
 * addresses are passed in. Shared design parts item 12 (Josh, 13 Nov 2026): no spinner; the status
 * row carries the synthetic-data mark and the blocks hold grey rows shaped like the content.
 */
export default function WardFlowLoading() {
  return (
    <main id="main-content" className={styles.main} aria-busy="true" data-testid="ward-flow-loading">
      <WardLoadingStatus />
      <WardLoadingShape paths={SHAPED_PAGES} rows={wardLoadingShapeRows()} />
      <WardPrototypeFooter />
    </main>
  );
}
