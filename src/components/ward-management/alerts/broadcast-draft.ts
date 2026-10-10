import {
  BROADCAST_CATEGORIES,
  BROADCAST_SEVERITIES,
  BROADCAST_TARGET_SCOPES,
  WA_BROADCAST_TEMPLATES,
  type BroadcastCategory,
  type BroadcastSeverity,
  type BroadcastTargetScope,
} from "./ward-broadcast-model";

/**
 * The WHOLE editable broadcast form as one value, so it can be cached, restored and compared as a
 * unit. Caching only the message used to restore the text on reload while silently resetting the
 * title, severity, target scope, duration and template — letting a directive be sent with different
 * metadata from the one the user composed — and a title-only edit never counted as unsaved at all.
 */
export interface BroadcastDraft {
  templateId: string;
  title: string;
  message: string;
  severity: BroadcastSeverity;
  category: BroadcastCategory;
  scope: BroadcastTargetScope;
  durationMinutes: number;
  /** Global alerts, 10 Oct 2026: a directive or a bed call. Older drafts have none. */
  kind?: "directive" | "bed_call";
}

const CUSTOM_BROADCAST_TEMPLATE_ID = "custom";

/** The untouched form for a template: what the form holds before the user edits anything. */
export function broadcastDraftBaseline(templateId: string): BroadcastDraft {
  const template = WA_BROADCAST_TEMPLATES.find((candidate) => candidate.id === templateId);
  if (!template) {
    return {
      templateId: CUSTOM_BROADCAST_TEMPLATE_ID,
      title: "",
      message: "",
      severity: "critical",
      category: "capacity_gridlock",
      scope: "all",
      durationMinutes: 240,
      kind: "directive",
    };
  }
  return {
    templateId: template.id,
    title: template.title,
    message: template.defaultMessage,
    severity: template.severity,
    category: template.category,
    scope: template.targetScope,
    durationMinutes: template.defaultDurationMinutes,
    kind: template.kind === "bed_call" ? "bed_call" : "directive",
  };
}

/** Dirty means ANY field differs from its template's baseline, not just the message. */
export function isBroadcastDraftDirty(draft: BroadcastDraft): boolean {
  const baseline = broadcastDraftBaseline(draft.templateId);
  return (
    draft.title !== baseline.title ||
    draft.message !== baseline.message ||
    draft.severity !== baseline.severity ||
    draft.category !== baseline.category ||
    draft.scope !== baseline.scope ||
    draft.durationMinutes !== baseline.durationMinutes ||
    (draft.kind ?? baseline.kind) !== baseline.kind
  );
}

export function serialiseBroadcastDraft(draft: BroadcastDraft): string {
  return JSON.stringify(draft);
}

/** Returns undefined for anything that is not a complete, well-formed draft: never a partial one. */
export function parseBroadcastDraft(raw: string): BroadcastDraft | undefined {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (typeof value !== "object" || value === null) return undefined;
  const record = value as Record<string, unknown>;
  const { templateId, title, message, severity, category, scope, durationMinutes, kind } = record;
  if (
    typeof templateId !== "string" ||
    typeof title !== "string" ||
    typeof message !== "string" ||
    typeof severity !== "string" ||
    typeof category !== "string" ||
    typeof scope !== "string" ||
    typeof durationMinutes !== "number"
  )
    return undefined;
  if (
    !BROADCAST_SEVERITIES.includes(severity as BroadcastSeverity) ||
    !BROADCAST_CATEGORIES.includes(category as BroadcastCategory) ||
    !BROADCAST_TARGET_SCOPES.includes(scope as BroadcastTargetScope) ||
    !Number.isInteger(durationMinutes) ||
    durationMinutes <= 0 ||
    (kind !== undefined && kind !== "directive" && kind !== "bed_call")
  )
    return undefined;
  const knownTemplate =
    templateId === CUSTOM_BROADCAST_TEMPLATE_ID || WA_BROADCAST_TEMPLATES.some((t) => t.id === templateId);
  if (!knownTemplate) return undefined;
  return {
    templateId,
    title,
    message,
    severity: severity as BroadcastSeverity,
    category: category as BroadcastCategory,
    scope: scope as BroadcastTargetScope,
    durationMinutes,
    ...(kind === undefined ? {} : { kind }),
  };
}
