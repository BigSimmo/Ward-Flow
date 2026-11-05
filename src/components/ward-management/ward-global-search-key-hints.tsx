import styles from "./ward-global-search.module.css";

/** Keyboard hints shared by the search palette's start and result views. */
export function WardSearchKeyHints({ isStart }: { isStart: boolean }) {
  return (
    <div className={styles.footerHints} aria-hidden="true" data-kbd-hint="">
      <span className={styles.hintItem}>
        <kbd className={styles.hintKbd}>↑</kbd>
        <kbd className={styles.hintKbd}>↓</kbd>
        <span className={styles.hintLabel}>Navigate</span>
      </span>
      <span className={styles.hintItem}>
        <kbd className={styles.hintKbd}>↵</kbd>
        <span className={styles.hintLabel}>Select</span>
      </span>
      {isStart ? null : (
        <span className={styles.hintItem}>
          <kbd className={styles.hintKbd}>Tab</kbd>
          <span className={styles.hintLabel}>Next group</span>
        </span>
      )}
      <span className={styles.hintItem}>
        <kbd className={styles.hintKbd}>Esc</kbd>
        <span className={styles.hintLabel}>Dismiss</span>
      </span>
    </div>
  );
}
