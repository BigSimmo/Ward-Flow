import { HEALTH_SERVICES, type HealthService } from "@/components/ward-management/ward-model";

/**
 * THE FILTER — owner ruling 2026-09-09 (`docs/ward-flow/owner-decisions-2026-09-09.md` §1).
 *
 * "I want the handover to be a page that is completely filterable... filtered rapidly based on
 * Service, Ward, ED, Community, etc." Four dimensions, all verified against the live model —
 * a `HandoverScope` is the whole network, or exactly one of a health service, a ward, an ED,
 * or a community team.
 */
export type HandoverScope =
  | { kind: "network" }
  | { kind: "service"; id: HealthService }
  | { kind: "ward"; id: string }
  | { kind: "ed"; id: string }
  | { kind: "team"; id: string };

export const NETWORK_SCOPE_VALUE = "network";

function isHealthService(value: string): value is HealthService {
  return (HEALTH_SERVICES as readonly string[]).includes(value);
}

/** The `<select>`'s own value for a scope — round-tripped by `parseHandoverScope` below. */
export function handoverScopeValue(scope: HandoverScope): string {
  return scope.kind === "network" ? NETWORK_SCOPE_VALUE : `${scope.kind}:${scope.id}`;
}

/** The inverse of `handoverScopeValue`. */
export function parseHandoverScope(value: string): HandoverScope {
  if (value === NETWORK_SCOPE_VALUE) return { kind: "network" };
  const separator = value.indexOf(":");
  if (separator === -1) return { kind: "network" };
  const kind = value.slice(0, separator);
  const id = value.slice(separator + 1);
  if (kind === "service" && isHealthService(id)) return { kind: "service", id };
  if (kind === "ward") return { kind: "ward", id };
  if (kind === "ed") return { kind: "ed", id };
  if (kind === "team") return { kind: "team", id };
  return { kind: "network" };
}
