import styles from "./ward-loading-rows.module.css";

/**
 * Shared design parts item 12 (Josh, 13 Nov 2026; F-62): a card of grey rows shaped like a list,
 * for a page that is still on its way, so the page lands where the rows were. No spinner, no hooks
 * and no kit barrel, so the server draws it and it adds no client code. Decoration only: the
 * placeholder's status line says what is happening.
 */
export function WardLoadingRows({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={className ? `${styles.card} ${className}` : styles.card} aria-hidden="true" data-loading-rows="">
      <div className={styles.head}>
        <span className={`${styles.bar} ${styles.title}`} />
        <span className={`${styles.bar} ${styles.pill}`} />
      </div>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className={styles.row}>
          <span className={`${styles.bar} ${styles.main}`} />
          <span className={`${styles.bar} ${styles.end}`} />
          <span className={`${styles.bar} ${styles.sub}`} />
        </div>
      ))}
    </div>
  );
}
