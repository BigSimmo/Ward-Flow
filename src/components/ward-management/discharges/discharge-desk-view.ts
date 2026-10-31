import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { siteByCode } from "@/components/ward-management/ward-sites";
import type { Unit } from "@/components/ward-management/ward-model";

/**
 * Which desk is reading Discharges, for the role branches in the one board (approved 31 Oct 2026).
 *
 * - `wardDesk`: the nurse in charge. The board holds only this desk's own wards, so the Service filter
 *   (one choice) is left out, and with one ward also the Ward filter and the ward line under each person.
 * - `ownWard`: that one ward, when the ward desk holds exactly one. Its name replaces "all services".
 * - `siteName`: the site bed manager's site (D-80). One site is one service, so the Service filter and
 *   the service after each ward are left out; the hero names the site.
 *
 * The coordinator (and every other desk) gets none of these, so the board reads as it always has.
 */
export type DischargeDeskView = {
  wardDesk: boolean;
  ownWard: Unit | undefined;
  siteName: string | undefined;
};

export function useDischargeDeskView(units: readonly Unit[]): DischargeDeskView {
  const access = useEffectiveWardAccess();
  const wardDesk = access.role === "ward";
  const ownWardIds = wardDesk && access.scope.kind === "ward" ? access.scope.unitIds : [];
  const ownWard = ownWardIds.length === 1 ? units.find((unit) => unit.id === ownWardIds[0]) : undefined;
  const siteName =
    access.role === "bed_manager" && access.scope.kind === "site"
      ? (siteByCode(access.scope.siteCode)?.name ?? access.scope.siteCode)
      : undefined;
  return { wardDesk, ownWard, siteName };
}
