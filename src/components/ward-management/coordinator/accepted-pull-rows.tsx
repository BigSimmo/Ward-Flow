"use client";

// WS-02 (workflow speed audit, 26 Oct 2026): after a ward accepts, the pull was found only through
// Referrals, History and the row. It sits in Act now with its own Pull the bed, on Home and, since
// the Alerts redesign (Q111, Josh 1 Nov 2026), on Alerts too, so the two pages agree.

import { useCallback, useRef, useState } from "react";
import { ORIGIN_NOT_RECORDED } from "@/components/ward-management/ward-model";
import dynamic from "next/dynamic";
import { withLoadRetry } from "@/components/ward-management/load-retry";

import { minutesText } from "@/components/ward-management/alerts/alerts-model";
import alertStyles from "@/components/ward-management/alerts/alerts.module.css";
import type { AcceptedAwaitingPull } from "@/components/ward-management/referrals/accepted-ward-referral";
import { withSendingTeam } from "@/components/ward-management/referrals/referral-sending-team";
import { usePatientNameDisplay } from "@/components/ward-management/settings/discreet-names";
import type { Instant } from "@/components/ward-management/ward-clock";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";
import { Button, Sheet } from "@/components/wf";
import { ACT_NOW_TARGET_ID } from "@/components/ward-management/shell/ward-skip-to-act-now";

import { HomeRow, PhoneRow } from "./home-rows";
import styles from "./home-list.module.css";

// WS-03: the one-step pull loads only when a coordinator opens it.
const PullAcceptedReferral = dynamic(
  withLoadRetry(() => import("../referrals/pull-accepted-referral").then((m) => m.PullAcceptedReferral)),
  { loading: () => null },
);

/** When the ward accepted: the accepted arm's recorded decision time, when there is one. */
function acceptedDecisionAt({ referral, unitId }: AcceptedAwaitingPull): Instant | undefined {
  return referral.destinations.find(
    (arm) =>
      arm.state === "accepted" &&
      arm.destination.kind === "psychiatric_ward" &&
      (arm.acceptedUnitId ?? arm.destination.unitId) === unitId,
  )?.decidedAt;
}

/**
 * The Pull the bed sheet's state. The page holds it, not the rows, so the sheet stays open after
 * "Start the journey without the bed": that removes the last row, and the sheet must still show its
 * message and Open the journey link (Alerts #1230 bug).
 */
export function useAcceptedPull() {
  const [pulling, setPullingState] = useState<AcceptedAwaitingPull | undefined>();
  // F-57 (A9-28): where the sheet was opened from, so focus has somewhere to go once the row has gone.
  const opener = useRef<PullOpener | null>(null);
  const setPulling = useCallback((entry: AcceptedAwaitingPull) => {
    opener.current = pullOpenerFor(entry);
    setPullingState(entry);
  }, []);
  const resolveReturnFocusTarget = useCallback(() => focusTargetAfterPull(opener.current), []);
  const sheet = pulling ? (
    <Sheet
      open
      onClose={() => setPullingState(undefined)}
      title="Pull the bed"
      description="Anything already recorded is filled in. Check the details, then pull the bed."
      testId="home-pull-accepted-sheet"
      resolveReturnFocusTarget={resolveReturnFocusTarget}
    >
      <PullAcceptedReferral
        item={pulling}
        onDone={() => {
          setPullingState(undefined);
          // The pulled row leaves Act now, so the opener has gone. Once the sheet has closed, focus that
          // fell to the page goes to the row now in its place, or else the list itself.
          window.requestAnimationFrame(() => {
            const active = document.activeElement;
            if (active !== null && active !== document.body && active.isConnected) return;
            focusTargetAfterPull(opener.current)?.focus({ preventScroll: true });
          });
        }}
      />
    </Sheet>
  ) : null;
  return { pulling, setPulling, sheet };
}

/** The row a pull was opened from: its own button, its list region and its place in that list. */
type PullOpener = { button: HTMLElement | null; region: HTMLElement | null; index: number };

const PULL_ROW = "li[data-pull-unit-id]";

