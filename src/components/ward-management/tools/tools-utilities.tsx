"use client";

import dynamic from "next/dynamic";

import shell from "../shell/ward-bar.module.css";
import styles from "./tools-workspace.module.css";

const WardCatchmentResolver = dynamic(
  () =>
    import("@/components/ward-management/tools/ward-catchment-resolver").then((module) => module.WardCatchmentResolver),
  { ssr: false },
);
const WardMhaCalculator = dynamic(
  () => import("@/components/ward-management/tools/ward-mha-calculator").then((module) => module.WardMhaCalculator),
  { ssr: false },
);

export function ToolsUtilities() {
  return (
    <div className={styles.stack}>
      <p className={styles.note}>Look up a catchment, or review form dates somebody has already recorded.</p>
      <section className={shell.toolsSection}>
        <h3 className={shell.toolsHeading}>
          Catchment resolver <span>WA Health</span>
        </h3>
        <WardCatchmentResolver />
      </section>
      <section className={shell.toolsSection}>
        <h3 className={shell.toolsHeading}>
          Form date review <span>Recorded times only</span>
        </h3>
        <WardMhaCalculator />
      </section>
    </div>
  );
}
