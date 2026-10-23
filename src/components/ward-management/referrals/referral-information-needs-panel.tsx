"use client";

import { useId, useState } from "react";

import { Button, DisabledReason, StatusGlyph } from "@/components/wf";

import { formatInstantWithDay, type Instant } from "../ward-clock";
import { useWardFlowClock, useWardFlowSelect } from "../ward-flow-provider";
import { wardPlaceLookup } from "../ward-access-places";
import { referralSentByDesk } from "../ward-referral-sender";
import { useEffectiveWardAccess } from "../shell/ward-access-store";
import { useWardRaise } from "../ward-flow-raise";
import type { Referral, ReferralInformationNeedEntry } from "../ward-model";
import { useRouteRole } from "../ward-role-gate";
import { rolesOnlyReason } from "../ward-role-permissions";
import { useWardFeatureFlag } from "../shell/ward-feature-flag-store";
import { referralDestinationLabel } from "../ward-referrals";
import {
  REFERRAL_INFORMATION_NEEDS,
  openInformationNeeds,
  referralInformationNeedLabel,
  type ReferralInformationNeed,
} from "./referral-information-needs";
import type { WardReferralInboxEntry } from "./referral-inbox";
import styles from "./referral-information-needs.module.css";

/**
 * Smart features ideas 3 and 4 (19 Oct 2026), the screen half: the ward's "opened" receipt, the
 * ward's "what we still need" picker, and the referrer's list to tick off. None of these answers a
 * referral, and the decision clock keeps running throughout. Screens load this file through
 * `referral-information-needs-lazy.tsx`, so a page where nobody asks for anything skips its code.
 */

function NeedList({ needs, now }: { needs: readonly ReferralInformationNeedEntry[]; now: Instant }) {
  return (
    <ul className={styles.list}>
      {needs.map((entry) => (
        <li key={`${entry.need}-${entry.at}`}>
          <StatusGlyph tone="warning" size={8} /> {referralInformationNeedLabel(entry.need)}
          <span className={styles.when}> · asked {formatInstantWithDay(entry.at, now)}</span>
        </li>
      ))}
    </ul>
  );
}

/** The ward's own picker: ask the referrer for listed items before deciding. */
export function WardInformationNeedsPicker({
  entry,
  unitId,
  actingUnitId,
  refusal,
}: {
  entry: WardReferralInboxEntry;
  unitId: string;
  actingUnitId: string | undefined;
  /** Why this route may not ask, if it may not (the inbox's own role check). */
  refusal: string | undefined;
}) {
  const enabled = useWardFeatureFlag("referral-information-needs");
  const now = useWardFlowClock();
  const routeRole = useRouteRole();
  const raise = useWardRaise(routeRole);
  const [chosen, setChosen] = useState<ReadonlySet<ReferralInformationNeed>>(() => new Set());
  const groupId = useId();
  if (!enabled) return null;
  const waiting = openInformationNeeds(entry.informationNeeds);
  const waitingIds = new Set(waiting.map((need) => need.need));
  const askable = REFERRAL_INFORMATION_NEEDS.filter((need) => !waitingIds.has(need.id));
  const askRefusal = refusal ?? (chosen.size === 0 ? "Choose at least one item" : undefined);
  return (
    <div className={styles.panel} data-testid={`ward-referral-needs-${entry.id}`}>
      {waiting.length > 0 ? (
        <>
          <p className={styles.heading}>Waiting on the referrer</p>
          <NeedList needs={waiting} now={now} />
        </>
      ) : null}
      {askable.length > 0 ? (
        <fieldset className={styles.picker}>
          <legend className={styles.heading}>Need before we can decide</legend>
          {askable.map((need) => (
            <label key={need.id} className={styles.option}>
              <input
                type="checkbox"
                checked={chosen.has(need.id)}
                onChange={(event) =>
                  setChosen((current) => {
                    const next = new Set(current);
                    if (event.target.checked) next.add(need.id);
                    else next.delete(need.id);
                    return next;
                  })
                }
              />
              {need.label}
            </label>
          ))}
          <Button
            size="sm"
            variant="sec"
            aria-disabled={askRefusal !== undefined ? "true" : undefined}
            aria-describedby={askRefusal ? `${groupId}-why` : undefined}
            onClick={() => {
              if (askRefusal) return;
              raise("REQUEST_REFERRAL_INFORMATION", {
                referralId: entry.id,
                unitId,
                ...(routeRole === "ward" && actingUnitId !== undefined ? { actingUnitId } : {}),
                needs: [...chosen],
              });
              setChosen(new Set());
            }}
            data-testid={`ward-referral-needs-ask-${entry.id}`}
          >
            Ask the referrer
          </Button>
          {askRefusal ? <DisabledReason id={`${groupId}-why`}>{askRefusal}</DisabledReason> : null}
          <p className={styles.note}>Asking does not answer the referral. The decision time keeps running.</p>
        </fieldset>
      ) : null}
    </div>
  );
}

