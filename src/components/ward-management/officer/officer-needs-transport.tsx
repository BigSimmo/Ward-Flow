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
import { wardScrollBehavior } from "@/components/ward-management/ward-scroll";

import styles from "./officer.module.css";

/**
 * The desks that log a booking here. Only the statewide coordinator: a ward, community or ED desk must
 * book as its own place (`actingUnitId` / `actingPlaceId`), so it books from the patient record instead.
 */
const BOOKING_ROLES = ["coordinator"] as const;

/** The pulled beds this desk may log a booking for, and the raise that logs it. */
export function useNeedsTransport(movements: readonly Movement[], role: string | undefined) {
  const bookingRole = BOOKING_ROLES.find((candidate) => candidate === role);
  const raise = useWardRaise(bookingRole ?? "coordinator");
  return { needing: bookingRole ? movementsNeedingTransport(movements) : [], raise };
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
  onClose,
  onSaved,
}: BookingPanelProps) {
  const [answers, setAnswers] = useState<TransportBookingAnswers>(BLANK_TRANSPORT_BOOKING);
  const [legalReason, setLegalReason] = useState<TransportExceptionReason | "">("");
  const save = useWardFormSave(movement.id);
  // Held from opening, so a change by another desk is reported before this booking is accepted.
  useHoldOpenForm(true, movement.id);
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
                () => raise("BOOK_TRANSPORT", { movementId: movement.id, ...booking }),
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
