"use client";

// The governance event list and the side panel for one captured event. Split out of
// `governance-registers.tsx` (18 October 2026) to keep that file under the line cap.

import { ChevronRight, ClipboardList, Fingerprint } from "lucide-react";
import Link from "next/link";
import type { ReactNode, KeyboardEvent as ReactKeyboardEvent } from "react";
import type { Instant } from "@/components/ward-management/ward-clock";
import type { Movement, Unit } from "@/components/ward-management/ward-model";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";
import type { AuditEvent, AuditReview } from "./ward-audit";
import { deskRoleLabel } from "./settings/workstation-desks";
import { movementHref, unitHref } from "./shell/ward-facade";
import { Badge, Button, Card, EmptyState, StatusGlyph, buttonClass, cx } from "@/components/wf";
import { PATTERN_HOURS, PATTERN_LIMIT, isPattern, reasonLabel, shortDeskLabel } from "./governance-access-review";
import thirdEdition from "./governance-third-edition.module.css";
import local from "./governance-event-list.module.css";
import { EventFacts, FactList } from "./governance-event-facts";
import {
  OUTCOME_TONE,
  actionLabels,
  categoryLabels,
  outcomeLabels,
  reasonLabels,
  reviewLabels,
  subjectLabel,
  subjectPerson,
  type GovernanceApi,
  when,
} from "./governance-shared";

