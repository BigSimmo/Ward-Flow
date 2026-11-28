"use client";

// ED Lists (Josh, 1 Nov 2026), built from the approved mock-up `ward-redesign/ed-board/ed-lists-handover.tsx`: one card, in the pattern of the rebuilt Capacity and
// Waiting pages. Three lists only: Awaiting review, Expected and Forms. Medical clearance is in the
// handover table's Checks column and Referred is in Review, so both tabs left. Each person is one
// row, surname first with the UMRN, under quiet capital column heads.
import { buttonClass, StatusGlyph } from "@/components/wf";
import { formatElapsed, formatInstantWithDay, splitDuration } from "@/components/ward-management/ward-clock";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { referralClocks, referralPurposeLabel } from "@/components/ward-management/ward-referrals";
import type { EdScreenContext } from "./ed-screen-context";
import { edReferralClockLines, outstandingItem } from "./ed-screen-model";
import { askForBedFromReferral, EdInboxDecline } from "./ed-screen-inbox";
import { recordedEdDeparture } from "@/components/ward-management/ward-ed-presence";
import {
  ED_SEVERE_PRESSURE_WAIT_MINUTES,
  EXPECT_RECONSIDER_AFTER_MINUTES,
  OPERATIONAL_DEFAULT_LABEL,
} from "@/components/ward-management/ward-operational-defaults";
import { formTitleForCode } from "@/lib/form-register";
import {
  currentLegalPosition,
  FORM_RECORDED_ENDED,
  legalFormNowWords,
} from "@/components/ward-management/ward-legal-form-progression";
import { ReferralIntakeSummary } from "@/components/ward-management/referrals/referral-intake-summary";
import { psychReviewStage } from "./ed-psych-review";
import handover from "./ed-handover.module.css";

/** What every list table shares: who a row is, the name button, and the review list, longest here first. */
function listParts(ctx: EdScreenContext) {
  const { now, movements, referrals, registryPatients, setSelectedPatientId, awaitingReviewPatients } = ctx;
  const who = (subject: Parameters<typeof resolveSubjectPatient>[0]) =>
    resolveSubjectPatient(subject, { patients: registryPatients, referrals, movements });
  const minutesHere = (m: (typeof awaitingReviewPatients)[number]) =>
    Math.max(Math.min(now, recordedEdDeparture(m) ?? now) - m.openedAt, 0);
  const review = [...awaitingReviewPatients].sort((a, b) => minutesHere(b) - minutesHere(a));
  const name = (id: string, formal: string, umrn: string) => (
    <span className={handover.listWho}>
      <button type="button" className={handover.listName} onClick={() => setSelectedPatientId(id)}>
        {formal}
      </button>
      <span className={handover.listUmrn}>{umrn}</span>
    </span>
  );
  return { who, minutesHere, review, name };
}

/** How many people each list holds; My list hides a section that holds nobody. */
export function edListCounts(ctx: EdScreenContext) {
  return {
    review: ctx.awaitingReviewPatients.length + ctx.inbox.length,
    expected: ctx.expects.length,
    forms: ctx.underFormPatients.length,
  };
}

/** Everything My list holds: the sum of its parts, so the tab count matches the rows (audit two, B13). */
export function edMyListCount(ctx: EdScreenContext) {
  const counts = edListCounts(ctx);
  return (
    ctx.needsYouItems.length +
    counts.review +
    ctx.clearedPatients.length +
    counts.expected +
    counts.forms +
    ctx.outbox.length +
    ctx.answeredAll.length
  );
}

