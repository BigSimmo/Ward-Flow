"use client";

import { useState } from "react";

import {
  isLegalDeadlineBreached,
  legalExpiryReminderOf,
  legalExpiryReminderSummary,
  legalFormBreakdown,
  legalFormGroupRows,
} from "@/components/ward-management/legal-forms/legal-forms-derivations";
import { movementHref } from "@/components/ward-management/shell/ward-facade";
import { departmentLabel } from "@/components/ward-management/ward-absence-labels";
import {
  formatInstantWithDay,
  formatSheetMoment,
  minutesUntil,
  splitDuration,
  type Instant,
} from "@/components/ward-management/ward-clock";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { legalFormName } from "@/components/ward-management/ward-legal-forms";
import type { Movement } from "@/components/ward-management/ward-model";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";
import { edById } from "@/components/ward-management/ward-sites";

import {
  KpiStrip,
  Panel,
  Pill,
  ProposalHeader,
  ProposalPreviewBar,
  Verdict,
  type Attention,
  type Tone,
} from "./oversight-proposal-parts";
import styles from "./oversight-proposal.module.css";

type Status = "passed" | "urgent" | "soon" | "later" | "none";
type StatusFilter = "all" | "passed" | "warning" | "typed" | "none";

/** One reading of a form's state, used by the strip, the filter and the row, so they cannot disagree. */
function statusOf(movement: Movement, now: Instant): Status {
  if (movement.legalForm?.dueAt === undefined) return "none";
  if (isLegalDeadlineBreached(movement, now)) return "passed";
  const reminder = legalExpiryReminderOf(movement, now);
  return reminder === "within-urgent" ? "urgent" : reminder === "within-soon" ? "soon" : "later";
}

