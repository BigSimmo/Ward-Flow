import * as z from "zod/mini";

import { WARD_FLOW_ROLE_LABELS } from "./ward-flow-roles";
import type { PilotControlState } from "./ward-flow-pilot-control-events";
import { SITE_SWITCHABLE_FEATURES } from "./ward-site-feature-switches";

const id = z.string().check(z.minLength(1));
const at = z.number().check(z.refine(Number.isFinite));
const role = z.enum(Object.keys(WARD_FLOW_ROLE_LABELS) as [string, ...string[]]);
/** A site switch may also name the access admin (D-142). */
const switchBy = z.enum(["admin", ...Object.keys(WARD_FLOW_ROLE_LABELS)] as [string, ...string[]]);

/**
 * Stored Batch 4 records (10 Nov 2026), each absent in older saves. Strict objects, so a row carrying
 * any other field (typed text or pack content included) is refused on restore.
 */
export const pilotControlStoredFields = {
  siteFeatureSwitches: z.optional(
    z
      .array(z.strictObject({ siteCode: id, feature: z.enum(SITE_SWITCHABLE_FEATURES), at, by: switchBy }))
      .check(z.refine((rows) => new Set(rows.map((row) => `${row.siteCode}|${row.feature}`)).size === rows.length)),
  ),
  downtimePackPrints: z.optional(z.array(z.strictObject({ unitId: id, at, by: role }))),
  outageWindows: z.optional(
    z
      .array(
        z
          .strictObject({ id, from: at, to: at, recordedAt: at, by: role })
          .check(z.refine((row) => row.from < row.to && row.to <= row.recordedAt)),
      )
      .check(z.refine((rows) => new Set(rows.map((row) => row.id)).size === rows.length)),
  ),
};

/** Cross-row check: every switch names a site with wards and every print a ward in this world. */
export function pilotControlRowsBelong(
  state: PilotControlState,
  units: readonly { id: string; siteCode: string }[],
): boolean {
  const unitIds = new Set(units.map((unit) => unit.id));
  const siteCodes = new Set(units.map((unit) => unit.siteCode));
  return (
    (state.siteFeatureSwitches ?? []).every((row) => siteCodes.has(row.siteCode)) &&
    (state.downtimePackPrints ?? []).every((row) => unitIds.has(row.unitId))
  );
}
