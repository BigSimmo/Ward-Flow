"use client";

// ED Lists, mock-up round 2 (Josh, 1 Nov 2026): one card, in the pattern of the rebuilt Capacity and
// Waiting pages. Three lists only: Awaiting review, Expected and Forms. Medical clearance is in the
// handover table's Checks column and Referred is in Review, so both tabs left. Each person is one
// row, surname first with the UMRN, under quiet capital column heads.
import { useState } from "react";
import { buttonClass, Segmented, StatusGlyph } from "@/components/wf";
import { formatElapsed, formatInstantWithDay, splitDuration } from "@/components/ward-management/ward-clock";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { referralPurposeLabel } from "@/components/ward-management/ward-referrals";
import type { EdScreenContext } from "@/components/ward-management/ed/ed-screen-context";
import { outstandingItem } from "@/components/ward-management/ed/ed-screen-model";
import { recordedEdDeparture } from "@/components/ward-management/ward-ed-presence";
import { formTitleForCode } from "@/lib/form-register";
import { LegalLimitsNotChecked } from "@/components/ward-management/legal-limits-not-checked";
import { ReferralIntakeSummary } from "@/components/ward-management/referrals/referral-intake-summary";
import redesign from "./ed-board-redesign.module.css";

type ListKey = "review" | "expected" | "forms";

