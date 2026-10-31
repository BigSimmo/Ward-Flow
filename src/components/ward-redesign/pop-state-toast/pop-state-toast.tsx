"use client";

import { useMemo, type ReactNode } from "react";

import { acceptedReferralsAwaitingPull } from "@/components/ward-management/referrals/accepted-ward-referral";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";
import { usePatientNameDisplay } from "@/components/ward-management/settings/discreet-names";

import { NoticeStack, type MockNotice } from "../notices/notice-stack";

/**
 * The Toast mock-up: Home a moment after a run of saves, with the notice stack draft PR #1124 builds
 * (copied into notices/, so the real wf toast is untouched). Nothing is saved: the bed is not pulled.
 *
 * Final round (D-91): a realistic stack, oldest first as the provider holds them:
 * - two earlier self-closing saves, folded behind the newest under "+2 more";
 * - a warning (a step that did not go through), which keeps its own row and stays until closed;
 * - the newest save, today's Pull the bed toast for the first accepted referral on Home still waiting
 *   for its bed, naming the person surname first (D-83): "Bed pulled at <ward> for <surname, given>".
 * In the app the saves close themselves after a few seconds; here every notice stays for review.
 * On a phone the stack rests clear of the dock and its +.
 */
export function PopStateToast({ page }: { page: ReactNode }) {
  const { referrals, units, movements } = useWardFlowSelect("referrals", "units", "movements");
  const first = useMemo(
    () => acceptedReferralsAwaitingPull(referrals, units, movements)[0],
    [referrals, units, movements],
  );
  const unitName = first?.unitName;
  // The newest save names who the bed was pulled for, through the same name display Pull the bed
  // uses (so discreet names still apply).
  const patientOf = usePatientOf();
  const nameFor = usePatientNameDisplay();
  const who = first ? patientOf(first.referral) : undefined;
  const name = who ? nameFor(who.formalName, who.umrn) : undefined;

  const notices = useMemo<MockNotice[]>(
    () => [
      // Synthetic earlier outcomes from this visit, worded as the app's own saves are.
      {
        id: "earlier-note",
        tone: "success",
        title: `Note added for ${nameFor("Wren, Tobias", "UM100023")}`,
        autoDismiss: true,
      },
      {
        id: "refused-pull",
        tone: "warning",
        title: `Bed not pulled for ${nameFor("Cadwaller, Rhys", "UM100046")}`,
        body: "A bed is still pulled at BTY Adult Secure. Release it first.",
      },
      {
        id: "earlier-handover",
        tone: "success",
        title: "Handover note saved for the night shift",
        autoDismiss: true,
      },
      {
        id: "pulled",
        tone: "success",
        title: unitName
          ? name
            ? `Bed pulled at ${unitName} for ${name}`
            : `Bed pulled at ${unitName}`
          : "Bed pulled at Bunbury Acute Psychiatric Unit",
        autoDismiss: true,
      },
    ],
    [nameFor, unitName, name],
  );

  return (
    <>
      {page}
      {/* Keyed on the newest words, so the stack starts again if the world's names change. */}
      <NoticeStack key={notices.at(-1)?.title} notices={notices} />
    </>
  );
}
