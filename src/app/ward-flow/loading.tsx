import { Spinner } from "@/components/wf/primitives";
import { WardLoadingShape } from "@/components/ward-management/shell/ward-loading-shape";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";

import styles from "./loading.module.css";

/**
 * shell-10 (13 Oct 2026): on slow signal a Menu or dock tap used to leave the old page up, with no
 * sign anything was happening, for seconds. This route-level placeholder renders inside the shell
 * (header and dock stay) the moment a navigation starts, so people can see the tap landed.
 *
 * Loading state (pop-state-loading, Josh 31 Oct 2026): the grey blocks take the shape of Home,
 * Capacity or Waiting when that is the page on its way (`WardLoadingShape`), and the Synthetic
 * prototype footer stays at the foot, so the page lands where the placeholder was.
 */
export default function WardFlowLoading() {
  return (
    <main id="main-content" className={styles.main} aria-busy="true" data-testid="ward-flow-loading">
      <p className={styles.status} role="status">
        <Spinner />
        Loading page
      </p>
      <WardLoadingShape />
      <WardPrototypeFooter />
    </main>
  );
}