export function EdListsCard({ ctx }: { ctx: EdScreenContext }) {
  const {
    now,
    department,
    movements,
    referrals,
    registryPatients,
    recordEdStep,
    setSelectedPatientId,
    patientBay,
    awaitingReviewPatients,
    expects,
    underFormPatients,
    inbox,
    referralDetailsOpenFor,
    setReferralDetailsOpenFor,
  } = ctx;
  const [list, setList] = useState<ListKey>("review");
  const who = (subject: Parameters<typeof resolveSubjectPatient>[0]) =>
    resolveSubjectPatient(subject, { patients: registryPatients, referrals, movements });
  const minutesHere = (m: (typeof awaitingReviewPatients)[number]) =>
    Math.max(Math.min(now, recordedEdDeparture(m) ?? now) - m.openedAt, 0);
  const review = [...awaitingReviewPatients].sort((a, b) => minutesHere(b) - minutesHere(a));
  const count = (n: number) => (n === 0 ? "none" : n);

  const name = (id: string, formal: string, umrn: string) => (
    <span className={redesign.listWho}>
      <button type="button" className={redesign.listName} onClick={() => setSelectedPatientId(id)}>
        {formal}
      </button>
      <span className={redesign.listUmrn}>{umrn}</span>
    </span>
  );

  return (
    <section className={`${redesign.listsCard}`} aria-labelledby="ward-ed-lists-heading" data-pane="lists">
      <header className={redesign.listsHead}>
        <h2 id="ward-ed-lists-heading">Lists</h2>
        <Segmented<ListKey>
          label="Lists"
          size="sm"
          value={list}
          onChange={setList}
          items={[
            { id: "review", label: "Awaiting review", count: count(review.length + inbox.length) },
            { id: "expected", label: "Expected", count: count(expects.length) },
            { id: "forms", label: "Forms", count: count(underFormPatients.length) },
          ]}
        />
      </header>

      {list === "review" ? (
        <table className={redesign.listTable} aria-label="Awaiting psychiatric review">
          <colgroup>
            <col />
            <col className={redesign.colBay} />
            <col className={redesign.colFacts} />
            <col className={redesign.colStep} />
            <col className={redesign.colEnd} />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">Person</th>
              <th scope="col">Bay</th>
              <th scope="col">Cohort</th>
              <th scope="col">Next step</th>
              <th scope="col" className={redesign.alignEnd}>
                In ED
              </th>
            </tr>
          </thead>
          {inbox.length > 0 ? (
            <tbody>
              <tr className={redesign.listGroup}>
                <td colSpan={5}>
                  New referral <span className={redesign.bandCount}>{inbox.length}</span>
                  <span className={redesign.bandNote}>for psychiatric review</span>
                </td>
              </tr>
              {inbox.map(({ referral, destination }) => {
                const person = who(referral);
                const open = referralDetailsOpenFor === referral.id;
                const linked = movements.find((m) => m.referralId === referral.id);
                return [
                  <tr key={referral.id}>
                    <td>
                      <span className={redesign.listWho}>
                        <span className={redesign.listNameStatic}>{person.formalName}</span>
                        <span className={redesign.listUmrn}>{person.umrn}</span>
                      </span>
                    </td>
                    <td className={redesign.listMono}>{linked ? patientBay(linked.id).replace(/^Bay /, "") : "–"}</td>
                    <td>{[linked?.cohort, linked?.sex].filter(Boolean).join(" · ") || "–"}</td>
                    <td>
                      <span className={redesign.listTag} data-tone="accent">
                        {referralPurposeLabel(destination.purpose)}
                      </span>
                    </td>
                    <td className={redesign.alignEnd}>
                      <button
                        type="button"
                        className={buttonClass({ variant: "sec", size: "md" })}
                        aria-expanded={open}
                        onClick={() =>
                          setReferralDetailsOpenFor((current) => (current === referral.id ? undefined : referral.id))
                        }
                      >
                        {open ? "Hide referral" : "View referral"}
                      </button>
                    </td>
                  </tr>,
                  open ? (
                    <tr key={`${referral.id}-details`} className={redesign.listDetails}>
                      <td colSpan={5}>
                        <ReferralIntakeSummary intake={referral.intake} />
                        <div className={redesign.listDetailActions}>
                          <span>
                            Medically cleared:{" "}
                            <b>
                              {referral.medicalClearance === undefined
                                ? "Not assessed"
                                : `${referral.medicalClearance.cleared ? "Yes" : "No"}, recorded ${formatInstantWithDay(referral.medicalClearance.at, now)}`}
                            </b>
                          </span>
                          <button
                            type="button"
                            className={buttonClass({ variant: "sec", size: "md" })}
                            onClick={() =>
                              recordEdStep({
                                type: "RECORD_MEDICAL_CLEARANCE",
                                role: "ed",
                                now,
                                referralId: referral.id,
                                cleared: true,
                              })
                            }
                          >
                            Record medically cleared
                          </button>
                          <button
                            type="button"
                            className={buttonClass({ variant: "ghost", size: "md" })}
                            onClick={() =>
                              recordEdStep({
                                type: "RECORD_MEDICAL_CLEARANCE",
                                role: "ed",
                                now,
                                referralId: referral.id,
                                cleared: false,
                              })
                            }
                          >
                            Record not medically cleared
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : null,
                ];
              })}
            </tbody>
          ) : null}
          <tbody>
            {inbox.length > 0 ? (
              <tr className={redesign.listGroup}>
                <td colSpan={5}>
                  In the department <span className={redesign.bandCount}>{review.length}</span>
                  <span className={redesign.bandNote}>longest here first</span>
                </td>
              </tr>
            ) : null}
            {review.length === 0 ? (
              <tr>
                <td colSpan={5} className={redesign.listEmpty}>
                  Everyone on this department&rsquo;s psychiatry list has been seen. Absence here means every referral
                  has a recorded review, not that no referral was made.
                </td>
              </tr>
            ) : (
              review.map((m) => {
                const person = who(m);
                const minutes = minutesHere(m);
                const tone = minutes >= ctx.accessTarget ? "danger" : minutes >= 480 ? "warning" : undefined;
                return (
                  <tr key={m.id}>
                    <td>{name(m.id, person.formalName, person.umrn)}</td>
                    <td className={redesign.listMono}>{patientBay(m.id).replace(/^Bay /, "")}</td>
                    <td>
                      {m.cohort} · {m.sex}
                    </td>
                    <td>
                      <span className={redesign.listTag}>{outstandingItem(m).label}</span>
                    </td>
                    <td className={redesign.alignEnd}>
                      <span className={redesign.listTime}>
                        {tone ? <StatusGlyph tone={tone} size={8} /> : null}
                        {splitDuration(minutes)}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      ) : null}

      {list === "expected" ? (
        expects.length === 0 ? (
          <p className={redesign.listEmptyBlock} data-testid="ward-ed-expects-empty">
            No expects are recorded for psychiatry at {department.name}; this does not establish that nobody is on the
            way.
          </p>
        ) : (
          <table className={redesign.listTable} aria-label="Expected">
            <thead>
              <tr>
                <th scope="col">Person</th>
                <th scope="col">Referred for</th>
                <th scope="col">Estimated arrival</th>
                <th scope="col">Since referral</th>
                <th scope="col" className={redesign.alignEnd}>
                  <span className="sr-only">Action</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {expects.map(({ referral, destination }) => {
                const person = who(referral);
                const eta = movements.find((m) => m.referralId === referral.id)?.transport?.estimatedAt;
                return (
                  <tr key={`${referral.id}-${destination.edId}`}>
                    <td>
                      <span className={redesign.listWho}>
                        <span className={redesign.listNameStatic}>{person.formalName}</span>
                        <span className={redesign.listUmrn}>{person.umrn}</span>
                      </span>
                    </td>
                    <td>{referralPurposeLabel(destination.purpose)}</td>
                    <td>{eta === undefined ? "Not recorded" : formatInstantWithDay(eta, now)}</td>
                    <td className={redesign.listMono}>{formatElapsed(Math.max(0, now - referral.raisedAt))}</td>
                    <td className={redesign.alignEnd}>
                      <button
                        type="button"
                        className={buttonClass({ variant: "sec", size: "md" })}
                        onClick={() =>
                          recordEdStep({
                            type: "RECORD_ARRIVED_IN_DEPARTMENT",
                            role: "ed",
                            now,
                            referralId: referral.id,
                          })
                        }
                      >
                        Mark arrived
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )
      ) : null}

      {list === "forms" ? (
        underFormPatients.length === 0 ? (
          <p className={redesign.listEmptyBlock}>
            Nobody on this department&rsquo;s list is under a legal form. Absence here means no form is recorded, not
            that no form applies.
          </p>
        ) : (
          <table className={redesign.listTable} aria-label="Forms">
            <colgroup>
              <col />
              <col className={redesign.colBay} />
              <col className={redesign.colForm} />
              <col className={redesign.colExpiry} />
            </colgroup>
            <thead>
              <tr>
                <th scope="col">Person</th>
                <th scope="col">Bay</th>
                <th scope="col">Form</th>
                <th scope="col">Expiry</th>
              </tr>
            </thead>
            <tbody>
              {underFormPatients.map((m) => {
                const person = who(m);
                const due = m.legalForm?.dueAt;
                return (
                  <tr key={m.id}>
                    <td>{name(m.id, person.formalName, person.umrn)}</td>
                    <td className={redesign.listMono}>{patientBay(m.id).replace(/^Bay /, "")}</td>
                    <td>
                      <span className={redesign.listTag}>Form {m.legalForm?.code}</span>{" "}
                      <span className={redesign.listQuiet}>{formTitleForCode(m.legalForm?.code ?? "")}</span>
                    </td>
                    <td>
                      {due === undefined || due === null ? (
                        <span className={redesign.listQuiet}>Not recorded</span>
                      ) : (
                        <span>
                          {`${due < now ? "ended" : "ends"} ${formatInstantWithDay(due, now)} as typed`}{" "}
                          <LegalLimitsNotChecked variant="tag" />
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )
      ) : null}
    </section>
  );
}
