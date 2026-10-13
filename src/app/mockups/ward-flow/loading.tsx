import styles from "./loading.module.css";

/**
 * shell-10 (13 Oct 2026): on slow signal a Menu or dock tap used to leave the old page up, with no
 * sign anything was happening, for seconds. This route-level placeholder renders inside the shell
 * (header and dock stay) the moment a navigation starts, so people can see the tap landed.
 */
export default function WardFlowLoading() {
  return (
    <main id="main-content" className={styles.main} aria-busy="true" data-testid="ward-flow-loading">
      <p className={styles.status} role="status">
        Loading page
      </p>
      <div className={styles.block} aria-hidden="true" />
      <div className={`${styles.block} ${styles.blockTall}`} aria-hidden="true" />
    </main>
  );
}
