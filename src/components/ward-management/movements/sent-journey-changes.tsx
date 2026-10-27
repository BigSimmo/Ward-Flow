"use client";

import { useId, useState, type FormEvent } from "react";
import { Button, Field, Select } from "@/components/wf";
import {
  LEGAL_STATUS_OPTIONS,
  LEGAL_STATUS_REASON_UNCHOSEN,
  LEGAL_STATUS_UNCHOSEN,
  URGENCY_OPTIONS,
} from "@/components/ward-management/ed/ed-screen-model";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { wardCommandFailure } from "@/components/ward-management/ward/use-ward-command-completion";
import { useHoldOpenForm } from "@/components/ward-management/use-hold-open-form";
import { wardPlaceLookup } from "@/components/ward-management/ward-access-places";
import type { Admission } from "@/components/ward-management/ward-admissions";
import {
  changeReasonLabels,
  LEGAL_STATUS_CHANGE_REASONS,
  URGENCY_CHANGE_REASONS,
  type LegalStatusChangeReason,
  type UrgencyChangeReason,
} from "@/components/ward-management/ward-change-reasons";
import { useWardFlowClock, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { wardRaise } from "@/components/ward-management/ward-flow-raise";
import { journeySentByKind } from "@/components/ward-management/ward-journey-sender";
import type { LegalStatus, Movement } from "@/components/ward-management/ward-model";
import { urgencyTierLabel } from "@/components/ward-management/ward-priority";
import { journeySentByDesk } from "@/components/ward-management/ward-referral-sender";
import { canDispatch } from "@/components/ward-management/ward-role-permissions";
import { useRouteRole } from "@/components/ward-management/ward-role-gate";
import styles from "./sent-journey-changes.module.css";

/**
 * D-80 (role access plan v2): the sending ward's or team's own urgency and legal status controls.
 * The coordinator's (`shortlist-panel.tsx`) and the ED's (`ed-screen-row-forms.tsx`) controls stay
 * where they are; this is the same pair of forms, with the same options, unchosen reasons and
 * wording, for the ward page's bed dossier and the community team's Sent list.
 *
 * Shown only where the record is the desk's own: the route desk is a ward or a team, the journey is
 * still open, and it was sent by this kind of desk (`journeySentByKind`, the reducer's check) and by
 * this ward or team (`journeySentByDesk`, the server's `commandScopeRefusal` check). Otherwise it
 * renders nothing, so it never offers an action the reducer or the server would refuse.
 */

/**
 * The open journey a ward sent for the person in one of its beds: the one leaving this stay (a
 * return journey). Matched on the stay alone, never on the person: the D-14 guard keeps the patient
 * link out of this module (`tests/ward-patient-link-default-deny.test.ts`).
 */
export function openJourneyFromStay(
  movements: readonly Movement[],
  admission: Pick<Admission, "id">,
): Movement | undefined {
  return movements.find((movement) => !movement.closure && movement.sourceAdmissionId === admission.id);
}

/**
 * Whether the route desk may change this journey's urgency and legal status (see the module comment).
 * Takes the records rather than reading them, because FD-23 keeps the full referral list off the
 * ward's and the team's screens (`tests/ward-referral-screen-boundary.test.ts`): the ward passes none
 * and the team passes only its own Sent row (`sent-referral-journey-changes.tsx`).
 */
export function journeyIsMine(
  records: Parameters<typeof journeySentByDesk>[0],
  movement: Movement | undefined,
  routeRole: string,
  access: Parameters<typeof journeySentByDesk>[2],
  places: Parameters<typeof journeySentByDesk>[3],
): movement is Movement {
  return (
    movement !== undefined &&
    (routeRole === "ward" || routeRole === "community") &&
    !movement.closure &&
    canDispatch(routeRole, "CHANGE_URGENCY") &&
    canDispatch(routeRole, "CHANGE_LEGAL_STATUS") &&
    journeySentByKind(records.referrals, movement, routeRole) &&
    journeySentByDesk(records, movement, access, places)
  );
}

/**
 * The ward's check for a journey leaving one of its stays. Both sender checks answer a journey
 * leaving a stay from the stay alone, so no referral is read; one that is not is never the ward's
 * here.
 */
export function useStayJourneyIsMine(movement: Movement | undefined): boolean {
  const routeRole = useRouteRole();
  const { admissions, units } = useWardFlowSelect("admissions", "units");
  const access = useEffectiveWardAccess();
  return (
    movement?.sourceAdmissionId !== undefined &&
    journeyIsMine({ referrals: [], admissions }, movement, routeRole, access, wardPlaceLookup(units))
  );
}

type Open = "urgency" | "legal" | null;

/**
 * A form's submit, unavailable with its reason in full beside it until the form is complete. The
 * reason wraps rather than being cut short, since it says why nothing is chosen for the desk.
 */
function Submit({ id, blocked, children }: { id: string; blocked: string | undefined; children: string }) {
  return (
    <>
      <Button
        type="submit"
        variant="pri"
        size="sm"
        className={styles.submit}
        aria-disabled={blocked ? true : undefined}
        aria-describedby={blocked ? id : undefined}
      >
        {children}
      </Button>
      {blocked ? (
        <p id={id} className={styles.blocked}>
          {blocked}
        </p>
      ) : null}
    </>
  );
}

/** The two forms. Render it only for a journey `journeyIsMine` passed (`useStayJourneyIsMine` on the
 *  ward, `SentReferralJourneyChanges` on the team's Sent list). */
export function SentJourneyChanges({ movement, patientWho }: { movement: Movement; patientWho: string }) {
  const routeRole = useRouteRole();
  const { dispatch } = useWardFlowSelect("dispatch");
  const now = useWardFlowClock();
  const baseId = useId();
  const [open, setOpen] = useState<Open>(null);
  const [urgency, setUrgency] = useState<1 | 2 | 3>(movement.urgency);
  const [urgencyReason, setUrgencyReason] = useState<UrgencyChangeReason | undefined>(undefined);
  const [legalStatus, setLegalStatus] = useState<LegalStatus | undefined>(undefined);
  const [legalReason, setLegalReason] = useState<LegalStatusChangeReason | undefined>(undefined);
  const [message, setMessage] = useState<string | undefined>(undefined);
  // Audit CS3-01: an open form is checked against the board it opened on, so a legal status another
  // desk recorded meanwhile is reported, not overwritten.
  const heldScope = `movement:${movement.id}`;
  useHoldOpenForm(open !== null, heldScope);

  const raise = wardRaise(dispatch, routeRole, now);
  const report = (result: ReturnType<typeof raise>) => {
    void Promise.resolve(result).then((outcome) => setMessage(wardCommandFailure(outcome ?? undefined)));
  };

  // Each toggle opens one form with nothing chosen yet, so an earlier choice never stands in for a new one.
  function toggle(next: Exclude<Open, null>) {
    setOpen((current) => (current === next ? null : next));
    setUrgency(movement.urgency);
    setUrgencyReason(undefined);
    setLegalStatus(undefined);
    setLegalReason(undefined);
    setMessage(undefined);
  }

  function submitUrgency(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Finding 15 (Josh, 27 Oct 2026): the reason is sent when chosen and never required.
    report(
      raise("CHANGE_URGENCY", {
        movementId: movement.id,
        urgency,
        ...(urgencyReason === undefined ? {} : { reason: urgencyReason }),
      }),
    );
    setOpen(null);
  }

  // The new status first, then where the entry came from.
  const legalBlocked =
    legalStatus === undefined
      ? LEGAL_STATUS_UNCHOSEN
      : legalReason === undefined
        ? LEGAL_STATUS_REASON_UNCHOSEN
        : undefined;

  function submitLegalStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (legalStatus === undefined || legalReason === undefined) return;
    report(raise("CHANGE_LEGAL_STATUS", { movementId: movement.id, legalStatus, reason: legalReason }));
    setOpen(null);
  }

  return (
    <section
      className={styles.box}
      aria-label={`Change urgency or legal status for ${patientWho}`}
      data-testid="sent-journey-changes"
      data-held-form={heldScope}
    >
      <p className={styles.now} data-testid="sent-journey-now">
        {urgencyTierLabel(movement.urgency)} · {movement.legalStatus ?? "Legal status not recorded"}
      </p>
      <div className={styles.actions}>
        <Button
          size="sm"
          aria-expanded={open === "urgency"}
          data-testid="sent-journey-urgency-toggle"
          onClick={() => toggle("urgency")}
        >
          Change urgency
        </Button>
        <Button
          size="sm"
          aria-expanded={open === "legal"}
          data-testid="sent-journey-legal-status-toggle"
          onClick={() => toggle("legal")}
        >
          Change legal status
        </Button>
      </div>

      {open === "urgency" ? (
        <form className={styles.form} onSubmit={submitUrgency} data-testid="sent-journey-urgency">
          <Field label={`Urgency tier for ${patientWho}`} id={`${baseId}-tier`}>
            <Select value={urgency} onChange={(event) => setUrgency(Number(event.target.value) as 1 | 2 | 3)}>
              {URGENCY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {urgencyTierLabel(option)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Reason" id={`${baseId}-urgency-reason`}>
            <Select
              value={urgencyReason ?? ""}
              onChange={(event) =>
                setUrgencyReason(event.target.value === "" ? undefined : (event.target.value as UrgencyChangeReason))
              }
            >
              <option value="">Choose a reason</option>
              {URGENCY_CHANGE_REASONS.map((reason) => (
                <option key={reason} value={reason}>
                  {changeReasonLabels[reason]}
                </option>
              ))}
            </Select>
          </Field>
          <Submit id={`${baseId}-urgency-blocked`} blocked={undefined}>
            Record urgency change
          </Submit>
        </form>
      ) : null}

      {open === "legal" ? (
        <form className={styles.form} onSubmit={submitLegalStatus} data-testid="sent-journey-legal-status">
          <Field label={`Legal status for ${patientWho}`} id={`${baseId}-legal`}>
            <Select
              value={legalStatus ?? ""}
              onChange={(event) =>
                setLegalStatus(event.target.value === "" ? undefined : (event.target.value as LegalStatus))
              }
            >
              <option value="">Choose a legal status</option>
              {LEGAL_STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Reason" id={`${baseId}-legal-reason`}>
            <Select
              required
              value={legalReason ?? ""}
              onChange={(event) =>
                setLegalReason(event.target.value === "" ? undefined : (event.target.value as LegalStatusChangeReason))
              }
            >
              <option value="">Choose a reason</option>
              {LEGAL_STATUS_CHANGE_REASONS.map((reason) => (
                <option key={reason} value={reason}>
                  {changeReasonLabels[reason]}
                </option>
              ))}
            </Select>
          </Field>
          <Submit id={`${baseId}-legal-blocked`} blocked={legalBlocked}>
            Record legal status change
          </Submit>
        </form>
      ) : null}

      {message ? (
        <p role="status" className={styles.message}>
          {message}
        </p>
      ) : null}
    </section>
  );
}
