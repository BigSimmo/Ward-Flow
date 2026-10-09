"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { delaysAliasBannerCopy, parseDelaysAliasFrom } from "@/components/ward-management/delays/delays-alias";
import { dayOf } from "@/components/ward-management/ward-clock";
import { ESCALATION_CONTACTS } from "@/components/ward-management/ward-change-reasons";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import type { Movement } from "@/components/ward-management/ward-model";
import { WardServiceScopeBar } from "@/components/ward-management/shell/ward-service-scope-bar";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import { useServiceScope } from "@/components/ward-management/shell/ward-service-store";
import {
  movementBelongsToService,
  noRecordedServiceMovementCount,
  urgentMovementsOutsideService,
} from "@/components/ward-management/ward-service-scope";
import { SEVERE_CAUSES, delayGroups } from "./delays-derivations";
import { DelaysBoard } from "./delays-board";
import styles from "./delays.module.css";

const ESCALATION_CONTACT = ESCALATION_CONTACTS[0];

export type SystemicHoldCategory = "all" | "emergency" | "ward" | "transport" | "staffing";

export interface SystemicDelayHold {
  id: string;
  category: "ward" | "transport" | "staffing";
  facility: string;
  service: string;
  categoryLabel: string;
  reason: string;
  impact: string;
  severity: "danger" | "warn" | "info";
  startedAgo: string;
  bedsOffline?: number;
  nextReview: string;
  owner: string;
}

/**
 * Systemic holds (ward closures, fleet delays, staffing surges) have no record in Ward Flow's state:
 * nothing can create, change or clear one. The four invented holds that stood here (real facility
 * names, made-up outbreaks and bed counts) were removed on 2026-09-25 under the owner's rule that
 * every figure must come from a record. Until a hold can be recorded, the panel says so.
 */
export const SYSTEMIC_HOLDS: SystemicDelayHold[] = [];

export interface DelaysScreenProps {
  aliasFrom?: "queue" | "exceptions" | "escalation" | null;
  movements?: Movement[];
}

function subscribeToLocation(listener: () => void) {
  window.addEventListener("popstate", listener);
  return () => window.removeEventListener("popstate", listener);
}
function readAliasFromLocation() {
  return parseDelaysAliasFrom(new URLSearchParams(window.location.search).get("from"));
}

/**
 * Delays: why each waiting person is still waiting. The layout is the approved Delays page mockup
 * (`delays-board.tsx`); this screen owns the data scope (chosen service), the old-bookmark banner,
 * the one write (Escalate to State bed coordination desk) and the page shell.
 */