function pullOpenerFor(entry: AcceptedAwaitingPull): PullOpener {
  if (typeof document === "undefined") return { button: null, region: null, index: 0 };
  const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const row =
    active?.closest<HTMLElement>(PULL_ROW) ??
    Array.from(document.querySelectorAll<HTMLElement>(PULL_ROW)).find(
      (li) => li.dataset.referralId === entry.referral.id && li.dataset.pullUnitId === entry.unitId,
    ) ??
    null;
  const region = row?.closest<HTMLElement>("section") ?? null;
  const index = region && row ? regionRows(region).indexOf(row) : 0;
  return { button: active && row?.contains(active) ? active : null, region, index: Math.max(0, index) };
}

function regionRows(region: HTMLElement): HTMLElement[] {
  return Array.from(region.querySelectorAll<HTMLElement>("ul > li"));
}

/**
 * F-57 (A9-28, D-191 item 3): after a pull the row that opened the sheet has gone. Focus goes to
 * the row now in its place in the same list (its action, else its first control), else to the list
 * region itself (Home's Act now), never the page start. Closing without a pull keeps the opener.
 */
function focusTargetAfterPull(opener: PullOpener | null): HTMLElement | null {
  if (!opener || typeof document === "undefined") return null;
  if (opener.button?.isConnected) return opener.button;
  const region = opener.region?.isConnected ? opener.region : document.getElementById(ACT_NOW_TARGET_ID);
  if (!region) return null;
  const rows = regionRows(region);
  const row = rows[Math.min(opener.index, rows.length - 1)];
  const control =
    row?.querySelector<HTMLElement>("[data-placement-action]") ?? row?.querySelector<HTMLElement>("button, a[href]");
  if (control) return control;
  // A region takes focus only for this hand-over, so it never joins the tab order.
  if (!region.hasAttribute("tabindex")) {
    region.setAttribute("tabindex", "-1");
    region.addEventListener("blur", () => region.removeAttribute("tabindex"), { once: true });
  }
  return region;
}

/** The "Accepted, bed not pulled" rows. The page renders the sheet from useAcceptedPull. */
export function AcceptedPullRows({
  toPull,
  now,
  phone,
  testId,
  pulling,
  setPulling,
}: {
  toPull: readonly AcceptedAwaitingPull[];
  now: Instant;
  phone: boolean;
  testId: string;
  pulling: AcceptedAwaitingPull | undefined;
  setPulling: (entry: AcceptedAwaitingPull) => void;
}) {
  const patientOf = usePatientOf();
  const nameFor = usePatientNameDisplay();
  return (
    <ul className={phone ? alertStyles.phoneRows : styles.hrows} data-testid={testId}>
      {toPull.map((entry) => {
        const { referral } = entry;
        const who = patientOf(referral);
        const name = nameFor(who.formalName, who.umrn);
        const decidedAt = acceptedDecisionAt(entry);
        const age = decidedAt === undefined ? undefined : minutesText(Math.max(0, now - decidedAt));
        const shared = {
          data: { "data-referral-id": referral.id, "data-pull-unit-id": entry.unitId },
          tone: "danger" as const,
          act: true,
          selected: pulling?.referral.id === referral.id,
          title: "Accepted, bed not pulled",
          openLabel: `Pull the bed for ${name} at ${entry.unitName}`,
          onOpen: () => setPulling(entry),
          name,
          umrn: who.umrn,
        };
        const from = withSendingTeam(`from ${referral.originSiteCode ?? ORIGIN_NOT_RECORDED}`, referral);
        return phone ? (
          <PhoneRow
            key={referral.id}
            {...shared}
            line={`${entry.unitName} accepted · ${from}`}
            age={age}
            owner={undefined}
            action={
              <Button
                size="sm"
                data-placement-action
                aria-label={`Pull bed for ${name} at ${entry.unitName}`}
                onClick={() => setPulling(entry)}
              >
                Pull bed
              </Button>
            }
          />
        ) : (
          <HomeRow
            key={referral.id}
            {...shared}
            where={`${entry.unitName} accepted, ${from}`}
            age={age}
            ageNote={decidedAt === undefined ? "Time not recorded" : "since accepted"}
            action={
              <Button size="sm" data-placement-action aria-label={shared.openLabel} onClick={() => setPulling(entry)}>
                Pull the bed
              </Button>
            }
          />
        );
      })}
    </ul>
  );
}