export function LegalFormsProposal() {
  const { movements, dayZero } = useWardFlow();
  const now = useWardFlowClock();
  const patientOf = usePatientOf();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [formFilter, setFormFilter] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const withExpiry = legalFormGroupRows(movements, now, "with-deadline");
  const noExpiry = legalFormGroupRows(movements, now, "no-deadline");
  const rows = [...withExpiry, ...noExpiry];
  const openCount = movements.filter(isOpen).length;
  const voluntary = openCount - rows.length;
  const reminders = legalExpiryReminderSummary(movements, now);
  const passed = withExpiry.filter((movement) => statusOf(movement, now) === "passed");
  const inWarning = reminders.withinUrgent + reminders.withinSoon;
  const breakdown = legalFormBreakdown(rows, now);

  const STATUS: Record<Status, { label: string; tone: Tone }> = {
    passed: { label: "Expiry passed", tone: "danger" },
    urgent: { label: `Within ${reminders.urgentHours}h`, tone: "danger" },
    soon: { label: `Within ${reminders.soonHours}h`, tone: "warn" },
    later: { label: "Later", tone: "good" },
    none: { label: "No expiry typed", tone: "quiet" },
  };

  const visible = rows.filter((movement) => {
    const status = statusOf(movement, now);
    const statusOk =
      statusFilter === "all" ||
      (statusFilter === "passed" && status === "passed") ||
      (statusFilter === "warning" && (status === "urgent" || status === "soon")) ||
      (statusFilter === "typed" && status !== "none") ||
      (statusFilter === "none" && status === "none");
    return statusOk && (formFilter === "all" || movement.legalForm?.code === formFilter);
  });
  const selected = rows.find((movement) => movement.id === selectedId) ?? visible[0] ?? null;
  const next = withExpiry.find((movement) => statusOf(movement, now) !== "passed");

  const toggle = (value: StatusFilter) => setStatusFilter(statusFilter === value ? "all" : value);
  const attention: Attention[] = [];
  if (passed.length > 0)
    attention.push({
      tone: "danger",
      label: `${passed.length} typed ${passed.length === 1 ? "expiry" : "expiries"} passed`,
    });
  if (reminders.withinUrgent > 0)
    attention.push({ tone: "danger", label: `${reminders.withinUrgent} within ${reminders.urgentHours}h` });
  if (reminders.withinSoon > 0)
    attention.push({ tone: "warn", label: `${reminders.withinSoon} within ${reminders.soonHours}h` });
  attention.push({ tone: "quiet", label: `${noExpiry.length} forms with no expiry typed` });

  return (
    <>
      <ProposalPreviewBar active="legal-forms" />
      <main id="main-content" className={styles.page} data-testid="legal-forms-proposal">
        <ProposalHeader
          crumb="Oversight"
          title="Legal forms"
          subtitle="Every open movement that carries a legal form. Expiry times are the ones typed from the paper form; this prototype never works one out."
          asAt={`As at ${formatSheetMoment(now, dayZero)}`}
        />

        <Verdict attention={attention}>
          {passed.length > 0 ? (
            <>
              <strong>
                {passed.length === 1 ? "1 typed form expiry has" : `${passed.length} typed form expiries have`} passed.
              </strong>{" "}
              Check the paper form with the treating team.
            </>
          ) : inWarning > 0 && next ? (
            <>
              <strong>No typed expiry has passed.</strong> {inWarning} {inWarning === 1 ? "is" : "are"} inside the
              warning window; the soonest is {patientOf(next).displayName}, in{" "}
              {splitDuration(minutesUntil(next.legalForm!.dueAt!, now))}.
            </>
          ) : (
            <>
              <strong>No typed expiry has passed or is close.</strong> {rows.length} open movements carry a legal form.
            </>
          )}
        </Verdict>

        <KpiStrip
          label="Legal form figures"
          items={[
            {
              label: "Expiry passed",
              value: passed.length,
              tone: passed.length > 0 ? "danger" : undefined,
              note: "Typed time is in the past",
              pressed: statusFilter === "passed",
              onPress: () => toggle("passed"),
            },
            {
              label: "In warning window",
              value: inWarning,
              tone: inWarning > 0 ? "warn" : undefined,
              note: `Within ${reminders.soonHours}h, set in Settings`,
              pressed: statusFilter === "warning",
              onPress: () => toggle("warning"),
            },
            {
              label: "Expiry typed",
              value: withExpiry.length,
              note: "A time was typed from the form",
              pressed: statusFilter === "typed",
              onPress: () => toggle("typed"),
            },
            {
              label: "No expiry typed",
              value: noExpiry.length,
              note: "Form recorded, no time on it",
              pressed: statusFilter === "none",
              onPress: () => toggle("none"),
            },
            {
              label: "With a legal form",
              value: rows.length,
              note: `Of ${openCount} open movements; ${voluntary} carry none`,
              pressed: statusFilter === "all",
              onPress: () => setStatusFilter("all"),
            },
          ]}
        />

        <div className={styles.grid2}>
          <Panel
            title="Forms, soonest expiry first"
            question={`${visible.length} of ${rows.length} shown. A passed expiry comes first; forms with no expiry typed come last.`}
            meta={
              <label className={styles.toolbar}>
                <span>Form</span>
                <select
                  className={styles.select}
                  value={formFilter}
                  onChange={(event) => setFormFilter(event.target.value)}
                >
                  <option value="all">All forms ({rows.length})</option>
                  {breakdown.map((row) => (
                    <option key={row.code} value={row.code}>
                      {row.code} · {row.name} ({row.openCount})
                    </option>
                  ))}
                </select>
              </label>
            }
            flush
          >
            {visible.length === 0 ? (
              <div className={styles.panelBody}>
                <p className={styles.empty}>No form matches these filters.</p>
              </div>
            ) : (
              <div className={styles.tableScroll}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">Person</th>
                      <th scope="col">Form</th>
                      <th scope="col">Typed expiry</th>
                      <th scope="col">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((movement) => {
                      const person = patientOf(movement);
                      const status = statusOf(movement, now);
                      const dueAt = movement.legalForm?.dueAt;
                      return (
                        <tr key={movement.id} aria-selected={selected?.id === movement.id}>
                          <td>
                            <span className={styles.rowName}>
                              <button
                                type="button"
                                className={styles.rowButton}
                                onClick={() => setSelectedId(movement.id)}
                              >
                                {person.displayName}
                              </button>
                              <span className={styles.rowSub}>UMRN {person.umrn}</span>
                            </span>
                          </td>
                          <td>
                            <span className={styles.code}>{movement.legalForm!.code}</span>{" "}
                            <span className={styles.rowSub}>{movement.legalStatus}</span>
                          </td>
                          <td className={styles.mono}>
                            {dueAt === undefined ? (
                              "Not typed"
                            ) : (
                              <>
                                {formatInstantWithDay(dueAt, now)}
                                <span className={styles.cellSub}>
                                  {dueAt < now
                                    ? `${splitDuration(now - dueAt)} ago`
                                    : `in ${splitDuration(dueAt - now)}`}
                                </span>
                              </>
                            )}
                          </td>
                          <td>
                            <Pill tone={STATUS[status].tone}>{STATUS[status].label}</Pill>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <div className={`${styles.stack} ${styles.sticky}`}>
            <Panel title="Selected form" question={selected ? patientOf(selected).displayName : "Nothing selected"}>
              {selected ? (
                <div className={styles.stack}>
                  <dl className={styles.detail}>
                    <dt>Form</dt>
                    <dd>{legalFormName(selected.legalForm!)}</dd>
                    <dt>Legal status</dt>
                    <dd>{selected.legalStatus}</dd>
                    <dt>Typed expiry</dt>
                    <dd>
                      {selected.legalForm!.dueAt === undefined
                        ? "None typed from the form"
                        : formatInstantWithDay(selected.legalForm!.dueAt, now)}
                    </dd>
                    <dt>Where</dt>
                    <dd>{departmentLabel(selected.originEdId, edById(selected.originEdId)?.name)}</dd>
                    <dt>Owner</dt>
                    <dd>{selected.owner}</dd>
                  </dl>
                  <a className={`${styles.button} ${styles.buttonPrimary}`} href={movementHref(selected.id)}>
                    Open movement to update the form
                  </a>
                  <p className={styles.note}>
                    A status here only repeats the typed time against the warning windows in Settings. It is not a legal
                    check.
                  </p>
                </div>
              ) : (
                <p className={styles.empty}>Select a person to see their form.</p>
              )}
            </Panel>

            <Panel title="Forms by type" flush>
              <ul className={styles.list}>
                {breakdown.map((row) => (
                  <li key={row.code} className={styles.listItem}>
                    <button
                      type="button"
                      className={styles.rowButton}
                      aria-pressed={formFilter === row.code}
                      onClick={() => setFormFilter(formFilter === row.code ? "all" : row.code)}
                    >
                      <span className={styles.code}>{row.code}</span> {row.name}
                    </button>
                    <span className={styles.mono}>
                      {row.openCount}
                      {row.breachedCount > 0 ? ` · ${row.breachedCount} passed` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        </div>

        <dl className={styles.definitions} aria-label="How these figures are counted">
          <div>
            <dt>Typed expiry</dt>
            <dd>The expiry time a person typed from the paper form. Nothing on this page works one out.</dd>
          </div>
          <div>
            <dt>Warning window</dt>
            <dd>
              Within {reminders.urgentHours}h or {reminders.soonHours}h of a typed expiry. These are your defaults in
              Settings, not legal limits.
            </dd>
          </div>
          <div>
            <dt>No expiry typed</dt>
            <dd>
              A form is recorded but no time was typed, so there is nothing to count down. It is never shown as valid.
            </dd>
          </div>
        </dl>
      </main>
    </>
  );
}
