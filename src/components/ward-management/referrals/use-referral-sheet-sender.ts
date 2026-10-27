import { useMemo } from "react";
import { useRoleGate, useRouteRole, type RoleGate } from "@/components/ward-management/ward-role-gate";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { ATS_CATEGORIES, type Unit } from "@/components/ward-management/ward-model";
import { wardRouteUnitId } from "@/components/ward-management/ward-chrome-role";
import { recordIdFromParam } from "@/components/ward-management/shell/ward-record-address";
import type { WardReferralDrawerContentProps } from "./ward-referral-drawer-model";

/** Why a ward page that names no real ward cannot send: the referral must come from a ward. */
export const NO_SENDING_WARD = "Open New referral from your ward's page, so it is sent in that ward's name.";

/**
 * Who the sheet sends as. On a ward page the referral comes from that ward, as source
 * psychiatric_ward. Off a ward page (the full referral form, for one), a ward desk with role access
 * on sends from its own ward when it holds exactly one. A ward page that names no real ward, or a
 * desk covering several wards off their pages, cannot send, and says why (the rail shows the
 * reason beside Confirm and send).
 */
export function useSheetSender(
  gate: ReturnType<typeof useRoleGate>,
  units: readonly Unit[],
  pathname: string,
  baseId: string,
): { sendGate: RoleGate; sendingWard: Unit | undefined; senderMissing: boolean } {
  const routeRole = useRouteRole();
  const access = useEffectiveWardAccess();
  const roleSendGate = gate("RECEIVE_REFERRAL");
  const deskUnitIds = access.scope.kind === "ward" ? access.scope.unitIds : [];
  const sendingUnitId = wardRouteUnitId(pathname) ?? (deskUnitIds.length === 1 ? deskUnitIds[0] : undefined);
  const sendingWard = routeRole === "ward" ? units.find((unit) => unit.id === sendingUnitId) : undefined;
  if (routeRole !== "ward" || sendingWard) return { sendGate: roleSendGate, sendingWard, senderMissing: false };
  const id = `${baseId}-no-sending-ward`;
  return {
    sendGate: {
      allowed: false,
      reason: NO_SENDING_WARD,
      buttonProps: { disabled: true, "aria-describedby": id },
      note: null,
    },
    sendingWard,
    senderMissing: true,
  };
}

/**
 * What a shared link prefills: the record, site, service, ATS, legal status, complaint and source
 * in the URL. A link for another person than the opener named, or any link when the opener already
 * prefills, is ignored.
 */
export function useReferralUrlPrefill({
  initialOriginSiteCode,
  initialPatientId,
  initialSendingTeam,
  initialUnitIds,
}: Pick<
  WardReferralDrawerContentProps,
  "initialOriginSiteCode" | "initialPatientId" | "initialSendingTeam" | "initialUnitIds"
>) {
  return useMemo(() => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    const personId = recordIdFromParam(params.get("patientId")?.trim()) ?? undefined;
    if (initialPatientId && personId && initialPatientId !== personId) return null;
    if (!personId && (initialPatientId || initialOriginSiteCode || initialSendingTeam || initialUnitIds?.length)) {
      return null;
    }
    const site = params.get("site")?.trim() || undefined;
    const service = params.get("service")?.trim() || undefined;
    const atsRaw = Number(params.get("ats"));
    const ats = ATS_CATEGORIES.find((value) => value === atsRaw);
    const legal = params.get("legal")?.trim() || undefined;
    const complaint = params.get("complaint")?.trim() || undefined;
    const source = params.get("source")?.trim() === "ed" ? ("ed" as const) : undefined;
    if (!personId && !site && !service && !ats && !legal && !complaint) return null;
    return { personId, site, service, ats, legal, complaint, source };
  }, [initialOriginSiteCode, initialPatientId, initialSendingTeam, initialUnitIds]);
}
