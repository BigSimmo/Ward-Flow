import type { ComponentProps } from "react";
import { WardPanel } from "../ward-panel";
import styles from "./statistics-family.module.css";

/** Figure blocks stay on the page. They are sections, not tabs or closed disclosures. */
export function StatisticsDetailPanel(props: ComponentProps<typeof WardPanel>) {
  return (
    <div
      className={styles.shownSection}
      data-testid={`${props.testId ?? "statistics"}-disclosure`}
      data-tab-section={props.dataTabSection}
    >
      <WardPanel {...props} />
    </div>
  );
}
