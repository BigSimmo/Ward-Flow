import WardFlowLoading from "../loading";
import styles from "./loading.module.css";

/**
 * H-0182: the TV hides the app's top bar and side menu (DA-23). While this route loaded, the shared
 * placeholder showed them, and the whole page jumped up when the TV arrived. The marker below lets
 * the layout hide them from the first paint; the placeholder itself is the shared one.
 * R-FIGS-21: the heading and its space show from the first paint.
 */
export default function BedMeetingTvLoading() {
  return (
    <>
      <div hidden data-wf-tv-clean="" />
      <div className={styles.head}>
        <h1 className={styles.title}>Bed meeting</h1>
      </div>
      <WardFlowLoading />
    </>
  );
}
