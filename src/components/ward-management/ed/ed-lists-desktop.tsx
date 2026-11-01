"use client";

// ED Lists (Josh, 1 Nov 2026), built from the approved mock-up `ward-redesign/ed-board/ed-lists-handover.tsx`: one card, in the pattern of the rebuilt Capacity and
// Waiting pages. Three lists only: Awaiting review, Expected and Forms. Medical clearance is in the
// handover table's Checks column and Referred is in Review, so both tabs left. Each person is one
// row, surname first with the UMRN, under quiet capital column heads.
import { useState } from "react";
import { buttonClass, Segmented, StatusGlyph } from "@/components/wf";
import { formatElapsed, formatInstantWithDay, splitDuration } from "@/components/ward-management/ward-clock";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { referralPurposeLabel } from "@/components/ward-management/ward-referrals";
import type { EdScreenContext } from "./ed-screen-context";
import { outstandingItem } from "./ed-screen-model";
import { askForBedFromReferral } from "./ed-screen-inbox";
import { recordedEdDeparture } from "@/components/ward-management/ward-ed-presence";
import { formTitleForCode } from "@/lib/form-register";
import { LegalLimitsNotChecked } from "@/components/ward-management/legal-limits-not-checked";
import { ReferralIntakeSummary } from "@/components/ward-management/referrals/referral-intake-summary";
import handover from "./ed-handover.module.css";

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
    <span className={handover.listWho}>
      <button type="button" className={handover.listName} onClick={() => setSelectedPatientId(id)}>
        {formal}
      </button>
      <span className={handover.listUmrn}>{umrn}</span>
    </span>
  );

  return (
    <section className={`${handover.listsCard}`} aria-labelledby="ward-ed-lists-heading" data-pane="lists">
      <header className={handover.listsHead}>
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
        <table className={handover.listTable} aria-label="Awaiting psychiatric review">
          <colgroup>
            <col />
            <col className={handover.colBay} />
            <col className={handover.colFacts} />
            <col className={handover.colStep} />
            <col className={handover.colEnd} />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">Person</th>
              <th scope="col">Bay</th>
              <th scope="col">Cohort</th>
              <th scope="col">Next step</th>
              <th scope="col" className={handover.alignEnd}>
                In ED
              </th>
            </tr>
          </thead>
          {inbox.length > 0 ? (
            <tbody>
              <tr className={handover.listGroup}>
                <td colSpan={5}>
                  New referral <span className={handover.bandCount}>{inbox.length}</span>
                  <span className={handover.bandNote}>for psychiatric review</span>
                </td>
              </tr>
              {inbox.map(({ referral, destination }) => {
                const person = who(referral);
                const open = referralDetailsOpenFor === referral.id;
                const linked = movements.find((m) => m.referralId === referral.id);
                return [
                  <tr
                    key={referral.id}
                    data-testid={`ward-ed-inbox-row-${referral.id}`}
                    data-purpose={destination.purpose}
                    data-ed-id={destination.edId}
                  >
                    <td>
                      <span className={handover.listWho}>
                        <span className={handover.listNameStatic}>{person.formalName}</span>
                        <span className={handover.listUmrn}>{person.umrn}</span>
                      </span>
                    </td>
                    <td className={handover.listMono}>{linked ? patientBay(linked.id).replace(/^Bay /, "") : "–"}</td>
                    <td>{[linked?.cohort, linked?.sex].filter(Boolean).join(" · ") || "–"}</td>
                    <td>
                      <span className={handover.listTag} data-tone="accent">
                        {referralPurposeLabel(destination.purpose)}
                      </span>
                    </td>
                    <td className={handover.alignEnd}>
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
                    <tr key={`${referral.id}-details`} className={handover.listDetails}>
                      <td colSpan={5}>
                        <ReferralIntakeSummary intake={referral.intake} />
                        <div className={handover.listDetailActions}>
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
                          {linked ? null : (
                            <button
                              type="button"
                              className={buttonClass({ variant: "pri", size: "md" })}
                              data-testid={`ward-ed-inbox-raise-${referral.id}`}
                              onClick={() => askForBedFromReferral(ctx, referral)}
                            >
                              Ask for a bed
                            </button>
                          )}
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
              <tr className={handover.listGroup}>
                <td colSpan={5}>
                  In the department <span className={handover.bandCount}>{review.length}</span>
                  <span className={handover.bandNote}>longest here first</span>
                </td>
              </tr>
            ) : null}
            {review.length === 0 ? (
              <tr>
                <td colSpan={5} className={handover.listEmpty}>
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
                    <td className={handover.listMono}>{patientBay(m.id).replace(/^Bay /, "")}</td>
                    <td>
                      {m.cohort} · {m.sex}
                    </td>
                    <td>
                      <span className={handover.listTag}>{outstandingItem(m).label}</span>
                    </td>
                    <td className={handover.alignEnd}>
                      <span className={handover.listTime}>
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
          <p className={handover.listEmptyBlock} data-testid="ward-ed-expects-empty">
            No expects are recorded for psychiatry at {department.name}; this does not establish that nobody is on the
            way.
          </p>
        ) : (
          <table className={handover.listTable} aria-label="Expected">
            <thead>
              <tr>
                <th scope="col">Person</th>
                <th scope="col">Referred for</th>
                <th scope="col">Estimated arrival</th>
                <th scope="col">Since referral</th>
                <th scope="col" className={handover.alignEnd}>
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
                      <span className={handover.listWho}>
                        <span className={handover.listNameStatic}>{person.formalName}</span>
                        <span className={handover.listUmrn}>{person.umrn}</span>
                      </span>
                    </td>
                    <td>{referralPurposeLabel(destination.purpose)}</td>
                    <td>{eta === undefined ? "Not recorded" : formatInstantWithDay(eta, now)}</td>
                    <td className={handover.listMono}>{formatElapsed(Math.max(0, now - referral.raisedAt))}</td>
                    <td className={handover.alignEnd}>
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
          <p className={handover.listEmptyBlock}>
            Nobody on this department&rsquo;s list is under a legal form. Absence here means no form is recorded, not
            that no form applies.
          </p>
        ) : (
          <table className={handover.listTable} aria-label="Forms">
            <colgroup>
              <col />
              <col className={handover.colBay} />
              <col className={handover.colForm} />
              <col className={handover.colExpiry} />
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
                    <td className={handover.listMono}>{patientBay(m.id).replace(/^Bay /, "")}</td>
                    <td>
                      <span className={handover.listTag}>Form {m.legalForm?.code}</span>{" "}
                      <span className={handover.listQuiet}>{formTitleForCode(m.legalForm?.code ?? "")}</span>
                    </td>
                    <td>
                      {due === undefined || due === null ? (
                        <span className={handover.listQuiet}>Not recorded</span>
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
