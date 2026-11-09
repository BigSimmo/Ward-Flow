/**
 * "Where the hours went" (item 8): splits one journey's elapsed time into named waits, read only
 * from times the record holds. Each stage runs between two recorded boundaries:
 *
 *   Waiting for review       opened             → psychiatric examination recorded
 *   Waiting for legal form   examination        → form received (or formed)
 *   Waiting for a bed        referred for a bed → accepted by a ward
 *   Waiting for transport    accepted           → recorded departure from the department
 *
 * A stage whose boundary was not recorded says "Not recorded"; nothing is estimated or filled in
 * between. A boundary recorded before its start is reported as out of order, not as a negative
 * figure. Only the stage that started at the latest recorded boundary of an open journey runs to
 * `now`, and says so. Elapsed waits only: a legal form's typed expiry is never read here (D-93).
 * Synthetic prototype, not a medical device.
 */
import type { Instant } from "@/components/ward-management/ward-clock";
import { recordedEdDeparture } from "@/components/ward-management/ward-ed-presence";
import { requiresAuthorisedDestination } from "@/components/ward-management/ward-eligibility";
import type { Movement } from "@/components/ward-management/ward-model";

export type HoursStageKey = "review" | "form" | "bed" | "transport";

export type HoursStageStatus =
  /** Both boundaries recorded, in order. */
  | "recorded"
  /** Started at the latest recorded boundary of an open journey; runs to now. */
  | "running"
  /** A boundary was not recorded. */
  | "not_recorded"
  /** The end was recorded before the start. */
  | "out_of_order"
  /** No legal form on the record and the recorded legal status needs none. */
  | "not_needed";

export type HoursStage = {
  readonly key: HoursStageKey;
  readonly label: string;
  /** "Opened → review", the two boundaries in words. */
  readonly span: string;
  readonly status: HoursStageStatus;
  readonly startAt?: Instant;
  readonly endAt?: Instant;
  /** Whole minutes, only for "recorded" and "running". */
  readonly minutes?: number;
  /** Why there is no figure: "Review time not recorded", "Accepted recorded before referred". */
  readonly note?: string;
};

export type HoursBreakdown = {
  readonly openedAt: Instant;
  /** Recorded departure, else closure, else now. */
  readonly endAt: Instant;
  /** No departure and no closure recorded: the total runs to now. */
  readonly open: boolean;
  readonly totalMinutes: number;
  readonly stages: readonly HoursStage[];
  /**
   * Time inside the journey that no measured stage covers (gaps between stages, and stages whose
   * boundary is missing). Undefined when measured stages overlap or fall outside the journey, so
   * a remainder would mislead.
   */
  readonly otherMinutes?: number;
  /** Measured stages overlap in time, so they do not add up to the total. */
  readonly overlap: boolean;
};

export type HoursMovement = Pick<
  Movement,
  | "openedAt"
  | "examination"
  | "legalForm"
  | "legalStatus"
  | "legalFormReceivedAt"
  | "formedAt"
  | "referredAt"
  | "acceptedAt"
  | "leftDepartmentAt"
  | "transport"
  | "closure"
> &
  Partial<Pick<Movement, "stageChanges">>;

type StageDefinition = {
  key: HoursStageKey;
  label: string;
  from: string;
  to: string;
  start: Instant | undefined;
  end: Instant | undefined;
  notNeeded?: boolean;
};

