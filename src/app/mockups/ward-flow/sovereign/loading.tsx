import styles from "@/components/ward-management/sovereign/sovereign-showcase.module.css";

export default function SovereignShowcaseLoading() {
  return (
    <main
      className={styles.workspace}
      data-ward-design="third-edition"
      aria-busy="true"
      aria-label="Loading design system showcase"
    >
      <section className={styles.heroBanner}>
        <div className={styles.heroText}>
          <div
            style={{
              height: "0.85rem",
              width: "14rem",
              background: "var(--surface-2)",
              borderRadius: "var(--r2)",
              marginBottom: "0.75rem",
            }}
          />
          <div
            style={{
              height: "2.25rem",
              width: "22rem",
              maxWidth: "100%",
              background: "var(--surface-2)",
              borderRadius: "var(--r2)",
              marginBottom: "0.75rem",
            }}
          />
          <div
            style={{
              height: "1rem",
              width: "85%",
              background: "var(--surface-2)",
              borderRadius: "var(--r2)",
            }}
          />
        </div>
        <div className={styles.heroAside}>
          <div
            style={{
              height: "2rem",
              width: "9rem",
              background: "var(--surface-2)",
              borderRadius: "9999px",
            }}
          />
        </div>
      </section>

      <nav className={styles.sectionNav} aria-label="Showcase sections">
        {["Foundations", "Shared components", "Interaction example", "Drawer triggers"].map((label) => (
          <span
            key={label}
            style={{
              minHeight: "3rem",
              minWidth: "7rem",
              background: "var(--surface)",
              borderRadius: "var(--r2)",
              display: "inline-flex",
            }}
          />
        ))}
      </nav>

      <div className={styles.topGrid}>
        {[1, 2].map((i) => (
          <div key={i} className={styles.anchorPanel}>
            <div
              style={{
                minHeight: "22rem",
                background: "var(--surface)",
                border: "0.0625rem solid var(--line)",
                borderRadius: "var(--r1)",
                boxShadow: "var(--lift)",
                padding: "1.25rem",
                display: "flex",
                flexDirection: "column",
                gap: "1rem",
              }}
            >
              <div
                style={{
                  height: "1.5rem",
                  width: "12rem",
                  background: "var(--surface-2)",
                  borderRadius: "var(--r2)",
                }}
              />
              <div
                style={{
                  height: "0.85rem",
                  width: "18rem",
                  background: "var(--surface-2)",
                  borderRadius: "var(--r2)",
                }}
              />
              <div
                style={{
                  flex: 1,
                  background: "var(--surface-2)",
                  borderRadius: "var(--r2)",
                  opacity: 0.5,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
