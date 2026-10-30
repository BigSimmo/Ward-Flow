import type { BedRelease } from "@/components/ward-management/ward-model";

/**
 * The one action a bed release row offers, named for what it needs next. Each opens the release's
 * panel, where today's real actions (confirm, block, transport) are recorded, so no button here
 * records anything on its own.
 */
export function releaseActionLabel(release: Pick<BedRelease, "state" | "blocker">): string {
  if (release.blocker !== null) return "Chase";
  if (release.state === "expected") return "Confirm date";
  return "Open";
}
