"use client";

import { useId, useState } from "react";
import { buttonClass } from "@/components/wf";
import type { Movement } from "@/components/ward-management/ward-model";
import { useWardFlowClock, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { useRoleGate, useRouteRole } from "@/components/ward-management/ward-role-gate";
import { useUndoableStep } from "@/components/ward-management/use-undoable-step";
import { heldUntilExtendedLabel, pullExtensionChoices } from "@/components/ward-management/ward-bed-hold";
import { PULL_HOLD_MAX_TOTAL_MINUTES } from "@/components/ward-management/ward-operational-defaults";
import styles from "./ward-extend-hold.module.css";

/**
 * Feature 11 (Josh, 9 Nov 2026): "Extend pull" on a pulled bed. Opens 1 h / 2 h / 4 h chips; only
 * the amounts the engine would take (`pullExtensionChoices`) are offered. Records `EXTEND_PULL`.
 * After an extension the line reads "Pulled until 14:30 (extended)".
 */
export function ExtendHoldControl({ movement }: { movement: Movement }) {
  const { dispatch, rejections } = useWardFlowSelect("dispatch", "rejections");
  const now = useWardFlowClock();
  const routeRole = useRouteRole();
  const gate = useRoleGate()("EXTEND_PULL", movement.id);
  const { run } = useUndoableStep({ dispatch, rejections, now, routeRole });
  const [open, setOpen] = useState(false);
  const chipsId = useId();
  const heldUntil = heldUntilExtendedLabel(movement, now);
  if (movement.stage !== "pulled" || movement.pullExpiresAt === undefined || movement.closure) return null;
  const choices = pullExtensionChoices(movement, now);
  const atMaximum = choices.length === 0;
  return (
    <div className={styles.extend} data-testid={`extend-hold-${movement.id}`}>
      {heldUntil ? (
        <p className={styles.heldUntil} data-testid={`held-until-${movement.id}`}>
          {heldUntil}
        </p>
      ) : null}
      {atMaximum ? (
        <p className={styles.note}>Pulled for the longest allowed ({PULL_HOLD_MAX_TOTAL_MINUTES / 60} h).</p>
      ) : (
        <>
          <button
            type="button"
            className={buttonClass({ variant: "sec", size: "sm" })}
            aria-expanded={open}
            aria-controls={chipsId}
            {...gate.buttonProps}
            onClick={() => {
              if (!gate.allowed) return;
              setOpen((value) => !value);
            }}
          >
            Extend pull
          </button>
          {gate.note}
          {open && gate.allowed ? (
            <div id={chipsId} className={styles.chips} role="group" aria-label="Add to the pull time limit">
              {choices.map((minutes) => (
                <button
                  key={minutes}
                  type="button"
                  className={buttonClass({ variant: "tint", size: "sm" })}
                  onClick={() => {
                    setOpen(false);
                    run(
                      {
                        type: "EXTEND_PULL",
                        role: routeRole,
                        now,
                        movementId: movement.id,
                        minutes,
                        ...(routeRole === "ward" ? { actingUnitId: movement.acceptedUnitId } : {}),
                      },
                      { success: `Pull extended by ${minutes / 60} h` },
                    );
                  }}
                >
                  {`+${minutes / 60} h`}
                </button>
              ))}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