/** Awaiting review, with its New referral group first. Columns as on the Lists card. */
export function EdReviewTable({ ctx }: { ctx: EdScreenContext }) {
  const { now, movements, recordEdStep, inbox, referralDetailsOpenFor, setReferralDetailsOpenFor } = ctx;
  const { who, minutesHere, review, name } = listParts(ctx);
  return (
    <table className={handover.listTable} aria-label="Awaiting psychiatric review">
      {/* Table polish (Nov 2026): Person no longer takes half the width, so Bay and Cohort sit
              beside the name and the spare width goes to Next step. */}
      <colgroup>
        <col className={handover.colPersonList} />
        <col className={handover.colBay} />
        <col className={handover.colFacts} />
        <col />
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
          <tr className={handover.listGroup} data-testid="ward-ed-inbox-group">
            <td colSpan={5}>
              New referral <span className={handover.bandCount}>{inbox.length}</span>
              <span className={handover.bandNote}>for psychiatric review</span>
            </td>
          </tr>
          {inbox.map(({ referral, destination, addressing }) => {
            // Audit two, B14: one filled "Ask for a bed" for the table, on the first row that offers it.
            const firstAskId = inbox.find((entry) => !movements.some((m) => m.referralId === entry.referral.id))
              ?.referral.id;
            const person = who(referral);
            const open = referralDetailsOpenFor === referral.id;
            const linked = movements.find((m) => m.referralId === referral.id);
            const clockLines = edReferralClockLines(referralClocks(referral, now));
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
                  {/* Both clocks stay with the referral for screen readers; the mock-up shows neither. */}
                  <dl className="sr-only" data-testid={`ward-ed-inbox-clocks-${referral.id}`}>
                    <div data-testid={`ward-ed-inbox-department-clock-${referral.id}`}>
                      <dt>{clockLines.department.term}</dt>
                      <dd>{clockLines.department.value}</dd>
                    </div>
                    <div data-testid={`ward-ed-inbox-referral-clock-${referral.id}`}>
                      <dt>{clockLines.referral.term}</dt>
                      <dd>{clockLines.referral.value}</dd>
                    </div>
                  </dl>
                </td>
                <td className={handover.listMono}>
                  <span className={handover.listQuiet} title="Bay not recorded">
                    –
                  </span>
                </td>
                <td>{[linked?.cohort, linked?.sex].filter(Boolean).join(" · ") || "–"}</td>
                <td>
                  <span
                    className={handover.listTag}
                    data-tone="accent"
                    data-testid={`ward-ed-inbox-purpose-${referral.id}`}
                  >
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
                    {open ? "Hide referral" : "Show referral"}
                  </button>
                  {linked ? null : (
                    <button
                      type="button"
                      className={buttonClass({ variant: referral.id === firstAskId ? "pri" : "sec", size: "md" })}
                      data-testid={`ward-ed-inbox-raise-${referral.id}`}
                      onClick={() => askForBedFromReferral(ctx, referral)}
                    >
                      Ask for a bed
                    </button>
                  )}
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
                      {/* Q128 (Josh, 1 Nov 2026): Decline sits inside the opened referral. */}
                      <EdInboxDecline ctx={ctx} referralId={referral.id} queued={addressing.state === "queued"} />
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
              Everyone on this department&rsquo;s psychiatry list has been seen. Absence here means every referral has a
              recorded review, not that no referral was made.
            </td>
          </tr>
        ) : (
          review.map((m) => {
            const person = who(m);
            const minutes = minutesHere(m);
            const tone =
              minutes >= ctx.accessTarget
                ? "danger"
                : minutes >= ED_SEVERE_PRESSURE_WAIT_MINUTES
                  ? "warning"
                  : undefined;
            // Psychiatry review tracker (Josh, 9 Nov 2026): the stage as recorded, in the row's
            // own place. The list keeps its order; the stage never moves a row.
            const stage = psychReviewStage(m, now, minutes);
            const reviewButton = (
              label: string,
              spoken: string,
              event: Parameters<typeof recordEdStep>[0],
              testId: string,
            ) => (
              <button
                key={testId}
                type="button"
                className={buttonClass({ variant: "sec", size: "sm" })}
                data-testid={`${testId}-${m.id}`}
                aria-label={`${spoken} for ${person.formalName}`}
                onClick={() => recordEdStep(event)}
              >
                {label}
              </button>
            );
            return (
              <tr key={m.id} data-testid={`ward-ed-review-row-${m.id}`}>
                <td>{name(m.id, person.formalName, person.umrn)}</td>
                <td className={handover.listMono}>
                  <span className={handover.listQuiet} title="Bay not recorded">
                    –
                  </span>
                </td>
                <td>
                  {m.cohort} · {m.sex}
                </td>
                <td>
                  <span className={handover.listReview}>
                    <span className={handover.listReviewText}>
                      <span className={handover.listTag}>{outstandingItem(m).label}</span>
                      <span className={handover.listReviewLine} data-testid={`ward-ed-review-stage-${m.id}`}>
                        {stage.line}
                      </span>
                    </span>
                    {stage.next[0] === "ask" ? (
                      reviewButton(
                        "Ask for review",
                        "Ask for review",
                        { type: "REQUEST_PSYCH_REVIEW", role: "ed", now, movementId: m.id },
                        "ward-ed-review-ask",
                      )
                    ) : stage.next.length > 0 ? (
                      // Either grade can be seen first, so both stay offered until one is recorded.
                      <span className={handover.listReviewSeen}>
                        {stage.next.length > 1 ? <span className={handover.listReviewSeenBy}>Seen by</span> : null}
                        {stage.next.map((grade) => {
                          const title = grade === "registrar" ? "Registrar" : "Consultant";
                          return reviewButton(
                            stage.next.length > 1 ? title : `${title} seen`,
                            `${title} seen`,
                            {
                              type: "RECORD_PSYCH_REVIEW_SEEN",
                              role: "ed",
                              now,
                              movementId: m.id,
                              grade: grade as "registrar" | "consultant",
                            },
                            `ward-ed-review-${grade}`,
                          );
                        })}
                      </span>
                    ) : null}
                  </span>
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
  );
}

/** Expected: referred here and not yet arrived. */
export function EdExpectedTable({ ctx }: { ctx: EdScreenContext }) {
  const { now, department, movements, recordEdStep, expects } = ctx;
  const { who } = listParts(ctx);
  return expects.length === 0 ? (
    <p className={handover.listEmptyBlock} data-testid="ward-ed-expects-empty">
      No expects are recorded for psychiatry at {department.name}; this does not establish that nobody is on the way.
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
            <tr key={`${referral.id}-${destination.edId}`} data-minutes-waiting={now - referral.raisedAt}>
              <td>
                <span className={handover.listWho}>
                  <span className={handover.listNameStatic}>{person.formalName}</span>
                  <span className={handover.listUmrn}>{person.umrn}</span>
                </span>
              </td>
              <td>{referralPurposeLabel(destination.purpose)}</td>
              <td>{eta === undefined ? "Not recorded" : formatInstantWithDay(eta, now)}</td>
              <td className={handover.listMono}>
                {formatElapsed(now - referral.raisedAt)}
                {/* Untested-537 VALUE-049: the same reconsider note the phone list shows. */}
                {now - referral.raisedAt >= EXPECT_RECONSIDER_AFTER_MINUTES ? (
                  <div
                    className={handover.listReviewLine}
                    data-testid={`ward-ed-expects-reconsider-${referral.id}`}
                    title={OPERATIONAL_DEFAULT_LABEL}
                  >
                    Referred over {EXPECT_RECONSIDER_AFTER_MINUTES / 60} hours ago and not arrived. Does it still stand?
                  </div>
                ) : null}
              </td>
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
  );
}

/** Forms: everyone held under a recorded form or the Act. */
export function EdFormsTable({ ctx }: { ctx: EdScreenContext }) {
  const { now, underFormPatients } = ctx;
  const { who, name } = listParts(ctx);
  return underFormPatients.length === 0 ? (
    <p className={handover.listEmptyBlock}>
      Nobody on this department&rsquo;s list is under a legal form. Absence here means no form is recorded, not that no
      form applies.
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
          // 1.1 (K1): the one current legal position; no typed end in force once recorded ended.
          const legal = currentLegalPosition(m);
          const due = legal.dueAt;
          return (
            <tr key={m.id}>
              <td>{name(m.id, person.formalName, person.umrn)}</td>
              <td className={handover.listMono}>
                <span className={handover.listQuiet} title="Bay not recorded">
                  –
                </span>
              </td>
              <td>
                {legal.form ? (
                  <>
                    <span className={handover.listTag}>{legalFormNowWords(m)}</span>{" "}
                    <span className={handover.listQuiet}>{formTitleForCode(legal.form.code)}</span>
                  </>
                ) : (
                  <span className={handover.listQuiet}>{m.legalStatus}. Form not recorded.</span>
                )}
              </td>
              <td>
                {legal.ended ? (
                  <span className={handover.listQuiet}>{FORM_RECORDED_ENDED}</span>
                ) : due === undefined || due === null ? (
                  <span className={handover.listQuiet}>Not recorded</span>
                ) : (
                  <span>{`${due < now ? "ended" : "ends"} ${formatInstantWithDay(due, now)}`}</span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
