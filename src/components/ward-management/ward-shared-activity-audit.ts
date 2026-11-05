import type { SharedAsk } from "./ward-shared-push-api";

export type SharedActivityAuditEvent = { sequence: string; action: string; outcome: string; committed_at: string };
export type SharedActivityAuditPage = {
  events: SharedActivityAuditEvent[];
  complete: boolean;
  nextCursor: string | null;
};

/** Preserve sparse permitted-page continuation instead of treating an empty page as complete. */
export async function readActivityAuditPage(ask: SharedAsk, before?: string): Promise<SharedActivityAuditPage> {
  if (before !== undefined && !/^[1-9]\d*$/.test(before)) throw new Error("Invalid Activity cursor");
  const path = `/v1/workspace/audit${before === undefined ? "" : `?before=${encodeURIComponent(before)}`}`;
  const { response, value } = await ask(path);
  if (!response.ok || !Array.isArray(value?.events)) throw new Error("Activity could not be read");
  const complete = value.complete === true;
  const nextCursor =
    typeof value.nextCursor === "string" && /^[1-9]\d*$/.test(value.nextCursor) ? value.nextCursor : null;
  if (!complete && nextCursor === null) throw new Error("Activity continuation could not be read");
  return { events: value.events, complete, nextCursor };
}

/** Existing readers retain their array result; the Activity UI uses the page contract above. */
export async function readActivityAudit(ask: SharedAsk): Promise<SharedActivityAuditEvent[]> {
  const { response, value } = await ask("/v1/workspace/audit");
  if (!response.ok || !Array.isArray(value?.events)) throw new Error("Activity could not be read");
  return value.events;
}