export function DelaysScreen({ aliasFrom: aliasFromProp, movements: movementsOverride }: DelaysScreenProps = {}) {
  const fromSearch = useSyncExternalStore(subscribeToLocation, readAliasFromLocation, () => null);
  const aliasFrom = aliasFromProp !== undefined ? aliasFromProp : fromSearch;
  const [aliasBannerDismissed, setAliasBannerDismissed] = useState(false);
  const showAliasBanner = aliasFrom !== null && !aliasBannerDismissed;

  const { movements: liveMovements, units, configuration, dispatch } = useWardFlow();
  const service = useServiceScope();
  const now = useWardFlowClock();

  const allMovements = movementsOverride ?? liveMovements;
  const movements =
    service === null
      ? allMovements
      : allMovements.filter((movement: Movement) => movementBelongsToService(movement, service, units));

  // Prototype notices (owner rule D4).
  const [notice, setNotice] = useState<string | null>(null);
  // One timer for the latest notice, so an earlier one cannot clear a newer confirmation early.
  const noticeTimer = useRef<number | undefined>(undefined);
  const showNotice = (text: string) => {
    setNotice(text);
    window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(null), 4000);
  };
  useEffect(() => () => window.clearTimeout(noticeTimer.current), []);

  const open = movements.filter(isOpen);
  const openNetworkWide = allMovements.filter(isOpen);
  const groups = delayGroups(movements, units, now);

  // D-b: the escalation register is whole-network, so a row outside the chosen service is marked,
  // never dropped.
  const escalated = openNetworkWide.filter((movement) => movement.escalation !== undefined);
  // Q-12: "Attention" is never dropped. The severe causes across the whole network, plus any urgent
  // movement outside the chosen service, each marked rather than hidden.
  const networkGroups = delayGroups(allMovements, units, now);
  const severeRows = networkGroups
    .filter((group) => SEVERE_CAUSES.includes(group.cause))
    .flatMap((group) => group.movements.map((movement) => ({ movement, title: group.title as string | undefined })));
  const shownAttentionIds = new Set(severeRows.map((row) => row.movement.id));
  const extraAttention =
    service === null
      ? []
      : urgentMovementsOutsideService(openNetworkWide, service, units, now, configuration)
          .filter((movement) => !shownAttentionIds.has(movement.id))
          .map((movement) => ({
            movement,
            title: networkGroups.find((group) => group.movements.some((candidate) => candidate.id === movement.id))
              ?.title,
          }));
  const attention = [...severeRows, ...extraAttention];

  const closedToday = movements.filter(
    (movement) => movement.closure !== undefined && dayOf(movement.closure.at) === dayOf(now),
  );

  const isOutsideService = (movement: Movement): boolean =>
    service !== null && !movementBelongsToService(movement, service, units);

  const escalate = (movement: Movement) => {
    dispatch({
      type: "RECORD_ESCALATION",
      role: "coordinator",
      now,
      movementId: movement.id,
      triedUnitIds: movement.declines.map((decline) => decline.unitId),
      // The fixed escalation vocabulary's entry (ward-change-reasons.ts), as the coordinator picker records it.
      contact: ESCALATION_CONTACT,
    });
    showNotice(`Escalated to ${ESCALATION_CONTACT}.`);
  };

  const banner = (
    <>
      {showAliasBanner && aliasFrom ? (
        <aside
          className={styles.aliasBanner}
          role="status"
          data-testid="ward-delays-alias-banner"
          data-from={aliasFrom}
        >
          <p>{delaysAliasBannerCopy(aliasFrom)}</p>
          <button type="button" className={styles.aliasBannerDismiss} onClick={() => setAliasBannerDismissed(true)}>
            Dismiss
          </button>
        </aside>
      ) : null}
      {service === null ? null : (
        <WardServiceScopeBar
          service={service}
          shown={open.length}
          total={openNetworkWide.length}
          noun="movements"
          noRecordedServiceCount={noRecordedServiceMovementCount(allMovements, units)}
          urgentOutside={{
            count: urgentMovementsOutsideService(openNetworkWide, service, units, now, configuration).length,
          }}
        />
      )}
      {notice ? (
        <div className={styles.toastNotice} role="status" aria-live="polite">
          {notice}
        </div>
      ) : null}
    </>
  );

  return (
    <div className={styles.screen} data-ward-design="v6" data-ward-page="delays" data-testid="ward-delays-page">
      <main id="main-content" className={styles.main}>
        <DelaysBoard
          groups={groups}
          now={now}
          units={units}
          escalated={escalated}
          attention={attention}
          closedToday={closedToday}
          service={service}
          isOutsideService={isOutsideService}
          onEscalate={escalate}
          onNotWired={() => showNotice("Not wired in this prototype.")}
          banner={banner}
          empty={
            open.length === 0 ? (
              <p className={styles.absent} data-testid="ward-delays-nobody-waiting">
                {service === null
                  ? "Nobody is waiting in any emergency department right now. That is a measured count over every open movement."
                  : `Nobody is waiting in any emergency department in ${service} right now. That is a measured count over every open movement in ${service}.`}
              </p>
            ) : undefined
          }
        />
        <WardPrototypeFooter testId="ward-delays-governance" />
      </main>
    </div>
  );
}
