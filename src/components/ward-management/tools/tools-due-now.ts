import type { Admission } from "@/components/ward-management/ward-admissions";
import { clockState, type Instant } from "@/components/ward-management/ward-clock";
import { delayGroups } from "@/components/ward-management/delays/delays-derivations";
import { BED_RELEASE_BLOCKED_FIGURE_LABEL, elapsedLabel, isOpen } from "@/components/ward-management/ward-derivations";
import type { BedRelease, LeaveBed, Movement, Unit } from "@/components/ward-management/ward-model";
import { serviceRollup } from "@/components/ward-management/ward-morning-rollup";
import { movementHref, unitHref } from "@/components/ward-management/shell/ward-facade";
import { strandedFlags, strandedPromptText } from "@/components/ward-management/ward-stranded";
import { wardSites } from "@/components/ward-management/ward-sites";

const DELAYS_HREF = "/mockups/ward-flow/delays";
const DISCHARGES_HREF = "/mockups/ward-flow/discharges";

export type DueNowItem = {
  id: string;
  label: string;
  detail: string;
  href: string;
  tone: "alert" | "plain";
};

export function buildDueNowItems(input: {
  movements: Movement[];
  units: Unit[];
  admissions: readonly Admission[];
  bedReleases: BedRelease[];
  leaveBeds: readonly LeaveBed[];
  now: Instant;
}): DueNowItem[] {
  const { movements, units, admissions, bedReleases, leaveBeds, now } = input;
  const items: DueNowItem[] = [];
  const open = movements.filter(isOpen);

  const legal = open.flatMap((movement) => {
    const dueAt = movement.legalForm?.dueAt;
    if (dueAt === undefined) return [];
    const state = clockState(dueAt, now);
    if (state !== "breached" && state !== "critical") return [];
    return [
      {
        id: `legal:${movement.id}`,
        label: state === "breached" ? "Deadline passed" : "Due within 1h",
        detail: `Movement ${movement.id}`,
        href: movementHref(movement.id),
        tone: "alert" as const,
      },
    ];
  });
  items.push(...legal.slice(0, 4));
  if (legal.length > 4) {
    items.push({
      id: "legal:more",
      label: "More recorded due times",
      detail: `${legal.length - 4} more on Delays`,
      href: DELAYS_HREF,
      tone: "alert",
    });
  }

  const blocked = serviceRollup(wardSites, units, [...bedReleases], [...leaveBeds], now).service.blockedToday;
  if (blocked > 0) {
    items.push({
      id: "blocked",
      label: BED_RELEASE_BLOCKED_FIGURE_LABEL,
      detail: `${blocked} today`,
      href: DISCHARGES_HREF,
      tone: "alert",
    });
  }

  const transport = delayGroups(movements, units, now).find((group) => group.cause === "awaiting_transport");
  const transportRows = (transport?.movements ?? []).slice(0, 3).map((movement) => ({
    id: `transport:${movement.id}`,
    label: "Awaiting transport",
    detail: `Movement ${movement.id} · ${elapsedLabel(movement, now)}`,
    href: movementHref(movement.id),
    tone: "plain" as const,
  }));
  items.push(...transportRows);

  const alreadyListed = new Set(
    items.flatMap((item) => {
      const marker = item.id.split(":")[1];
      return marker ? [marker] : [];
    }),
  );
  const longest = [...open]
    .sort((a, b) => a.openedAt - b.openedAt)
    .filter((movement) => !alreadyListed.has(movement.id))
    .slice(0, 3);
  for (const movement of longest) {
    items.push({
      id: `wait:${movement.id}`,
      label: "Longest wait",
      detail: `Movement ${movement.id} · ${elapsedLabel(movement, now)}`,
      href: movementHref(movement.id),
      tone: "plain",
    });
  }

  const stranded = strandedFlags(admissions, now).slice(0, 3);
  for (const flag of stranded) {
    const admission = admissions.find((item) => item.id === flag.admissionId);
    if (!admission) continue;
    const unit = units.find((item) => item.id === admission.unitId);
    items.push({
      id: `stranded:${flag.admissionId}`,
      label: unit?.name ?? "Ward",
      detail: `${flag.days} days · ${strandedPromptText(flag)}`,
      href: unitHref(admission.unitId),
      tone: "plain",
    });
  }

  return items;
}
