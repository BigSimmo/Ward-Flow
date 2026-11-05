"use client";

// Needs transport (Transport mock-up, Josh, 1 Nov 2026): the beds that are pulled with no transport
// logged yet, at the top of the Transport page, each with one Log booking button. The booking itself
// is made by phone; Ward Flow logs it (owner's third ruling, 17 Sep 2026), so the button never says
// "Book transport". Only a desk that may raise `BOOK_TRANSPORT` sees the list.

import { useState, type RefObject } from "react";
import { Phone, X } from "lucide-react";

import { Button, Card, CardBody, CardHead, Icon, ShowMoreRow, StatusGlyph } from "@/components/wf";
import {
  bookTransportBlockedReason,
  transportLegalFormNotice,
} from "@/components/ward-management/ed/ed-blocked-reasons";
import { formatElapsed, type Instant } from "@/components/ward-management/ward-clock";
import type { Movement } from "@/components/ward-management/ward-model";
import { legalNowText } from "@/components/ward-management/ward-transport-checks";
import {
  BLANK_TRANSPORT_BOOKING,
  TransportBookingForm,
  etaPresetAnswers,
} from "@/components/ward-management/transport/transport-booking-form";
import { useOptionalWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import type { RepatriationRecord } from "@/components/ward-management/ward-flow-reducer";
import type { TransportExceptionReason } from "@/components/ward-management/ward-model";
import type { TransportBookingAnswers } from "@/components/ward-management/ward-transport-checks";
import { useHoldOpenForm } from "@/components/ward-management/use-hold-open-form";
import { useTransportBookingClose } from "@/components/ward-management/transport/use-transport-booking-close";
import { useWardModalFocus } from "@/components/ward-management/ward-modal-focus";
import { useWardFormSave } from "@/components/ward-management/use-ward-form-save";
import { useWardRaise, type WardRaise } from "@/components/ward-management/ward-flow-raise";
import { communityTeamById, communityTeamSlug } from "@/components/ward-management/community/community-derivations";
import type { Admission } from "@/components/ward-management/ward-admissions";
import type { Referral } from "@/components/ward-management/ward-model";
import type { WardAccess } from "@/components/ward-management/ward-role-access";
import { wardScrollBehavior } from "@/components/ward-management/ward-scroll";

import { crewLimitFor } from "./officer-crew-only";
import { useOfficerPanelHeight } from "./officer-job-panel";
import { OfficerBookingContacts } from "./officer-booking-contacts";
import { Sheet } from "@/components/wf/sheet";

export { crewLimitFor };
import styles from "./officer.module.css";

/** The desks that log a booking here (Transport mock-up, Josh, 1 Nov 2026). */
const BOOKING_ROLES = ["coordinator", "ed", "ward", "community"] as const;
type BookingRole = (typeof BOOKING_ROLES)[number];

/** The place a booking is raised as: a ward books as its unit, a community team as its team. */
export type BookingActing = { actingUnitId?: string; actingPlaceId?: string };

type BookingRecords = { admissions: readonly Admission[]; referrals: readonly Referral[] };

/**
 * The sending ward, in the reducer's own order (`case "BOOK_TRANSPORT"`): the source admission's
 * unit, then the referral's origin unit, then the movement's own.
 */
function sendingWardOf(movement: Movement, records: BookingRecords, referral: Referral | undefined) {
  const source = movement.sourceAdmissionId
    ? records.admissions.find((admission) => admission.id === movement.sourceAdmissionId)
    : undefined;
  return source?.unitId ?? referral?.originUnitId ?? (movement as { originUnitId?: string }).originUnitId;
}

/**
 * The place this desk books `movement` as, or `undefined` when the journey is not this desk's to book.
 * Only the sending ward or sending community team may book (the reducer refuses anyone else), and an
 * ED desk books only the journeys that start in its own ED.
 */
export function actingFor(access: WardAccess, movement: Movement, records: BookingRecords): BookingActing | undefined {
  const scope = access.scope;
  if (access.role === "coordinator") return {};
  const referral = movement.referralId ? records.referrals.find((r) => r.id === movement.referralId) : undefined;
  if (access.role === "ed") return scope.kind === "ed" && movement.originEdId === scope.edId ? {} : undefined;
  if (access.role === "ward" && scope.kind === "ward") {
    const unitId = sendingWardOf(movement, records, referral);
    return unitId && scope.unitIds.includes(unitId) ? { actingUnitId: unitId } : undefined;
  }
  if (access.role === "community" && scope.kind === "team") {
    const team = communityTeamById(communityTeamSlug(scope.teamName));
    const sending = referral?.sendingTeamName;
    if (!team || sending === undefined || communityTeamSlug(sending) !== team.id) return undefined;
    return { actingPlaceId: team.id };
  }
  return undefined;
}

/** The pulled beds this desk may log a booking for, the place it books each as, and the raise. */
export function useNeedsTransport(movements: readonly Movement[], access: WardAccess, records: BookingRecords) {
  const bookingRole: BookingRole | undefined = BOOKING_ROLES.find((candidate) => candidate === access.role);
  const raise = useWardRaise(bookingRole ?? "coordinator");
  const acting = new Map<string, BookingActing>();
  if (bookingRole) {
    for (const movement of movementsNeedingTransport(movements)) {
      const place = actingFor(access, movement, records);
      if (place) acting.set(movement.id, place);
    }
  }
  const needing = movementsNeedingTransport(movements).filter((movement) => acting.has(movement.id));
  const crewLimit = crewLimitFor(access);
  // A desk raises the crew's steps as itself, so the reducer refuses them even if a control slips.
  const crewRaise = useWardRaise(crewLimit && bookingRole ? bookingRole : "officer");
  return { needing, acting, raise, crewLimit, crewRaise };
}

/** The crew's next step with the desk's limit laid over any reason of its own. */
export function withCrewLimit<T extends { blocked?: string }>(step: T | undefined, limit: string | undefined) {
  return step && limit ? { ...step, blocked: limit } : step;
}

/** The hero's Need transport count jumps to the list and its first Log booking button. */
export function scrollToNeedsTransport() {
  document
    .getElementById("ward-officer-need-heading")
    ?.scrollIntoView({ block: "start", behavior: wardScrollBehavior() });
  document.querySelector<HTMLElement>('[data-testid^="ward-officer-log-booking-"]')?.focus({ preventScroll: true });
}

/** Pulled beds with no transport logged, most urgent tier first, then longest wait. */
function movementsNeedingTransport(movements: readonly Movement[]): Movement[] {
  return movements
    .filter((movement) => !movement.closure && bookTransportBlockedReason(movement) === undefined)
    .sort((a, b) => a.urgency - b.urgency || a.openedAt - b.openedAt);
}

/**
 * TR3 (4 Nov 2026): the clock Transport cares about is how long the bed has been held for this
 * person, read from the movement's own last pull. A record with no pull on file keeps the journey's
 * own wait, and says so.
 */
function heldClock(movement: Movement, now: Instant): { figure: string; label: string } {
  let pulledAt: Instant | undefined;
  for (const change of movement.stageChanges) if (change.to === "pulled") pulledAt = change.at;
  const since = pulledAt ?? movement.openedAt;
  return {
    figure: formatElapsed(Math.max(0, now - since)).replace(/ waiting$/, ""),
    label: pulledAt === undefined ? "waiting" : "bed held",
  };
}

type NeedsTransportProps = {
  needing: readonly Movement[];
  now: Instant;
  isPhone: boolean;
  bookingId: string | undefined;
  nameFor: (movement: Movement) => string;
  umrnFor: (movement: Movement) => string | undefined;
  originShortFor: (movement: Movement) => string;
  destinationLabelFor: (movement: Movement) => string;
  onLog: (movementId: string) => void;
};

export function NeedsTransportCard({
  needing,
  now,
  isPhone,
  bookingId,
  nameFor,
  umrnFor,
  originShortFor,
  destinationLabelFor,
  onLog,
}: NeedsTransportProps) {
  const [showAll, setShowAll] = useState(false);
  if (needing.length === 0) return null;
  const first = isPhone ? 2 : 4;
  const shown = showAll ? needing : needing.slice(0, first);
  return (
    <Card className={styles.needCard} aria-labelledby="ward-officer-need-heading" data-testid="ward-officer-need">
      <CardHead
        id="ward-officer-need-heading"
        title="Needs transport"
        meta={
          <>
            <span className={styles.needCount}>{needing.length}</span>
            <span className={styles.needNote}>
              {isPhone ? "Bed pulled, nothing booked" : "Bed pulled, no transport logged. Most urgent first."}
            </span>
          </>
        }
      />
      <CardBody className={styles.needBody}>
        <ul id="ward-officer-need-list" className={styles.needList}>
          {shown.map((movement, index) => {
            const umrn = umrnFor(movement);
            const current = movement.id === bookingId;
            const clock = heldClock(movement, now);
            // WLQ-5: the record's own fact, as a warning beside the row. Never a block.
            const formGap = transportLegalFormNotice(movement) ? "No Form 4A recorded" : undefined;
            const next = index === 0;
            return (
              <li
                key={movement.id}
                className={styles.needRow}
                aria-current={current ? "true" : undefined}
                data-next={next ? "true" : undefined}
                data-testid={`ward-officer-need-${movement.id}`}
              >
                <span className={styles.needWho}>
                  <b>{nameFor(movement)}</b>
                  <span>
                    {umrn ? <span className={styles.mono}>{umrn}</span> : null}
                    {umrn ? " · " : null}
                    <span className={styles.needTier} data-tier={movement.urgency}>
                      Tier {movement.urgency}
                    </span>
                    {isPhone ? (
                      <>
                        {" · "}
                        <span className={styles.mono}>{clock.figure}</span> {clock.label}
                      </>
                    ) : null}
                  </span>
                </span>
                <span className={styles.needRoute}>
                  <b>
                    {originShortFor(movement)} <span aria-hidden="true">→</span>
                    <span className="sr-only"> to </span> {destinationLabelFor(movement)}
                  </b>
                  {/* Legal status and form as typed; never a time or countdown (D-93). */}
                  <span>{legalNowText(movement)}</span>
                  {formGap ? (
                    <span className={styles.needGap}>
                      <StatusGlyph tone="warning" size={9} />
                      {formGap}
                    </span>
                  ) : null}
                </span>
                {isPhone ? null : (
                  <span className={styles.needWait}>
                    {clock.figure}
                    <small>{clock.label}</small>
                  </span>
                )}
                <Button
                  variant={next ? "pri" : "sec"}
                  size={isPhone ? undefined : "sm"}
                  aria-pressed={current}
                  data-testid={`ward-officer-log-booking-${movement.id}`}
                  onClick={() => onLog(movement.id)}
                >
                  Log booking
                </Button>
              </li>
            );
          })}
        </ul>
        {needing.length > first ? (
          // TR3 (4 Nov 2026): the kit's one Show more row, so it sits in the card foot under its own
          // line rather than a pill laid across the list's last rule.
          <ShowMoreRow onClick={() => setShowAll((open) => !open)} expanded={showAll} controls="ward-officer-need-list">
            {showAll
              ? "Show fewer"
              : `${isPhone ? "See all" : `Show ${needing.length - first} more`}${isPhone ? ` ${needing.length}` : ""}`}
          </ShowMoreRow>
        ) : null}
      </CardBody>
    </Card>
  );
}

/**
 * OA1 (Josh, 4 Nov 2026, question 5 option A): an Out of area return's booking opens with the
 * answers the coordinator already typed into the return plan, an agreed exception to the 31 Oct
 * "nothing starts chosen" rule. They are a person's own answers, never derived, and the officer
 * checks them before saving. A depart time already past is left blank.
 */
export function returnPlanBooking(record: RepatriationRecord | undefined, now: Instant): TransportBookingAnswers {
  if (!record) return BLANK_TRANSPORT_BOOKING;
  return {
    ...BLANK_TRANSPORT_BOOKING,
    provider: record.provider,
    cadNumber: record.cadNumber,
    transportLegalStatus: record.transportLegalStatus,
    escortRequired: record.escortRequired,
    ...(record.estimatedAt >= now ? etaPresetAnswers(now, record.estimatedAt - now) : {}),
  };
}

type BookingPanelProps = {
  sideRef: RefObject<HTMLDivElement | null>;
  movement: Movement;
  name: string;
  umrn: string | undefined;
  route: string;
  now: Instant;
  isPhone: boolean;
  raise: WardRaise;
  acting: BookingActing;
  onClose: () => void;
  onSaved: (name: string) => void;
};

/** The side panel (a sheet on phone) that logs a booking already made by phone. */
export function OfficerBookingPanel({
  sideRef,
  movement,
  name,
  umrn,
  route,
  now,
  isPhone,
  raise,
  acting,
  onClose,
  onSaved,
}: BookingPanelProps) {
  // A desk whose shared copy carries no return plan simply starts blank.
  const plan = useOptionalWardFlowSelect("repatriations")?.repatriations?.find(
    (record) => movement.sourceAdmissionId !== undefined && record.admissionId === movement.sourceAdmissionId,
  );
  const [answers, setAnswers] = useState<TransportBookingAnswers>(() => returnPlanBooking(plan, now));
  const [legalReason, setLegalReason] = useState<TransportExceptionReason | "">("");
  const save = useWardFormSave(movement.id);
  const saving = save.pending && !save.error;
  const requestClose = useTransportBookingClose({
    scope: movement.id,
    answers,
    legalReason,
    pending: saving,
    onClose,
  });
  // This host owns the phone focus lifecycle too, so Escape follows the same draft guard as X.
  useWardModalFocus(isPhone, sideRef, requestClose);
  // Held from opening, so a change by another desk is reported before this booking is accepted.
  useHoldOpenForm(true, movement.id);
  useOfficerPanelHeight("ward-officer-booking", isPhone, movement.id);
  const callout = (
    <p className={styles.bookingCallout}>
      <Icon icon={Phone} size={16} />
      {plan
        ? "Filled in from the Out of area return plan. Check it with the provider, then save."
        : "Book with the provider by phone, then log what they told you."}
    </p>
  );
  const form = (
    <TransportBookingForm
      answers={answers}
      onAnswers={setAnswers}
      legalReason={legalReason}
      onLegalReason={setLegalReason}
      record={movement}
      patientName={name}
      now={now}
      testIds={{ prefix: "ward-officer", suffix: movement.id }}
      pending={save.pending}
      error={save.error}
      onSubmit={(booking) =>
        save.submit(
          () => raise("BOOK_TRANSPORT", { movementId: movement.id, ...acting, ...booking }),
          () => onSaved(name),
        )
      }
      onCancel={requestClose}
    />
  );
  // TR4 (3 Nov 2026): on desktop and tablet Log booking is a centred dialog with the providers'
  // numbers beside the form; a phone keeps its full sheet.
  if (!isPhone) {
    return (
      <Sheet
        open
        onClose={requestClose}
        title={`Log booking for ${name}`}
        description={`${umrn ? `${umrn} · ` : ""}${route}`}
        closeLabel="Close booking"
        contentClassName={styles.bookingDialog}
        bodyClassName={styles.bookingDialogBody}
        testId="ward-officer-booking"
      >
        <div className={styles.bookingGrid}>
          <div className={styles.bookingMain}>
            {callout}
            {form}
          </div>
          <OfficerBookingContacts
            selected={answers.provider}
            onPick={(provider) => setAnswers((current) => ({ ...current, provider }))}
          />
        </div>
      </Sheet>
    );
  }
  return (
    <div ref={sideRef} className={styles.side} data-panel="booking">
      <div className={styles.scrim} aria-hidden="true" onClick={requestClose} />
      <Card
        className={`${styles.detail} ${styles.bookingCard}`}
        role="dialog"
        aria-modal
        aria-labelledby="ward-officer-booking-heading"
        data-testid="ward-officer-booking"
      >
        <span className={styles.grab} aria-hidden="true" />
        <CardHead
          id="ward-officer-booking-heading"
          className={styles.detailHead}
          title={
            <span className={styles.detailTitle}>
              {name}
              <span className={styles.detailTag} data-tone="warning">
                Needs transport
              </span>
            </span>
          }
          meta={
            <>
              {umrn ? <span className={styles.mono}>{umrn}</span> : null}
              {umrn ? " · " : null}
              {route}
            </>
          }
          aside={
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              icon={X}
              onClick={requestClose}
              disabled={saving}
              aria-label="Close booking"
            />
          }
        />
        <div className={cxBody(styles.detailScroll, styles.bookingBody)}>
          {plan ? callout : null}
          {/* TR4: on a phone the officer calls first, so the numbers (which say what to do) replace the callout. */}
          <OfficerBookingContacts
            selected={answers.provider}
            onPick={(provider) => setAnswers((current) => ({ ...current, provider }))}
          />
          {form}
        </div>
      </Card>
    </div>
  );
}

function cxBody(...names: (string | undefined)[]) {
  return names.filter(Boolean).join(" ");
}
