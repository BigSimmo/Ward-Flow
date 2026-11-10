"use client";

// The governance event list and the side panel for one captured event. Split out of
// `governance-registers.tsx` (18 October 2026) to keep that file under the line cap.

import { ChevronRight, Fingerprint } from "lucide-react";
import Link from "next/link";
import type { ReactNode, KeyboardEvent as ReactKeyboardEvent } from "react";
import type { Instant } from "@/components/ward-management/ward-clock";
import type { Movement, Unit } from "@/components/ward-management/ward-model";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";
import type { AuditEvent, AuditReview } from "./ward-audit";
import { deskRoleLabel } from "./settings/workstation-desks";
import { movementHref, unitHref } from "./shell/ward-facade";
import { Badge, Button, DrawerFootRow, PanelDrawer, StatusGlyph, StatusPill, buttonClass, cx } from "@/components/wf";
import {
  PATTERN_HOURS,
  PATTERN_LIMIT,
  coverReasonLabel,
  isPattern,
  reasonLabel,
  shortDeskLabel,
} from "./governance-access-review";
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
  // WF-46 (5 Nov 2026): with no rows the column heads stood over an empty note and the scroll edge
  // ran half way down it, so the list read as half-drawn. Heads and edge show only with rows.
  const hasRows = allowed && rows.length > 0;
  return (
    <div className={cx(thirdEdition.capturedList, local.list)} data-empty={hasRows ? undefined : "true"}>
      {hasRows ? (
        <div className={thirdEdition.eventHeader} aria-hidden="true">
          <span>When</span>
          <span>What</span>
          <span>Record</span>
          <span>By</span>
          <span>Outcome</span>
          <span>Review</span>
        </div>
      ) : null}
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
            // M58 (D-129): a cover given reads as its reason and the desk that gave it.
            const cover = event.action === "ACCESS_COVER" ? event.details : null;
            const giver = glass ?? cover;
            return (
              <button
                type="button"
                key={`${event.generation}-${event.id}`}
                data-audit-row={event.id}
                data-dim={isDim?.(event) ? "true" : undefined}
                className={cx(thirdEdition.eventRow, local.eventRow)}
                aria-pressed={selected?.id === event.id}
                onClick={() => onChoose(event)}
              >
                <span className={thirdEdition.eventTime}>{when(event.at, now)}</span>
                <span className={thirdEdition.stack}>
                  <strong className={local.wrap}>{actionLabels[event.action]}</strong>
                  <span className={cx(thirdEdition.quietText, local.wrap)}>
                    {glass
                      ? reasonLabel(glass.reason)
                      : cover
                        ? coverReasonLabel(cover.reason)
                        : categoryLabels[event.category]}
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
                {giver?.desk ? (
                  <span className={thirdEdition.stack}>
                    <span className={local.wrap}>{shortDeskLabel(giver.desk)}</span>
                    <span className={cx(thirdEdition.quietText, local.wrap)}>{giver.place}</span>
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
  if (event.outcome === "stale") return "Not applied: the record had already changed.";
  if (event.outcome === "denied")
    return event.reasonCode === "none"
      ? "Not applied: refused."
      : `Not applied: refused (${reasonLabels[event.reasonCode].toLowerCase()}).`;
  return null;
}

/** The By column is narrow: "Bed coordinator" reads as "Coordinator" so it never truncates. */
function shortRoleLabel(label: string): string {
  return label === "Bed coordinator" ? "Coordinator" : label;
}

/**
 * The chosen event, in the kit right drawer at every width (drawer review, 6 Nov 2026). It used to
 * sit in a sticky rail beside the register, and in a tablet-only Drawer below 1024 px; now the
 * register keeps the full width and one page scroll. The head names the event (or, for a break
 * glass, the person) with one quiet line, and the review state is the tag. The body holds the facts
 * and the review history; the foot holds Reviewed as the one filled action, then Follow-up.
 */
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
  onClose,
  feedback,
  roleReason,
  recordViews,
}: {
  /** D-80 item 14: who opened the chosen row's record in the last 7 days, when it has one. */
  recordViews?: ReactNode;
  roleReason?: string;
  selected: AuditEvent;
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
  onClose: () => void;
  feedback: string;
}) {
  // Greyed always with a reason (B3): the role gate first, then what the event itself lacks.
  const reviewReason = canReview
    ? undefined
    : (roleReason ??
      (selected.category === "review" ? "Review attempts cannot be reviewed" : "Saving the last review"));
  const subject = selected.subject;
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
  const state = selected.category === "review" ? "review" : reviewState(selected);
  const glass = selected.action === "BREAK_GLASS" ? selected : null;
  const glassPerson = glass ? subjectPerson(glass, patientOf) : null;
  const notApplied = notAppliedLine(selected);

  return (
    <PanelDrawer
      open
      onClose={onClose}
      title={glass ? subjectLabel(glass, patientOf) : actionLabels[selected.action]}
      titleId="inspectorHeading"
      subtitle={
        glass ? (
          <>
            {glassPerson ? (
              <>
                <span className={thirdEdition.umrn}>{glassPerson.umrn}</span> ·{" "}
              </>
            ) : null}
            Break glass · <span className={thirdEdition.umrn}>{when(glass.at, now)}</span>
          </>
        ) : (
          <>
            {categoryLabels[selected.category]} · <span className={thirdEdition.umrn}>{when(selected.at, now)}</span>
          </>
        )
      }
      tag={
        <StatusPill tone={state === "reviewed" ? "success" : state === "follow-up-required" ? "warning" : "neutral"}>
          {state === "review" ? "Review attempt" : state === "unreviewed" ? "To review" : reviewLabels[state]}
        </StatusPill>
      }
      closeLabel="Close event"
      bodyLabel="Event facts"
      testId="ward-governance-override-detail"
      footProps={{ "data-testid": "ward-governance-decision-record" }}
      foot={
        <>
          <Button
            variant="pri"
            disabledReason={reviewReason}
            reasonDisplay="tooltip"
            onClick={() => onReview("reviewed")}
          >
            Reviewed
          </Button>
          <DrawerFootRow>
            <Button
              disabledReason={reviewReason}
              reasonDisplay="tooltip"
              onClick={() => onReview("follow-up-required")}
            >
              Follow-up
            </Button>
          </DrawerFootRow>
          <p className={thirdEdition.feedback} role="status" aria-live="polite">
            {feedback}
          </p>
        </>
      }
    >
      <div className={thirdEdition.drawerBody}>
        {glass ? (
          <>
            <EventFacts event={glass} units={units} now={now} />
            {recordViews}
          </>
        ) : (
          <>
            {notApplied ? (
              <p className={thirdEdition.notice} data-testid="ward-governance-not-applied">
                <strong>{notApplied}</strong>
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
        )}

        {/* The review history: a plain hairline section, not a card in the drawer. */}
        <section className={thirdEdition.reviewSection} aria-labelledby="governance-event-review-title">
          <div className={thirdEdition.stack}>
            <h3 className={thirdEdition.blockTitle} id="governance-event-review-title">
              Your review
            </h3>
            <span className={thirdEdition.quietText}>
              {`${history.length} recorded ${history.length === 1 ? "review" : "reviews"} · role recorded`}
            </span>
          </div>
          <div className={thirdEdition.reviewBody} role="region" aria-label="Review history">
            {history.length ? (
              <ol className={thirdEdition.timeline}>
                {[...history].reverse().map((review) => (
                  <li key={review.id}>
                    <StatusGlyph tone={review.decision === "reviewed" ? "success" : "warning"} size={9} />
                    <span className={thirdEdition.stack}>
                      <strong>{reviewLabels[review.decision]}</strong>
                      <span className={thirdEdition.quietText}>
                        <span className={thirdEdition.umrn}>{when(review.at, now)}</span> ·{" "}
                        {deskRoleLabel(review.byRole)}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className={thirdEdition.quiet}>
                {selected.category === "review"
                  ? "Review attempts cannot be reviewed."
                  : "No review recorded for this event."}
              </p>
            )}
          </div>
        </section>
      </div>
    </PanelDrawer>
  );
}
