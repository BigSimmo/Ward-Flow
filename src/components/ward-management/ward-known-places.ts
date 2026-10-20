import { communityTeamById } from "@/components/ward-management/community/community-derivations";
import type { Unit } from "@/components/ward-management/ward-model";
import { HEALTH_SERVICES } from "@/components/ward-management/ward-model-vocabulary";
import { safeDecodeURIComponent } from "@/components/ward-management/ward-safe-url";
import { scenarioWardNetwork, WARD_SCENARIOS } from "@/components/ward-management/ward-scenarios";
import { edById } from "@/components/ward-management/ward-sites";

/**
 * DA-32 (overall review, 20 Oct 2026): what a ward or health service address can name, for the
 * routes to answer an unknown one with a real "not found" (404) instead of a page that reports
 * success. Read on the server, before anything is shown. Departments and community teams already
 * have exact lookups (`edById`, `communityTeamById`).
 *
 * Places are fixed in the build: every scenario's network, shared mode included, draws its wards
 * from these tables, and nothing at run time adds one. A ward is known if any scenario has it, so a
 * link to a ward from one demonstration day still opens on another (the screen then says it is not
 * in today's network). People and journeys are not here: their records live in the browser or the
 * shared store, so those pages keep their own in-page not-found.
 */
let wardsById: Map<string, Unit> | undefined;

export function knownWardUnit(unitId: string): Unit | undefined {
  if (!wardsById) {
    wardsById = new Map();
    for (const scenario of WARD_SCENARIOS) {
      for (const unit of scenarioWardNetwork(scenario).allUnits()) {
        if (!wardsById.has(unit.id)) wardsById.set(unit.id, unit);
      }
    }
  }
  return wardsById.get(unitId);
}

export function isKnownHealthService(serviceId: string): boolean {
  return (HEALTH_SERVICES as readonly string[]).includes(serviceId);
}

/** Each place route, with the check its id must pass. The ward route also has an `/answer` page. */
const PLACE_ROUTES: readonly { pattern: RegExp; known: (id: string) => boolean }[] = [
  { pattern: /^\/ward-flow\/(?:ward|board)\/([^/]+)(?:\/answer)?\/?$/u, known: (id) => Boolean(knownWardUnit(id)) },
  { pattern: /^\/ward-flow\/statistics\/ward\/([^/]+)\/?$/u, known: (id) => Boolean(knownWardUnit(id)) },
  { pattern: /^\/ward-flow\/(?:statistics\/)?ed\/([^/]+)\/?$/u, known: (id) => Boolean(edById(id)) },
  { pattern: /^\/ward-flow\/(?:statistics\/)?community\/([^/]+)\/?$/u, known: (id) => Boolean(communityTeamById(id)) },
  { pattern: /^\/ward-flow\/statistics\/service\/([^/]+)\/?$/u, known: isKnownHealthService },
];

/**
 * True when a request path is a ward, department, team or service page whose id names nothing.
 * Proxy answers it with a 404 before the page streams: once `loading.tsx` has started the response,
 * the page's own `notFound()` can only show the not-found screen under a 200 (Next's docs,
 * `loading.md`, "Status codes"). Every other path, including ones it does not recognise, is false.
 */
export function isUnknownWardFlowPlace(pathname: string): boolean {
  for (const route of PLACE_ROUTES) {
    const match = route.pattern.exec(pathname);
    if (match?.[1] !== undefined) return !route.known(safeDecodeURIComponent(match[1]));
  }
  return false;
}
