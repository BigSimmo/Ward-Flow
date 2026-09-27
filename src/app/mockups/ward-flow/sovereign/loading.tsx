import styles from "@/components/ward-management/sovereign/sovereign-showcase.module.css";

export default function SovereignShowcaseLoading() {
  return (
    <main className={styles.workspace} aria-busy="true" aria-label="Loading Sovereign Showcase">
      <section className={styles.heroBanner}>
        <div className={styles.heroText}>
          <div style={{ height: "1.5rem", width: "60%", background: "var(--surface-2)", borderRadius: "var(--r2)", marginBottom: "0.5rem" }} />
          <div style={{ height: "1rem", width: "90%", background: "var(--surface-2)", borderRadius: "var(--r2)" }} />
        </div>
      </section>
      <div className={styles.demoGrid}>
        {[1, 2, 3].map((i) => (
          <div key={i} className={styles.demoCard}>
            <div className={styles.demoCardHead}>
              <div style={{ height: "1.25rem", width: "50%", background: "var(--surface-2)", borderRadius: "var(--r2)" }} />
            </div>
            <div className={styles.demoCardBody}>
              <div style={{ height: "3rem", background: "var(--surface-2)", borderRadius: "var(--r2)" }} />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
