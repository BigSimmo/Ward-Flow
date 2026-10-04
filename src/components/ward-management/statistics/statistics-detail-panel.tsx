import type { ComponentProps } from "react";
import { WardPanel } from "../ward-panel";
import styles from "./statistics-family.module.css";

/** Secondary measures stay available without occupying a full panel in the default reading path. */
export function StatisticsDetailPanel(props: ComponentProps<typeof WardPanel>) {
  return (
    <details
      className={`${styles.disclosure} source-print`}
      data-testid={`${props.testId ?? "statistics"}-disclosure`}
      data-tab-section={props.dataTabSection}
    >
      <summary>
        <span>{props.title}</span>
        {props.count && <small>{props.count}</small>}
      </summary>
      <WardPanel {...props} />
    </details>
  );
}
