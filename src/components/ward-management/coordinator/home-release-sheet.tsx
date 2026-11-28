"use client";

import type { QueueEntry } from "@/components/ward-management/alerts/alerts-queue";
import { ReleasePulledBedSheet } from "@/components/ward-management/release-pulled-bed-sheet";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";

/**
 * H-0977 (workflow-speed audit WS-14, 26 Oct 2026): Home's "Release bed" on an expired bed pull
 * releases in place. Mock-up (simplification R1, 26 Nov 2026): the sheet itself is now the shared
 * `ReleasePulledBedSheet`, which every other door opens too; this wrapper fills it from an alert.
 *
 * The parent keeps this mounted with no entry once the sheet closes, because the step's outcome
 * (released, or refused with the engine's reason) is said by `useUndoableStep` after the press.
 */
export function HomeReleaseSheet({
  entry,
  onClose,
  testId = "home-release-sheet",
}: {
  entry: QueueEntry | undefined;
  onClose: () => void;
  testId?: string;
}) {
  const access = useEffectiveWardAccess();
  const movementId = entry?.item.movementId;
  return (
    <ReleasePulledBedSheet
      target={
        entry && movementId
          ? {
              movementId,
              kind: "pull",
              displayName: entry.subject.displayName,
              umrn: entry.subject.umrn,
              context: `${entry.item.title}.`,
            }
          : undefined
      }
      role="coordinator"
      disabledReason={access.role !== "coordinator" ? "Only the coordinator can release a pulled bed here." : undefined}
      onClose={onClose}
      testId={testId}
    />
  );
}