/** A list of captured events: one button per row, arrow keys move between them. */
export function EventTable({
  label,
  rows,
  selected,
  now,
  patientOf,
  reviewState,
  onChoose,
  onKey,
  empty,
  allowed = true,
  isDim,
}: {
  isDim?: (event: AuditEvent) => boolean;
  label: string;
  rows: AuditEvent[];
  selected: AuditEvent | null;
  now: Instant;
  patientOf: ReturnType<typeof usePatientOf>;
  reviewState: (event: AuditEvent) => "unreviewed" | AuditReview["decision"];
  onChoose: (event: AuditEvent) => void;
  onKey: (event: ReactKeyboardEvent<HTMLDivElement>) => void;
  empty: ReactNode;
  allowed?: boolean;
}) {
  return (
    <div className={cx(thirdEdition.capturedList, local.list)}>
      <div className={thirdEdition.eventHeader} aria-hidden="true">
        <span>When</span>
        <span>What</span>
        <span>Record</span>
        <span>By</span>
        <span>Outcome</span>
        <span>Review</span>
      </div>
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- catches Escape or arrow keys bubbling up from the focused control inside */}
      <div
        className={cx(thirdEdition.registerBody, local.registerBody)}
        role="region"
        aria-label={label}
        tabIndex={0}
        onKeyDown={onKey}
      >
        {!allowed ? (
          <div className={thirdEdition.emptyBlock}>
            <Fingerprint aria-hidden="true" size={16} />
            <h3>Record access unavailable</h3>
            <p>These records require the coordinator role.</p>
          </div>
        ) : rows.length === 0 ? (
          empty
        ) : (
          rows.map((event) => {
            const state = event.category === "review" ? "Review attempt" : reviewState(event);
            // D-80 item 14: a break glass opening reads as its reason, its desk and place, and how
            // long it was open, or the pattern when its desk made more than 3 in 12 hours.
            const glass = event.action === "BREAK_GLASS" ? event.details : null;
            return (
              <button
                type="button"
                key={`${event.generation}-${event.id}`}
                data-audit-row={event.id}
                data-dim={isDim?.(event) ? "true" : undefined}
                className={cx(thirdEdition.eventRow, local.eventRow)}
                aria-pressed={selected?.id === event.id}
                aria-controls="governance-event-detail"
                onClick={() => onChoose(event)}
              >
                <span className={thirdEdition.eventTime}>{when(event.at, now)}</span>
                <span className={thirdEdition.stack}>
                  <strong className={local.wrap}>{actionLabels[event.action]}</strong>
                  <span className={cx(thirdEdition.quietText, local.wrap)}>
                    {glass ? reasonLabel(glass.reason) : categoryLabels[event.category]}
                  </span>
                </span>
                <span className={thirdEdition.stack}>
                  <span className={local.wrap}>{subjectLabel(event, patientOf)}</span>
                  {subjectPerson(event, patientOf) ? (
                    <span className={cx(thirdEdition.quietText, local.wrap, thirdEdition.umrn)}>
                      {subjectPerson(event, patientOf)!.umrn}
                    </span>
                  ) : null}
                </span>
                {glass?.desk ? (
                  <span className={thirdEdition.stack}>
                    <span className={local.wrap}>{shortDeskLabel(glass.desk)}</span>
                    <span className={cx(thirdEdition.quietText, local.wrap)}>{glass.place}</span>
                  </span>
                ) : (
                  <span className={local.wrap}>
                    {event.actor.role ? shortRoleLabel(deskRoleLabel(event.actor.role)) : "Role unavailable"}
                  </span>
                )}
                {glass && isPattern(event) ? (
                  <span>
                    <Badge tone="warning" size="sm">
                      More than {PATTERN_LIMIT} in {PATTERN_HOURS} hours
                    </Badge>
                  </span>
                ) : (
                  <span className={thirdEdition.statusText}>
                    <StatusGlyph tone={OUTCOME_TONE[event.outcome]} size={9} />
                    {glass && event.at !== null && glass.until !== null
                      ? `Opened ${Math.max(0, glass.until - event.at)} min`
                      : outcomeLabels[event.outcome]}
                  </span>
                )}
                <span className={thirdEdition.statusText}>
                  <StatusGlyph
                    tone={state === "reviewed" ? "success" : state === "follow-up-required" ? "warning" : "neutral"}
                    size={9}
                  />
                  {state === "Review attempt"
                    ? "Review attempt"
                    : state === "unreviewed"
                      ? "Unreviewed"
                      : reviewLabels[state]}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

/**
 * UX audit (21 Oct 2026): a refused or stale request leads with one plain sentence, so a reviewer
 * does not have to work out from Before, Requested and After that nothing changed.
 */
function notAppliedLine(event: AuditEvent): string | null {
  if (event.outcome === "stale")
    return "Not applied. The record had changed before this request saved, so nothing was changed.";
  if (event.outcome === "denied")
    return event.reasonCode === "none"
      ? "Not applied. The request was refused, so nothing was changed."
      : `Not applied. Refused (${reasonLabels[event.reasonCode].toLowerCase()}), so nothing was changed.`;
  return null;
}

/** The By column is narrow: "Bed coordinator" reads as "Coordinator" so it never truncates. */
function shortRoleLabel(label: string): string {
  return label === "Bed coordinator" ? "Coordinator" : label;
}

/** The side panel for one captured event: its facts, links to the record, and the review. */
export function EventDetail({
  selected,
  units,
  movements,
  api,
  events,
  history,
  now,
  patientOf,
  reviewState,
  canReview,
  onReview,
  onChoose,
  feedback,
  roleReason,
  rest,
  recordViews,
}: {
  /** D-80 item 14: who opened the chosen row's record in the last 7 days, when it has one. */
  recordViews?: ReactNode;
  roleReason?: string;
  /** What the rail shows with nothing selected: the session summary. */
  rest?: ReactNode;
  selected: AuditEvent | null;
  units: Unit[];
  movements: Movement[];
  api?: GovernanceApi;
  events: readonly AuditEvent[];
  history: AuditReview[];
  now: Instant;
  patientOf: ReturnType<typeof usePatientOf>;
  reviewState: (event: AuditEvent) => "unreviewed" | AuditReview["decision"];
  canReview: boolean;
  onReview: (decision: AuditReview["decision"]) => void;
  onChoose: (event: AuditEvent) => void;
  feedback: string;
}) {
  // Greyed always with a reason (B3): the role gate first, then what the event itself lacks.
  const reviewReason = canReview
    ? undefined
    : (roleReason ??
      (selected === null
        ? "Choose an event first"
        : selected.category === "review"
          ? "Review attempts cannot be reviewed"
          : "Saving the last review"));
  const subject = selected?.subject;
  const subjectWardId = subject?.kind === "admission" || subject?.kind === "bed-release" ? subject.unitId : null;
  const matchingWard = units.filter((unit) => unit.id === subjectWardId);
  const subjectExists =
    subject?.kind === "admission"
      ? api?.admissions.filter((entry) => entry.id === subject.admissionId).length === 1
      : subject?.kind === "bed-release"
        ? api?.bedReleases.filter((entry) => entry.id === subject.releaseId).length === 1
        : false;
  const movementExists =
    subject?.kind === "movement" && movements.filter((entry) => entry.id === subject.movementId).length === 1;
  const referenced = subject?.kind === "audit-event" ? events.find((entry) => entry.id === subject.eventId) : undefined;
  const state = selected ? (selected.category === "review" ? "review" : reviewState(selected)) : null;
  const glass = selected?.action === "BREAK_GLASS" ? selected : null;
  const glassPerson = glass ? subjectPerson(glass, patientOf) : null;

  return (
    <Card
      id="governance-event-detail"
      className={thirdEdition.detailCard}
      data-wf-rail
      data-testid="ward-governance-override-detail"
      aria-label="Selected event detail"
    >
      <h2 className={thirdEdition.srOnly}>Event detail</h2>
      <span className={thirdEdition.srOnly}>Select an event from the register</span>
      <div className={thirdEdition.detailHead}>
        <div className={thirdEdition.stack}>
          <span className={thirdEdition.eyebrow}>
            {glass
              ? `Break glass · ${when(glass.at, now)}`
              : selected
                ? categoryLabels[selected.category]
                : rest
                  ? "At rest"
                  : "Event detail"}
          </span>
          <h3 className={thirdEdition.detailTitle} id="inspectorHeading">
            {glass
              ? subjectLabel(glass, patientOf)
              : selected
                ? actionLabels[selected.action]
                : rest
                  ? "This session"
                  : "Nothing selected"}
          </h3>
          {glassPerson ? (
            <span className={cx(thirdEdition.quietText, thirdEdition.umrn)}>{glassPerson.umrn}</span>
          ) : null}
        </div>
        {state ? (
          <span className={thirdEdition.statusText}>
            <StatusGlyph
              tone={state === "reviewed" ? "success" : state === "follow-up-required" ? "warning" : "neutral"}
              size={9}
            />
            {state === "review" ? "Review attempt" : state === "unreviewed" ? "To review" : reviewLabels[state]}
          </span>
        ) : null}
      </div>

      <div className={thirdEdition.detailBody} role="region" aria-label="Event facts" tabIndex={0}>
        {glass ? (
          <>
            <EventFacts event={glass} units={units} now={now} />
            {recordViews}
          </>
        ) : selected ? (
          <>
            {notAppliedLine(selected) ? (
              <p className={thirdEdition.notice} data-testid="ward-governance-not-applied">
                <strong>{notAppliedLine(selected)}</strong>
              </p>
            ) : null}
            <FactList
              facts={[
                ["Record", subjectLabel(selected, patientOf)],
                ["Recorded", when(selected.at, now)],
                ["Role recorded", selected.actor.role ? deskRoleLabel(selected.actor.role) : "Not recorded"],
                ...(selected.actor.actingUnitId
                  ? [
                      [
                        "Acting ward",
                        units.find((unit) => unit.id === selected.actor.actingUnitId)?.name ?? "Unresolved ward",
                      ] as const,
                    ]
                  : []),
                ...(selected.reasonCode !== "none"
                  ? [["Outcome reason", reasonLabels[selected.reasonCode]] as const]
                  : []),
              ]}
            />
            {(movementExists || (subjectExists && matchingWard.length === 1) || referenced) && (
              <div className={thirdEdition.entityLinks}>
                {movementExists && subject?.kind === "movement" && (
                  <Link href={movementHref(subject.movementId)} className={buttonClass({ size: "sm" })}>
                    Open movement <ChevronRight aria-hidden="true" size={14} />
                  </Link>
                )}
                {subjectExists && matchingWard.length === 1 && (
                  <Link href={unitHref(matchingWard[0].id)} className={buttonClass({ size: "sm" })}>
                    Open {matchingWard[0].name} <ChevronRight aria-hidden="true" size={14} />
                  </Link>
                )}
                {referenced && (
                  <Button size="sm" onClick={() => onChoose(referenced)}>
                    Open the reviewed event
                  </Button>
                )}
              </div>
            )}
            <div className={thirdEdition.operationFacts}>
              <h3 className={thirdEdition.subheading}>Recorded facts</h3>
              <EventFacts event={selected} units={units} now={now} />
            </div>
            {recordViews}
          </>
        ) : (
          (rest ?? <EmptyState icon={ClipboardList} title="Select an event from the register" />)
        )}
      </div>

      <section
        className={thirdEdition.recordPane}
        data-testid="ward-governance-decision-record"
        aria-label="Administrative review"
      >
        <div className={thirdEdition.stack}>
          <h3 className={thirdEdition.blockTitle}>Your review</h3>
          <span className={thirdEdition.quietText}>
            {selected
              ? `${history.length} recorded ${history.length === 1 ? "review" : "reviews"} · role recorded`
              : "No event selected"}
          </span>
        </div>
        <div className={thirdEdition.reviewBody} role="region" aria-label="Review history" tabIndex={0}>
          {selected && history.length ? (
            <ol className={thirdEdition.timeline}>
              {[...history].reverse().map((review) => (
                <li key={review.id}>
                  <StatusGlyph tone={review.decision === "reviewed" ? "success" : "warning"} size={9} />
                  <span className={thirdEdition.stack}>
                    <strong>{reviewLabels[review.decision]}</strong>
                    <span className={thirdEdition.quietText}>
                      {when(review.at, now)} · {deskRoleLabel(review.byRole)}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className={thirdEdition.quiet}>
              {selected?.category === "review"
                ? "Review attempts cannot be reviewed."
                : selected
                  ? "No review recorded for this event."
                  : "Choose an event to review."}
            </p>
          )}
        </div>
        <div className={thirdEdition.reviewActions}>
          <Button
            size="sm"
            variant="pri"
            disabledReason={reviewReason}
            reasonDisplay="tooltip"
            onClick={() => onReview("reviewed")}
          >
            Reviewed
          </Button>
          <Button
            size="sm"
            disabledReason={reviewReason}
            reasonDisplay="tooltip"
            onClick={() => onReview("follow-up-required")}
          >
            Follow-up
          </Button>
        </div>
        <p className={thirdEdition.feedback} role="status" aria-live="polite">
          {feedback}
        </p>
      </section>
    </Card>
  );
}
