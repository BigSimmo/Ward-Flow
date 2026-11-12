"use client";

import { useState } from "react";
import { PhoneCall } from "lucide-react";

import { Button, Field, Icon, StateLine, TIME_FIELD_ERROR, TimeField } from "@/components/wf";
import { useEffectiveWardAccess, useWardAccessSnapshot } from "@/components/ward-management/shell/ward-access-store";
import { formatInstantWithDay, minuteOfDayFromClockText } from "@/components/ward-management/ward-clock";
import { useOptionalWardFlowSelect, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { useWardRaise } from "@/components/ward-management/ward-flow-raise";
import { useRouteRole } from "@/components/ward-management/ward-role-gate";
import { useWardFormSave } from "@/components/ward-management/use-ward-form-save";

import { handoverDeskOf } from "@/components/ward-management/handover/handover-desk";
import { nextClockInstant, openCarerCallbackFor } from "./handover-work-model";
import styles from "./carer-callback-card.module.css";

const NONE: never[] = [];

/**
 * CARER CALLBACK (batch 3 item 23), on the patient page and the ward's bed record. "Carer wants a
 * call back", best after a typed time; it then shows in handover's promises due once that time
 * comes, until someone ticks it off with "Call made". 🔒 No carer name or phone number is typed
 * here: the only box is the time. One open call back per person; asking again moves its time.
 */
export function CarerCallbackCard({ admissionId, movementId }: { admissionId?: string; movementId?: string }) {
  const flow = useOptionalWardFlowSelect("carerCallbacks", "admissions", "movements", "units");
  const now = useWardFlowClock();
  const routeRole = useRouteRole();
  const access = useEffectiveWardAccess();
  const previewing = useWardAccessSnapshot().previewOf !== null;
  const desk = routeRole === "ward" ? "ward" : "coordinator";
  const raise = useWardRaise(desk);
  const save = useWardFormSave(`carer-callback:${admissionId ?? movementId ?? "none"}`);
  const [editing, setEditing] = useState(false);
  const [time, setTime] = useState("");
  const [showError, setShowError] = useState(false);
  if (!flow || (admissionId === undefined && movementId === undefined)) return null;
  // A stay is the subject while there is one; a bed request only before the person has a stay.
  const subject = admissionId !== undefined ? { admissionId } : { movementId };
  const ward =
    admissionId !== undefined
      ? flow.admissions.find((admission) => admission.id === admissionId)?.unitId
      : flow.movements.find((movement) => movement.id === movementId)?.acceptedUnitId;
  const ownWard = routeRole === "ward" ? handoverDeskOf(access, flow.units).ownWard : undefined;
  const canRecord =
    !previewing &&
    (routeRole === "coordinator" || (routeRole === "ward" && ownWard !== undefined && ownWard.id === ward));
  // A call back asked for on the bed request still shows, once, after the person has a stay.
  const requestId =
    movementId ?? flow.admissions.find((admission) => admission.id === admissionId)?.movementId ?? undefined;
  const open = openCarerCallbackFor(
    { carerCallbacks: flow.carerCallbacks ?? NONE },
    { ...subject, ...(requestId ? { movementId: requestId } : {}) },
  );
  if (!open && !canRecord) return null;
  const acting = routeRole === "ward" && ownWard ? { actingUnitId: ownWard.id } : {};
  const minute = time ? minuteOfDayFromClockText(time) : undefined;
  const bestAfter = minute !== undefined ? nextClockInstant(minute, now) : undefined;

  const submit = () => {
    if (bestAfter === undefined) {
      setShowError(true);
      return;
    }
    save.submit(
      () => raise("RECORD_CARER_CALLBACK", { ...subject, bestAfter, ...acting }),
      () => {
        setEditing(false);
        setTime("");
        setShowError(false);
      },
    );
  };

  return (
    <section className={styles.card} aria-label="Carer call back" data-testid="ward-carer-callback">
      <div className={styles.line}>
        <Icon icon={PhoneCall} size={16} className={styles.icon} />
        <span className={styles.text}>
          {open ? (
            <>
              Carer wants a call back · best after{" "}
              <span className={styles.clock}>{formatInstantWithDay(open.bestAfter, now)}</span>
            </>
          ) : (
            "Carer call back"
          )}
        </span>
        {canRecord && !editing ? (
          <span className={styles.actions}>
            {open ? (
              <Button
                variant="sec"
                size="sm"
                data-testid="ward-carer-callback-made"
                disabledReason={save.pending ? "Saving" : undefined}
                onClick={() =>
                  save.submit(
                    () => raise("MARK_CARER_CALLBACK_MADE", { callbackId: open.id, ...acting }),
                    () => undefined,
                  )
                }
              >
                Call made
              </Button>
            ) : null}
            <Button variant="ghost" size="sm" data-testid="ward-carer-callback-open" onClick={() => setEditing(true)}>
              {open ? "Change time" : "Carer wants a call back"}
            </Button>
          </span>
        ) : null}
      </div>
      {/* "Call made" saves from the line above; its failure must show without opening the form. */}
      {!editing && save.error ? <StateLine kind="error" compact title={save.error} /> : null}
      {editing ? (
        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <Field
            label="Best after"
            hint={bestAfter !== undefined ? `Due ${formatInstantWithDay(bestAfter, now)}` : "HH:MM"}
            error={showError ? TIME_FIELD_ERROR : undefined}
          >
            <TimeField value={time} onValueChange={setTime} data-testid="ward-carer-callback-time" />
          </Field>
          <p className={styles.note}>Only the time is kept. Do not add the carer&apos;s name or number.</p>
          {save.error ? <StateLine kind="error" compact title={save.error} /> : null}
          <span className={styles.actions}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditing(false);
                setTime("");
                setShowError(false);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="pri"
              size="sm"
              type="submit"
              data-testid="ward-carer-callback-save"
              disabledReason={save.pending ? "Saving" : undefined}
            >
              Save call back
            </Button>
          </span>
        </form>
      ) : null}
    </section>
  );
}
