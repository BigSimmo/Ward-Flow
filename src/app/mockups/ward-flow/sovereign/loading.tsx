import styles from "@/components/ward-management/sovereign/sovereign-showcase.module.css";

/** Placeholder shapes in the v6 arrangement: the hero, then the two top cards. */
export default function SovereignShowcaseLoading() {
  return (
    <main
      className={styles.workspace}
      data-ward-design="v6"
      aria-busy="true"
      aria-label="Loading design system showcase"
    >
      <div className={styles.loadingHero} />
      <div className={styles.topGrid}>
        <div className={styles.loadingCard} />
        <div className={styles.loadingCard} />
      </div>
    </main>
  );
}
