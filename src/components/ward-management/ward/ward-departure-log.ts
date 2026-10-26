import type { Admission } from "../ward-admissions";
import { formatInstantWithDay, type Instant } from "../ward-clock";
import type { BedRelease } from "../ward-model";

export type WardShiftLogRow = {
  key: string;
  at: number;
  timeLabel: string;
  title: string;
  detail: string;
  status: string;
  nested?: Array<{ key: string; detail: string }>;
};

/** Keep the current departure plan separate from the earlier release-stage report. */
export function pendingDepartureLogRows(
  pendingBedReleases: readonly BedRelease[],
  admissions: readonly Admission[],
  now: Instant,
): WardShiftLogRow[] {
  const logRows: WardShiftLogRow[] = [];
  // A later date edit changes the current plan, not what the earlier stage report said.
  // Only the matching stay date can supply that edit's time and recorded author.
  const laterReleasePlans = new Map(
    pendingBedReleases.flatMap((release) => {
      const stay = admissions.find((admission) => admission.id === release.admissionId);
      return stay &&
        stay.expectedDischargeAt === release.expectedAt &&
        stay.dischargeDateSetAt !== null &&
        stay.dischargeDateSetAt > release.confirmedAt
        ? [[release.id, stay] as const]
        : [];
    }),
  );
  if (pendingBedReleases.length === 1) {
    const release = pendingBedReleases[0];
    logRows.push({
      key: release.id,
      at: release.confirmedAt,
      timeLabel: formatInstantWithDay(release.confirmedAt, now),
      title: "Bed expected out",
      detail: `${laterReleasePlans.has(release.id) ? "Current departure plan shown separately" : `Departure ${formatInstantWithDay(release.expectedAt, now)}`}${release.waitingOn ? ` · ${release.waitingOn}` : ""}`,
      status: release.state === "confirmed" ? "Confirmed" : "Expected",
    });
  } else if (pendingBedReleases.length > 1) {
    const ordered = [...pendingBedReleases].sort((left, right) => left.expectedAt - right.expectedAt);
    const next = ordered[0];
    logRows.push({
      key: "releases",
      at: Math.max(...pendingBedReleases.map((release) => release.confirmedAt)),
      timeLabel: formatInstantWithDay(Math.max(...pendingBedReleases.map((release) => release.confirmedAt)), now),
      title: `${pendingBedReleases.length} beds expected out`,
      detail:
        laterReleasePlans.size > 0
          ? "Current departure plan shown separately"
          : `Next at ${formatInstantWithDay(next.expectedAt, now)}`,
      status: "Expected",
      nested: ordered.map((release) => ({
        key: release.id,
        detail: `${laterReleasePlans.has(release.id) ? "Current departure plan shown separately" : formatInstantWithDay(release.expectedAt, now)}${release.waitingOn ? ` · ${release.waitingOn}` : ""}`,
      })),
    });
  }
  for (const [releaseId, stay] of laterReleasePlans) {
    logRows.push({
      key: `date-${releaseId}`,
      at: stay.dischargeDateSetAt!,
      timeLabel: formatInstantWithDay(stay.dischargeDateSetAt!, now),
      title: "Expected departure updated",
      detail: `Departure ${formatInstantWithDay(stay.expectedDischargeAt!, now)}${stay.dischargeDateSetBy ? ` · ${stay.dischargeDateSetBy}` : ""}`,
      status: "Updated",
    });
  }
  return logRows;
}