const TICK_OFF_ROLES = ["ed", "community", "ward", "coordinator"] as const;

/** A route desk sends only its own kind of referral, so a ward never ticks off one it is answering. */
function routeSentKind(routeRole: string, source: Referral["source"]): boolean {
  if (routeRole === "ward") return source === "psychiatric_ward";
  if (routeRole === "ed") return source === "ed_medical";
  if (routeRole === "community") return source !== "psychiatric_ward" && source !== "ed_medical";
  return true;
}

/** The referrer's side: what each ward is still waiting on, ticked off one item at a time. */
export function ReferralInformationNeedsPanel({ referral, now }: { referral: Referral; now: Instant }) {
  const arms = referral.destinations.flatMap((arm) => {
    // Once the ward has answered, or the referrer has withdrawn, its asks are closed (the reducer agrees).
    const waiting =
      arm.state === "queued" && arm.withdrawnAt === undefined ? openInformationNeeds(arm.informationNeeds) : [];
    return arm.destination.kind === "psychiatric_ward" && arm.destination.unitId && waiting.length > 0
      ? [{ unitId: arm.destination.unitId, where: referralDestinationLabel(arm.destination), waiting }]
      : [];
  });
  // Nothing asked: render nothing, and read no workspace state (the timeline also renders alone).
  return arms.length === 0 ? null : <NeedsToTickOff referral={referral} arms={arms} now={now} />;
}

function NeedsToTickOff({
  referral,
  arms,
  now,
}: {
  referral: Referral;
  arms: { unitId: string; where: string; waiting: ReferralInformationNeedEntry[] }[];
  now: Instant;
}) {
  const referralId = referral.id;
  const routeRole = useRouteRole();
  const raise = useWardRaise(routeRole);
  const reasonId = useId();
  const access = useEffectiveWardAccess();
  const { units } = useWardFlowSelect("units");
  // D-80: the sender ticks off, never the ward answering it, which shares the referral's view.
  const sent =
    routeSentKind(routeRole, referral.source) && referralSentByDesk(referral, access, wardPlaceLookup(units));
  const refusal = !(TICK_OFF_ROLES as readonly string[]).includes(routeRole)
    ? rolesOnlyReason([...TICK_OFF_ROLES])
    : sent
      ? undefined
      : "Only the desk that sent this referral can mark these provided.";
  return (
    <section className={styles.panel} aria-label="What the ward still needs" data-testid="ward-referral-needs-panel">
      {arms.map((arm) => (
        <div key={arm.unitId}>
          <p className={styles.heading}>Waiting on you for {arm.where}</p>
          <ul className={styles.list}>
            {arm.waiting.map((entry) => (
              <li key={`${entry.need}-${entry.at}`} className={styles.row}>
                <span>
                  <StatusGlyph tone="warning" size={8} /> {referralInformationNeedLabel(entry.need)}
                  <span className={styles.when}> · asked {formatInstantWithDay(entry.at, now)}</span>
                </span>
                <Button
                  size="sm"
                  variant="sec"
                  aria-disabled={refusal !== undefined ? "true" : undefined}
                  aria-describedby={refusal ? reasonId : undefined}
                  aria-label={`Mark ${referralInformationNeedLabel(entry.need)} as provided`}
                  onClick={() => {
                    if (refusal) return;
                    raise("MARK_REFERRAL_INFORMATION_MET", {
                      referralId,
                      wardUnitId: arm.unitId,
                      need: entry.need,
                    });
                  }}
                >
                  Provided
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {refusal ? <DisabledReason id={reasonId}>{refusal}</DisabledReason> : null}
    </section>
  );
}
