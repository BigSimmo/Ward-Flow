"use client";

import { useEffect, useMemo, type ReactNode } from "react";

import { acceptedReferralsAwaitingPull } from "@/components/ward-management/referrals/accepted-ward-referral";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { useOptionalToast } from "@/components/wf";

/**
 * The Toast mock-up: Home just after a save, with the toast the app shows. It is today's toast from
 * Pull the bed (referrals/pull-accepted-referral.tsx), "Bed pulled at <ward>", for the first accepted
 * referral on Home still waiting for its bed, pushed through the app's own ToastProvider so its
 * place, look and live announcement are the real ones. Nothing is saved: the bed is not pulled.
 * In the app the toast closes itself after 6 seconds; here it stays until closed, for review.
 */
export function PopStateToast({ page }: { page: ReactNode }) {
  const toast = useOptionalToast();
  const { referrals, units, movements } = useWardFlowSelect("referrals", "units", "movements");
  const unitName = useMemo(
    () => acceptedReferralsAwaitingPull(referrals, units, movements)[0]?.unitName,
    [referrals, units, movements],
  );

  useEffect(() => {
    if (!toast || !unitName) return;
    const id = toast.push({ tone: "success", title: `Bed pulled at ${unitName}`, duration: 0 });
    return () => toast.dismiss(id);
  }, [toast, unitName]);

  return <>{page}</>;
}
