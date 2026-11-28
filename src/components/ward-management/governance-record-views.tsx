"use client";

/**
 * Who opened a record (D-80 item 14): the short list in Governance's detail panel. The full list is
 * the Audit trail's Access log (`settings/access-log.tsx`, audit two #124, Josh 28 Nov 2026). The
 * rows come from the server's record views log in the shared workspace, or the local demo's
 * synthetic ones (`governance-access-review.ts`).
 */
import type { Instant } from "@/components/ward-management/ward-clock";
import thirdEdition from "./governance-third-edition.module.css";
import { RECORD_VIEW_DAYS, SURFACE_LABELS, type RecordView } from "./governance-access-review";
import { ACCESS_ROLE_LABELS } from "./ward-role-access";
import { when } from "./governance-shared";

const viewLine = (view: RecordView) =>
  `${ACCESS_ROLE_LABELS[view.desk]}, ${view.place}, ${SURFACE_LABELS[view.surface]}${view.breakGlass ? ", break glass" : ""}`;

/** The chosen row's record: who opened it in the last 7 days, newest first. */
export function WhoOpenedList({ views, now }: { views: readonly RecordView[]; now: Instant }) {
  return (
    <section
      className={thirdEdition.operationFacts}
      aria-labelledby="governance-who-opened"
      data-testid="ward-who-opened"
    >
      <h3 className={thirdEdition.subheading} id="governance-who-opened">
        Who opened this record, last {RECORD_VIEW_DAYS} days
      </h3>
      {views.length === 0 ? (
        <p className={thirdEdition.quiet}>No openings of this record are logged in the last {RECORD_VIEW_DAYS} days.</p>
      ) : (
        <ul className={thirdEdition.whoOpened}>
          {views.map((view) => (
            <li key={view.key}>
              <span className={thirdEdition.eventTime}>{when(view.at, now)}</span>
              <span>{viewLine(view)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