function finite(at: Instant | undefined): Instant | undefined {
  return typeof at === "number" && Number.isFinite(at) ? at : undefined;
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function hoursBreakdown(movement: HoursMovement, now: Instant): HoursBreakdown {
  const openedAt = movement.openedAt;
  const departure = finite(recordedEdDeparture(movement));
  const closedAt = finite(movement.closure?.at);
  const open = departure === undefined && closedAt === undefined;
  const endAt = Math.max(openedAt, departure ?? closedAt ?? now);
  const totalMinutes = endAt - openedAt;

  const reviewAt = finite(movement.examination?.at);
  const formAt = finite(movement.legalFormReceivedAt ?? movement.formedAt);
  const referredAt = finite(movement.referredAt);
  const acceptedAt = finite(movement.acceptedAt);
  const formNotNeeded =
    movement.legalForm === undefined && formAt === undefined && !requiresAuthorisedDestination(movement.legalStatus);

  const definitions: StageDefinition[] = [
    { key: "review", label: "Waiting for review", from: "opened", to: "review", start: openedAt, end: reviewAt },
    {
      key: "form",
      label: "Waiting for legal form",
      from: "review",
      to: "form",
      start: reviewAt,
      end: formAt,
      notNeeded: formNotNeeded,
    },
    { key: "bed", label: "Waiting for a bed", from: "referred", to: "accepted", start: referredAt, end: acceptedAt },
    {
      key: "transport",
      label: "Waiting for transport",
      from: "accepted",
      to: "departed",
      start: acceptedAt,
      end: departure,
    },
  ];

  // The latest recorded boundary: only a stage starting there can still be running.
  const boundaries = [openedAt, reviewAt, formAt, referredAt, acceptedAt].filter(
    (at): at is Instant => at !== undefined,
  );
  const latest = Math.max(...boundaries);

  const stages = definitions.map((stage): HoursStage => {
    const base = { key: stage.key, label: stage.label, span: `${capitalise(stage.from)} → ${stage.to}` };
    if (stage.notNeeded) return { ...base, status: "not_needed", note: "No form needed on this record" };
    if (stage.start === undefined)
      return { ...base, status: "not_recorded", endAt: stage.end, note: `${capitalise(stage.from)} time not recorded` };
    if (stage.end === undefined) {
      if (open && stage.start === latest && stage.start <= now)
        return { ...base, status: "running", startAt: stage.start, minutes: now - stage.start };
      return {
        ...base,
        status: "not_recorded",
        startAt: stage.start,
        note: `${capitalise(stage.to)} time not recorded`,
      };
    }
    if (stage.end < stage.start)
      return {
        ...base,
        status: "out_of_order",
        startAt: stage.start,
        endAt: stage.end,
        note: `${capitalise(stage.to)} recorded before ${stage.from}`,
      };
    return { ...base, status: "recorded", startAt: stage.start, endAt: stage.end, minutes: stage.end - stage.start };
  });

  const measured = stages
    .filter((stage) => stage.minutes !== undefined && stage.startAt !== undefined)
    .map((stage) => ({ start: stage.startAt as Instant, end: (stage.startAt as Instant) + (stage.minutes ?? 0) }))
    .sort((a, b) => a.start - b.start);
  const overlap = measured.some((interval, index) => index > 0 && interval.start < measured[index - 1].end);
  const outside = measured.some((interval) => interval.start < openedAt || interval.end > endAt);
  const measuredTotal = measured.reduce((sum, interval) => sum + (interval.end - interval.start), 0);
  const otherMinutes = overlap || outside ? undefined : Math.max(0, totalMinutes - measuredTotal);

  return { openedAt, endAt, open, totalMinutes, stages, otherMinutes, overlap };
}

/** "5h 20m", "45m" or "2d 3h": whole minutes as elapsed hours, for the table's mono figures. */
export function hoursText(minutes: number): string {
  const whole = Math.max(0, Math.round(minutes));
  const days = Math.floor(whole / 1440);
  const hours = Math.floor((whole % 1440) / 60);
  const rest = whole % 60;
  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  if (hours > 0) return `${hours}h ${rest < 10 ? "0" : ""}${rest}m`;
  return `${rest}m`;
}

/**
 * Statistics: the median minutes per stage across closed journeys, counting only stages whose two
 * boundaries were both recorded in order. A stage no closed journey recorded has `median`
 * undefined, so the screen says "Not recorded" rather than zero.
 */
export function medianStageMinutes(
  movements: readonly HoursMovement[],
  now: Instant,
): { key: HoursStageKey; label: string; median?: number; journeys: number }[] {
  const closed = movements.filter((movement) => movement.closure !== undefined);
  const byStage = new Map<HoursStageKey, { label: string; values: number[] }>();
  for (const movement of closed) {
    for (const stage of hoursBreakdown(movement, now).stages) {
      const entry = byStage.get(stage.key) ?? { label: stage.label, values: [] };
      if (stage.status === "recorded" && stage.minutes !== undefined) entry.values.push(stage.minutes);
      byStage.set(stage.key, entry);
    }
  }
  const keys: HoursStageKey[] = ["review", "form", "bed", "transport"];
  const labels: Record<HoursStageKey, string> = {
    review: "Waiting for review",
    form: "Waiting for legal form",
    bed: "Waiting for a bed",
    transport: "Waiting for transport",
  };
  return keys.map((key) => {
    const values = [...(byStage.get(key)?.values ?? [])].sort((a, b) => a - b);
    const mid = Math.floor(values.length / 2);
    const median =
      values.length === 0 ? undefined : values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2;
    return { key, label: labels[key], median, journeys: values.length };
  });
}
