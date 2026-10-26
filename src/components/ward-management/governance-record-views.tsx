"use client";

/**
 * Who opened a record (D-80 item 14): the short list in Governance's detail panel, and the full
 * list behind the Audit trail's Record views filter. The rows come from the server's record views
 * log in the shared workspace, or the local demo's synthetic ones (`governance-access-review.ts`).
 */
import type { Instant } from "@/components/ward-management/ward-clock";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";
import { cx, tableClasses } from "@/components/wf";
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

/** The Audit trail's Record views filter: every logged opening of the last 7 days, newest first. */
export function RecordViewsTable({
  views,
  now,
  patientOf,
  from,
}: {
  views: readonly RecordView[];
  now: Instant;
  patientOf: ReturnType<typeof usePatientOf>;
  from: "server" | "demo";
}) {
  const rows = [...views].filter((view) => view.at > now - RECORD_VIEW_DAYS * 24 * 60).sort((a, b) => b.at - a.at);
  return (
    <div className={thirdEdition.tableScroll} role="region" aria-label="Record views" tabIndex={0}>
      {rows.length === 0 ? (
        <p className={thirdEdition.emptyCell}>No record views are logged in the last {RECORD_VIEW_DAYS} days.</p>
      ) : (
        <table className={cx(tableClasses.table, thirdEdition.viewTable)} data-testid="ward-record-views">
          <caption className={thirdEdition.srOnly}>
            Record views, last {RECORD_VIEW_DAYS} days{from === "demo" ? ", synthetic" : ""}
          </caption>
          <thead>
            <tr>
              <th scope="col">When</th>
              <th scope="col">Desk</th>
              <th scope="col">Record</th>
              <th scope="col">Where</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((view) => {
              const person = patientOf({ patientId: view.record });
              return (
                <tr key={view.key}>
                  <td className={thirdEdition.eventTime}>{when(view.at, now)}</td>
                  <td>
                    <span className={thirdEdition.stack}>
                      <span>{ACCESS_ROLE_LABELS[view.desk]}</span>
                      <span className={thirdEdition.quietText}>{view.place}</span>
                    </span>
                  </td>
                  <td>
                    <span className={thirdEdition.stack}>
                      <span>{person.patient ? person.displayName : "Record not in this view"}</span>
                      {person.patient ? (
                        <span className={cx(thirdEdition.quietText, thirdEdition.umrn)}>{person.umrn}</span>
                      ) : null}
                    </span>
                  </td>
                  <td>
                    {SURFACE_LABELS[view.surface]}
                    {view.breakGlass ? <span className={thirdEdition.quietText}> · Break glass</span> : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
