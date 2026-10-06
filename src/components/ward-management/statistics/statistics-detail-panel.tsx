import type { ComponentProps } from "react";
import { WardPanel } from "../ward-panel";

/** Keep every operational breakdown visible in the page's modular grid. */
export function StatisticsDetailPanel(props: ComponentProps<typeof WardPanel>) {
  return (
    <section data-testid={`${props.testId ?? "statistics"}-disclosure`} data-tab-section={props.dataTabSection}>
      <WardPanel {...props} />
    </section>
  );
}
