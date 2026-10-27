import type { Unit, EmergencyDepartment } from "@/components/ward-management/ward-model";
import { HEALTH_SERVICES } from "@/components/ward-management/ward-model-vocabulary";
import { scenarioWardNetwork, WARD_SCENARIOS } from "@/components/ward-management/ward-scenarios";
// Server only (route pages): every scenario's wards are needed up front here.
import "@/components/ward-management/ward-scenario-networks";

/**
 * DA-32 (overall review, 20 Oct 2026): what a ward or health service address can name, so each
 * route calls `notFound()` for an unknown one and shows "Page not found" instead of a page that
 * reports success. Read on the server. Wards and EDs share scenario-independent admission;
 * community teams use `communityTeamById`. The check stays in the pages, not in `src/proxy.ts`: the proxy
 * belongs to the host app, which may not import Ward Flow code (`ward-flow-seam.test.ts`), so the
 * not-found page streams under the 200 that `loading.tsx` has already sent, marked `noindex` by Next.
 *
 * Places are fixed in the build: every scenario's network, shared mode included, draws its wards
 * from these tables, and nothing at run time adds one. A ward is known if any scenario has it, so a
 * link to a ward from one demonstration day still opens on another (the screen then says it is not
 * in today's network). People and journeys are not here: their records live in the browser or the
 * shared store, so those pages keep their own in-page not-found.
 */
let wardsById: Map<string, Unit> | undefined;
let departmentsById: Map<string, EmergencyDepartment> | undefined;

/** Server admission must recognise every authored scenario without activating a client network. */
export function knownEmergencyDepartment(edId: string): EmergencyDepartment | undefined {
  if (!departmentsById) {
    departmentsById = new Map();
    for (const scenario of WARD_SCENARIOS) {
      for (const site of scenarioWardNetwork(scenario).sites) {
        const department = site.emergencyDepartment;
        if (!department) continue;
        for (const alias of [department.id, site.code]) {
          const key = alias.toLowerCase();
          if (!departmentsById.has(key)) departmentsById.set(key, department);
        }
      }
    }
  }
  const key = edId.trim().toLowerCase();
  return (
    departmentsById.get(key) ??
    departmentsById.get(`${key}-ed`) ??
    (key.endsWith("-ed") ? departmentsById.get(key.slice(0, -3)) : undefined)
  );
}

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
