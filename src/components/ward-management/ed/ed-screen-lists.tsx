"use client";

// "Lists": the department's tabbed lists, Review, Medical Clearance, Expects, Forms and Referred.
// Split out of `ed-screen.tsx` unchanged (fix list 2.5 and 9.6, 15 Oct 2026).
import type { KeyboardEvent } from "react";
import { formatElapsed, formatInstantWithDay, splitDuration } from "@/components/ward-management/ward-clock";
import { typedTimeLine } from "@/components/ward-management/legal-forms/legal-time-as-typed";
import { OPERATIONAL_DEFAULT_LABEL } from "@/components/ward-management/ward-operational-defaults";
import { patientIdentityLine, resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import {
  EXPECT_RECONSIDER_AFTER_MINUTES,
  referralPersonFacts,
  referralPurposeLabel,
} from "@/components/ward-management/ward-referrals";
import type { EdScreenContext } from "./ed-screen-context";
import { EdInboxReferrals } from "./ed-screen-inbox";
import { movementMedicalClearance, outstandingItem } from "./ed-screen-model";
import { EdReferredPanel } from "./ed-screen-referred";
import type { DepartmentTabKey } from "./use-ed-screen-state";
import { edStageLabel } from "./ed-referral-status";
import styles from "./ed.module.css";

export function EdListsSection({ ctx }: { ctx: EdScreenContext }) {
  const {
    now,
    department,
    movements,
    referrals,
    registryPatients,
    recordEdStep,
    departmentListTab,
    setDepartmentListTab,
    setSelectedPatientId,
    patientBay,
    awaitingReviewPatients,
    clearedPatients,
    expects,
    underFormPatients,
    outbox,
    answeredAll,
  } = ctx;
  const ALL_DEPARTMENT_TABS: { key: DepartmentTabKey; label: string }[] = [
    { key: "review", label: "Awaiting Review" },
    { key: "cleared", label: "Medical Clearance" },
    { key: "expected", label: "Expects" },
    { key: "forms", label: "Forms" },
    { key: "referred", label: "Referred" },
  ];

  function onDepartmentListKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Home") {
      event.preventDefault();
      const first = ALL_DEPARTMENT_TABS[0].key;
      setDepartmentListTab(first);
      event.currentTarget.querySelector<HTMLButtonElement>(`#ward-ed-${first}-tab`)?.focus();
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      const last = ALL_DEPARTMENT_TABS[ALL_DEPARTMENT_TABS.length - 1].key;
      setDepartmentListTab(last);
      event.currentTarget.querySelector<HTMLButtonElement>(`#ward-ed-${last}-tab`)?.focus();
      return;
    }
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const idx = ALL_DEPARTMENT_TABS.findIndex((t) => t.key === departmentListTab);
    const step = event.key === "ArrowRight" ? 1 : -1;
    const nextIdx = (idx + step + ALL_DEPARTMENT_TABS.length) % ALL_DEPARTMENT_TABS.length;
    const next = ALL_DEPARTMENT_TABS[nextIdx].key;
    setDepartmentListTab(next);
    event.currentTarget.querySelector<HTMLButtonElement>(`#ward-ed-${next}-tab`)?.focus();
  }

  return (
    <section className={styles.departmentWorkspace} aria-label="Selected department work">
      <section className={`${styles.panel} ${styles.mod}`} aria-labelledby="ward-ed-lists-heading" data-pane="lists">
        <div className={styles.ph}>
          <h2 id="ward-ed-lists-heading">Lists</h2>

          <span className={styles.count}>
            {departmentListTab === "review"
              ? `${awaitingReviewPatients.length === 0 ? "none" : awaitingReviewPatients.length} awaiting review`
              : departmentListTab === "cleared"
                ? `${clearedPatients.length === 0 ? "none" : clearedPatients.length} medical clearance`
                : departmentListTab === "expected"
                  ? `${expects.length === 0 ? "none" : expects.length} expected`
                  : departmentListTab === "forms"
                    ? `${underFormPatients.length === 0 ? "none" : underFormPatients.length} under a form`
                    : `${outbox.length + answeredAll.length === 0 ? "none" : outbox.length + answeredAll.length} referred`}
          </span>
        </div>
        {/* eslint-disable-next-line jsx-a11y/interactive-supports-focus -- roving tab stop: arrow keys bubble up from the focused tab, option or item */}
        <div
          className={`${styles.tabbar} ${styles.departmentListTabs}`}
          role="tablist"
          aria-label="Lists"
          onKeyDown={onDepartmentListKeyDown}
        >
          <button
            type="button"
            role="tab"
            id="ward-ed-review-tab"
            aria-label={`Awaiting review, ${awaitingReviewPatients.length === 0 ? "none" : awaitingReviewPatients.length} ${awaitingReviewPatients.length === 1 ? "patient" : "patients"}`}
            aria-selected={departmentListTab === "review"}
            aria-controls="ward-ed-review-panel"
            tabIndex={departmentListTab === "review" ? 0 : -1}
            className={styles.tabBtn}
            onClick={() => setDepartmentListTab("review")}
          >
            Review{" "}
            <span className={styles.tabNum} data-zero={awaitingReviewPatients.length === 0 ? "true" : undefined}>
              {awaitingReviewPatients.length === 0 ? "none" : awaitingReviewPatients.length}
            </span>
          </button>
          <button
            type="button"
            role="tab"
            id="ward-ed-cleared-tab"
            aria-label={`Medical Clearance, ${clearedPatients.length === 0 ? "none" : clearedPatients.length}`}
            aria-selected={departmentListTab === "cleared"}
            aria-controls="ward-ed-cleared-panel"
            tabIndex={departmentListTab === "cleared" ? 0 : -1}
            className={styles.tabBtn}
            onClick={() => setDepartmentListTab("cleared")}
          >
            Med Clear{" "}
            <span className={styles.tabNum} data-zero={clearedPatients.length === 0 ? "true" : undefined}>
              {clearedPatients.length === 0 ? "none" : clearedPatients.length}
            </span>
          </button>
          <button
            type="button"
            role="tab"
            id="ward-ed-expected-tab"
            aria-label={`Expects, ${expects.length === 0 ? "none" : expects.length}`}
            aria-selected={departmentListTab === "expected"}
            aria-controls="ward-ed-expected-panel"
            tabIndex={departmentListTab === "expected" ? 0 : -1}
            className={styles.tabBtn}
            onClick={() => setDepartmentListTab("expected")}
          >
            Expects{" "}
            <span className={styles.tabNum} data-zero={expects.length === 0 ? "true" : undefined}>
              {expects.length === 0 ? "none" : expects.length}
            </span>
          </button>
          <button
            type="button"
            role="tab"
            id="ward-ed-forms-tab"
            aria-label={`Forms, ${underFormPatients.length === 0 ? "none" : underFormPatients.length}`}
            aria-selected={departmentListTab === "forms"}
            aria-controls="ward-ed-forms-panel"
            tabIndex={departmentListTab === "forms" ? 0 : -1}
            className={styles.tabBtn}
            onClick={() => setDepartmentListTab("forms")}
          >
            Forms{" "}
            <span className={styles.tabNum} data-zero={underFormPatients.length === 0 ? "true" : undefined}>
              {underFormPatients.length === 0 ? "none" : underFormPatients.length}
            </span>
          </button>
          <button
            type="button"
            role="tab"
            id="ward-ed-referred-tab"
            aria-label="Referred · Still to be moved"
            aria-selected={departmentListTab === "referred"}
            aria-controls="ward-ed-outbox-panel"
            tabIndex={departmentListTab === "referred" ? 0 : -1}
            className={styles.tabBtn}
            onClick={() => setDepartmentListTab("referred")}
          >
            Referred{" "}
            <span className={styles.tabNum} data-zero={outbox.length + answeredAll.length === 0 ? "true" : undefined}>
              {outbox.length + answeredAll.length === 0 ? "none" : outbox.length + answeredAll.length}
            </span>
          </button>
        </div>

        <section
          id="ward-ed-review-panel"
          role="tabpanel"
          aria-labelledby="ward-ed-review-tab"
          aria-label="Awaiting review"
          hidden={departmentListTab !== "review"}
          className={styles.lstWrap}
          tabIndex={0}
        >
          <EdInboxReferrals ctx={ctx} />

          <h2 className={styles.sectionHeading}>
            Awaiting Review &middot; {awaitingReviewPatients.length} patient
            {awaitingReviewPatients.length === 1 ? "" : "s"}
          </h2>
          <p className={styles.unitMeta}>Patients in department without a recorded psychiatric review.</p>
          {awaitingReviewPatients.length === 0 ? (
            <p className={styles.none}>Everyone on the list has a recorded review.</p>
          ) : (
            <ul className={styles.lst}>
              {awaitingReviewPatients.map((m) => {
                const mc = movementMedicalClearance(m, referrals);
                const patientInfo = resolveSubjectPatient(m, {
                  patients: registryPatients,
                  referrals,
                  movements,
                });
                return (
                  <li key={m.id} className={styles.lstRow} data-tone="quiet">
                    <span className={styles.tick} data-tone="quiet" aria-hidden="true" />
                    <span className={styles.lstMain}>
                      <span className={styles.lstTitle}>
                        <button type="button" className={styles.nameBtn} onClick={() => setSelectedPatientId(m.id)}>
                          {patientInfo.displayName}
                        </button>
                      </span>
                      <span className={styles.meta}>
                        {/* Owner, 26 Sept 2026: the id button duplicated the name button above it. */}
                        <span className={styles.umrnNote}>
                          UMRN: <strong>{patientInfo.umrn}</strong>
                        </span>
                        <span className={styles.bayNumber}>{patientBay(m.id)}</span>
                        <span>{m.cohort}</span>
                        <span>{m.sex}</span>
                      </span>
                      <span className={styles.lstWhy}>
                        {outstandingItem(m).label}.{" "}
                        {mc?.cleared
                          ? `Medically cleared at ${formatInstantWithDay(mc.at, now)}.`
                          : mc
                            ? "Not medically cleared."
                            : "Clearance pending."}
                      </span>
                    </span>
                    <span className={styles.lstEnd}>
                      <span className={styles.stamp}>{splitDuration(Math.max(now - m.openedAt, 0))} here</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section
          id="ward-ed-cleared-panel"
          role="tabpanel"
          aria-labelledby="ward-ed-cleared-tab"
          aria-label="Medical clearance"
          hidden={departmentListTab !== "cleared"}
          className={styles.lstWrap}
          tabIndex={0}
        >
          <h2 className={styles.sectionHeading}>
            Medical Clearance &middot; {clearedPatients.length} patient
            {clearedPatients.length === 1 ? "" : "s"}
          </h2>
          <p className={styles.unitMeta}>Patients marked medically cleared for psychiatric assessment.</p>
          {clearedPatients.length === 0 ? (
            <p className={styles.none}>No medical clearance recorded.</p>
          ) : (
            <ul className={styles.lst}>
              {clearedPatients.map((m) => {
                const reviewed = !!m.examination;
                const mc = movementMedicalClearance(m, referrals);
                const patientInfo = resolveSubjectPatient(m, {
                  patients: registryPatients,
                  referrals,
                  movements,
                });
                return (
                  <li key={m.id} className={styles.lstRow} data-tone={reviewed ? "quiet" : "warn"}>
                    <span className={styles.tick} data-tone={reviewed ? "quiet" : "warn"} aria-hidden="true" />
                    <span className={styles.lstMain}>
                      <span className={styles.lstTitle}>
                        <button type="button" className={styles.nameBtn} onClick={() => setSelectedPatientId(m.id)}>
                          {patientInfo.displayName}
                        </button>
                      </span>
                      <span className={styles.meta}>
                        {/* Owner, 26 Sept 2026: the id button duplicated the name button above it. */}
                        <span className={styles.umrnNote}>
                          UMRN: <strong>{patientInfo.umrn}</strong>
                        </span>
                        <span className={styles.bayNumber}>{patientBay(m.id)}</span>
                        <span>{m.cohort}</span>
                        <span>{m.sex}</span>
                      </span>
                      <span className={styles.lstWhy}>
                        {reviewed ? "Reviewed by psychiatry. " : "Not seen by psychiatry yet. "}
                        {edStageLabel(m.stage)}
                      </span>
                    </span>
                    <span className={styles.lstEnd}>
                      <span className={styles.stamp}>
                        {mc?.at ? `cleared ${formatInstantWithDay(mc.at, now)}` : "cleared"}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section
          id="ward-ed-expected-panel"
          role="tabpanel"
          aria-labelledby="ward-ed-expected-tab"
          aria-label="Expects"
          data-testid="ward-ed-expects"
          hidden={departmentListTab !== "expected"}
          className={styles.lstWrap}
          tabIndex={0}
        >
          <h2 className={styles.sectionHeading}>
            Expects &middot; {expects.length} patient{expects.length === 1 ? "" : "s"}
          </h2>
          <p className={styles.unitMeta}>Not yet in the department. Accepted referrals stay until arrival is marked.</p>
          {expects.length === 0 ? (
            <p className={styles.placeholder} data-testid="ward-ed-expects-empty">
              No expects recorded for psychiatry at {department.name}.
            </p>
          ) : (
            <ul className={styles.cardList}>
              {expects.map(({ referral, destination }) => {
                const waiting = Math.max(0, now - referral.raisedAt);
                const reconsider = waiting >= EXPECT_RECONSIDER_AFTER_MINUTES;
                const eta = movements.find((m) => m.referralId === referral.id)?.transport?.estimatedAt;
                return (
                  <li
                    key={`${referral.id}-${destination.edId}`}
                    className={styles.card}
                    data-testid={`ward-ed-expects-row-${referral.id}`}
                    data-minutes-waiting={waiting}
                    data-reconsider={reconsider ? "true" : "false"}
                  >
                    <header className={styles.cardHeader}>
                      <strong>
                        {patientIdentityLine(
                          resolveSubjectPatient(referral, { patients: registryPatients, referrals, movements }),
                        )}
                      </strong>
                      <span className={styles.cardMeta}>{referralPurposeLabel(destination.purpose)}</span>
                    </header>
                    <p className={styles.cardMeta}>{referralPersonFacts(referral).join(" · ")}</p>
                    <dl className={styles.clockGrid} data-testid={`ward-ed-expects-clock-${referral.id}`}>
                      {eta !== undefined ? (
                        <div className={styles.clockRow}>
                          <dt>Estimated arrival</dt>
                          <dd>{formatInstantWithDay(eta, now)}</dd>
                        </div>
                      ) : null}
                      <div className={styles.clockRow}>
                        <dt>Waiting since referral</dt>
                        <dd>{formatElapsed(waiting)}</dd>
                      </div>
                    </dl>
                    {reconsider ? (
                      <p
                        className={styles.placeholder}
                        data-testid={`ward-ed-expects-reconsider-${referral.id}`}
                        title={OPERATIONAL_DEFAULT_LABEL}
                      >
                        Referred over {EXPECT_RECONSIDER_AFTER_MINUTES / 60} hours ago and not arrived. Does it still
                        stand?
                      </p>
                    ) : null}
                    <button
                      type="button"
                      className={styles.arrivedButton}
                      data-testid={`ward-ed-expects-arrived-${referral.id}`}
                      onClick={() =>
                        recordEdStep({
                          type: "RECORD_ARRIVED_IN_DEPARTMENT",
                          role: "ed",
                          now,
                          referralId: referral.id,
                        })
                      }
                    >
                      Mark arrived in department
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section
          id="ward-ed-forms-panel"
          role="tabpanel"
          aria-labelledby="ward-ed-forms-tab"
          aria-label="Forms"
          hidden={departmentListTab !== "forms"}
          className={styles.lstWrap}
          tabIndex={0}
        >
          <h2 className={styles.sectionHeading}>
            Forms &middot; {underFormPatients.length} patient{underFormPatients.length === 1 ? "" : "s"}
          </h2>
          <p className={styles.unitMeta}>Patients with a recorded involuntary form.</p>
          {underFormPatients.length === 0 ? (
            <p className={styles.none}>No legal form recorded.</p>
          ) : (
            <ul className={styles.lst}>
              {underFormPatients.map((m) => {
                const due = m.legalForm?.dueAt;
                const tone = due === null || due === undefined ? "quiet" : due < now ? "danger" : "good";
                const stamp =
                  due === null || due === undefined
                    ? "no deadline"
                    : due < now
                      ? `passed ${formatInstantWithDay(due, now)}`
                      : `due ${formatInstantWithDay(due, now)}`;
                const patientInfo = resolveSubjectPatient(m, {
                  patients: registryPatients,
                  referrals,
                  movements,
                });
                return (
                  <li key={m.id} className={styles.lstRow} data-tone={tone}>
                    <span className={styles.tick} data-tone={tone} aria-hidden="true" />
                    <span className={styles.lstMain}>
                      <span className={styles.lstTitle}>
                        <button type="button" className={styles.nameBtn} onClick={() => setSelectedPatientId(m.id)}>
                          {patientInfo.displayName}
                        </button>
                      </span>
                      <span className={styles.meta}>
                        {/* Owner, 26 Sept 2026: the id button duplicated the name button above it. */}
                        <span className={styles.umrnNote}>
                          UMRN: <strong>{patientInfo.umrn}</strong>
                        </span>
                        <span className={styles.bayNumber}>{patientBay(m.id)}</span>
                        <span>{m.cohort}</span>
                        <span>{m.sex}</span>
                      </span>
                      <span className={styles.lstWhy}>
                        {/* Legal times only as typed (31 Oct 2026): never "passed … ago" or "… away". */}
                        Form {m.legalForm ? m.legalForm.code : ""}.{" "}
                        {due === null || due === undefined
                          ? "No deadline is recorded against it."
                          : `${typedTimeLine(due, now)}.`}
                      </span>
                    </span>
                    <span className={styles.lstEnd}>
                      <span className={styles.stamp}>{stamp}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        <EdReferredPanel ctx={ctx} />
      </section>
    </section>
  );
}
