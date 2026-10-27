"use client";

import { useState } from "react";

import type { QueueEntry } from "@/components/ward-management/alerts/alerts-queue";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { useUndoableStep } from "@/components/ward-management/use-undoable-step";
import {
  RELEASE_PULL_REASONS,
  changeReasonLabels,
  type ReleasePullReason,
} from "@/components/ward-management/ward-change-reasons";
import { useWardFlowClock, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { Button, Field, Select, Sheet } from "@/components/wf";

/**
 * H-0977 (workflow-speed audit WS-14, 26 Oct 2026): Home's "Release bed" on an expired bed pull
 * releases in place. One sheet: the alert, a reason from the same release list Alerts and the
 * movement page use, and the reason-gated release naming its patient (CT-19). It raises the same
 * `RELEASE_PULL` event, only from the button press, and the engine still refuses a release that
 * has an active transport job.
 *
 * The parent keeps this mounted with no entry once the sheet closes, because the step's outcome
 * (released, or refused with the engine's reason) is said by `useUndoableStep` after the press.
 */
export function HomeReleaseSheet({ entry, onClose }: { entry: QueueEntry | undefined; onClose: () => void }) {
  const { dispatch, rejections } = useWardFlowSelect("dispatch", "rejections");
  const now = useWardFlowClock();
  const access = useEffectiveWardAccess();
  const [reason, setReason] = useState<ReleasePullReason | "">("");
  const { run } = useUndoableStep({ dispatch, rejections, now, routeRole: "coordinator" });
  if (!entry) return null;
  const { item, subject } = entry;
  const movementId = item.movementId;
  const close = () => {
    setReason("");
    onClose();
  };
  const disabledReason =
    access.role !== "coordinator"
      ? "Only the coordinator can release a pulled bed here."
      : reason === ""
        ? "Choose a reason first"
        : undefined;
  return (
    <Sheet open onClose={close} title="Release pulled bed" mobilePlacement="bottom" testId="home-release-sheet">
      <p>
        {item.title}. {item.detail}
      </p>
      <p data-testid="home-release-who">
        For {subject.displayName} {subject.umrn}
      </p>
      <Field label="Reason for release" id={`home-release-${item.id}`}>
        <Select value={reason} onChange={(event) => setReason(event.target.value as ReleasePullReason | "")}>
          <option value="">Choose a reason</option>
          {RELEASE_PULL_REASONS.map((option) => (
            <option key={option} value={option}>
              {changeReasonLabels[option]}
            </option>
          ))}
        </Select>
      </Field>
      <Button
        variant="pri"
        disabledReason={disabledReason}
        reasonDisplay="tooltip"
        onClick={() => {
          if (disabledReason !== undefined || reason === "" || !movementId) return;
          run(
            { type: "RELEASE_PULL", role: "coordinator", now, movementId, reason },
            { success: `Bed released for ${subject.displayName}.` },
          );
          close();
        }}
      >
        {/* CT-19: the reason-gated release names its patient at the point of commit. */}
        Release pulled bed for {subject.displayName}
      </Button>
    </Sheet>
  );
}
