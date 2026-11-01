"use client";

// Needs transport (Transport mock-up, Josh, 1 Nov 2026): the beds that are pulled with no transport
// logged yet, at the top of the Transport page, each with one Log booking button. The booking itself
// is made by phone; Ward Flow logs it (owner's third ruling, 17 Sep 2026), so the button never says
// "Book transport". Only a desk that may raise `BOOK_TRANSPORT` sees the list.

import { useState, type RefObject } from "react";
import { Phone, X } from "lucide-react";

import { Button, Card, CardBody, CardHead, Icon } from "@/components/wf";
import { bookTransportBlockedReason } from "@/components/ward-management/ed/ed-blocked-reasons";
import { formatElapsed, type Instant } from "@/components/ward-management/ward-clock";
import type { Movement } from "@/components/ward-management/ward-model";
import { legalNowText } from "@/components/ward-management/ward-transport-checks";
import {
  BLANK_TRANSPORT_BOOKING,
  TransportBookingForm,
} from "@/components/ward-management/transport/transport-booking-form";
import type { TransportExceptionReason } from "@/components/ward-management/ward-model";
import type { TransportBookingAnswers } from "@/components/ward-management/ward-transport-checks";
import { useHoldOpenForm } from "@/components/ward-management/use-hold-open-form";
import { useWardFormSave } from "@/components/ward-management/use-ward-form-save";
import { useWardRaise, type WardRaise } from "@/components/ward-management/ward-flow-raise";
import { communityTeamById, communityTeamSlug } from "@/components/ward-management/community/community-derivations";
import type { Admission } from "@/components/ward-management/ward-admissions";
import type { Referral } from "@/components/ward-management/ward-model";
import type { WardAccess } from "@/components/ward-management/ward-role-access";
import { wardScrollBehavior } from "@/components/ward-management/ward-scroll";

import { useOfficerPanelHeight } from "./officer-job-panel";
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

/**
 * Q154 (Josh, 1 Nov 2026): the ED, ward and community desks open Transport to follow their own
 * journeys (`ROLE_SCREENS`). The crew's steps stay the transport officer's, so a desk sees each one
 * disabled with this reason. The officer and the coordinator act as before.
 */
export function crewLimitFor(access: WardAccess): string | undefined {
  return access.role === "ed" || access.role === "ward" || access.role === "community"
    ? "Transport officer only"
    : undefined;
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
        <ul className={styles.needList}>
          {shown.map((movement) => {
            const umrn = umrnFor(movement);
            const current = movement.id === bookingId;
            return (
              <li
                key={movement.id}
                className={styles.needRow}
                aria-current={current ? "true" : undefined}
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
                  </span>
                </span>
                <span className={styles.needRoute}>
                  <b>
                    {originShortFor(movement)} <span aria-hidden="true">→</span>
                    <span className="sr-only"> to </span> {destinationLabelFor(movement)}
                  </b>
                  {/* Legal status and form as typed; never a time or countdown (D-93). */}
                  <span>{legalNowText(movement)}</span>
                </span>
                {isPhone ? null : (
                  <span className={styles.needWait}>
                    {formatElapsed(Math.max(0, now - movement.openedAt)).replace(/ waiting$/, "")}
                    <small>waiting</small>
                  </span>
                )}
                <Button
                  variant="sec"
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
          <div className={styles.needFoot}>
            <Button variant="ghost" size="sm" onClick={() => setShowAll((open) => !open)}>
              {showAll
                ? "Show fewer"
                : `${isPhone ? "See all" : `Show ${needing.length - first} more`}${isPhone ? ` ${needing.length}` : ""}`}
            </Button>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
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
  const [answers, setAnswers] = useState<TransportBookingAnswers>(BLANK_TRANSPORT_BOOKING);
  const [legalReason, setLegalReason] = useState<TransportExceptionReason | "">("");
  const save = useWardFormSave(movement.id);
  // Held from opening, so a change by another desk is reported before this booking is accepted.
  useHoldOpenForm(true, movement.id);
  useOfficerPanelHeight("ward-officer-booking", isPhone, movement.id);
  return (
    <div ref={sideRef} className={styles.side} data-panel="booking">
      <div className={styles.scrim} aria-hidden="true" onClick={onClose} />
      <Card
        className={`${styles.detail} ${styles.bookingCard}`}
        role={isPhone ? "dialog" : undefined}
        aria-modal={isPhone ? true : undefined}
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
          aside={<Button variant="ghost" size="sm" iconOnly icon={X} onClick={onClose} aria-label="Close booking" />}
        />
        <div className={cxBody(styles.detailScroll, styles.bookingBody)}>
          <p className={styles.bookingCallout}>
            <Icon icon={Phone} size={16} />
            Book with the provider by phone, then log what they told you.
          </p>
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
            onCancel={onClose}
          />
        </div>
      </Card>
    </div>
  );
}

function cxBody(...names: (string | undefined)[]) {
  return names.filter(Boolean).join(" ");
}
