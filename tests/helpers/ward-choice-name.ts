import { siteByCode, unitById } from "@/components/ward-management/ward-sites";

import { escapeForRegExp } from "./ward-place-names";

/** WT-27: a ward row shows the ward's name and hospital, never its internal id, so find it by those. */
export function wardChoiceName(unitId: string) {
  const unit = unitById(unitId);
  if (!unit) throw new Error(`No synthetic ward ${unitId}`);
  const hospital = siteByCode(unit.siteCode)?.name ?? unit.siteCode;
  // The row reads "<ward> <hospital>" first, then its status runs straight on, so anchor only the start.
  return new RegExp(`^${escapeForRegExp(`${unit.name} ${hospital}`)}`, "u");
}
