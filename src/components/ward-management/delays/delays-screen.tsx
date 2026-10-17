"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";

import { delaysAliasBannerCopy, parseDelaysAliasFrom } from "@/components/ward-management/delays/delays-alias";
import { dayOf } from "@/components/ward-management/ward-clock";
import { ESCALATION_CONTACTS } from "@/components/ward-management/ward-change-reasons";
import { isOpen } from "@/components/ward-management/ward-derivations";
import {
  useDueSoonThresholds,
  useWardFlowClock,
  useWardFlowSelect,
} from "@/components/ward-management/ward-flow-provider";
import { useWardRaise } from "@/components/ward-management/ward-flow-raise";
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

export interface DelaysScreenProps {
  aliasFrom?: "queue" | "exceptions" | "escalation" | null;
  movements?: Movement[];
}

const LOCATION_CHANGE_EVENT = "ward-flow:locationchange";
const HISTORY_PATCHED_KEY = "__wardFlowLocationPatched";

function ensureLocationHistoryPatched() {
  if (typeof window === "undefined") return;
  const win = window as Window & { [HISTORY_PATCHED_KEY]?: boolean };
  if (win[HISTORY_PATCHED_KEY]) return;
  win[HISTORY_PATCHED_KEY] = true;
  const origPushState = window.history.pushState.bind(window.history);
  const origReplaceState = window.history.replaceState.bind(window.history);
  window.history.pushState = function patchedPushState(...args) {
    origPushState(...args);
    queueMicrotask(() => window.dispatchEvent(new Event(LOCATION_CHANGE_EVENT)));
  };
  window.history.replaceState = function patchedReplaceState(...args) {
    origReplaceState(...args);
    queueMicrotask(() => window.dispatchEvent(new Event(LOCATION_CHANGE_EVENT)));
  };
}

function subscribeToLocation(listener: () => void) {
  ensureLocationHistoryPatched();
  window.addEventListener("popstate", listener);
  window.addEventListener(LOCATION_CHANGE_EVENT, listener);
  return () => {
    window.removeEventListener("popstate", listener);
    window.removeEventListener(LOCATION_CHANGE_EVENT, listener);
  };
}
/** shell-9: `?show=severe` from the Menu's Delays row. */
function readSevereFromLocation() {
  return new URLSearchParams(window.location.search).get("show") === "severe";
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
  const [, startTransition] = useTransition();
  const thresholds = useDueSoonThresholds();
  const fromSearch = useSyncExternalStore(subscribeToLocation, readAliasFromLocation, () => null);
  const aliasFrom = aliasFromProp !== undefined ? aliasFromProp : fromSearch;
  const showSevere = useSyncExternalStore(subscribeToLocation, readSevereFromLocation, () => false);
  const [aliasBannerDismissed, setAliasBannerDismissed] = useState(false);
  const showAliasBanner = aliasFrom !== null && !aliasBannerDismissed;

  const { movements: liveMovements, units, configuration } = useWardFlowSelect("movements", "units", "configuration");
  const service = useServiceScope();
  const now = useWardFlowClock();
  const raise = useWardRaise("coordinator");

  const allMovements = movementsOverride ?? liveMovements;
  const movements = useMemo(
    () =>
      service === null
        ? allMovements
        : allMovements.filter((movement: Movement) => movementBelongsToService(movement, service, units)),
    [allMovements, service, units],
  );

  // Prototype notices (owner rule D4).
  const [notice, setNotice] = useState<string | null>(null);
  // One timer for the latest notice, so an earlier one cannot clear a newer confirmation early.
  const noticeTimer = useRef<number | undefined>(undefined);
  const showNotice = (text: string) => {
    setNotice(text);
    window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => {
      setNotice(null);
    }, 4000);
  };
  useEffect(
    () => () => {
      window.clearTimeout(noticeTimer.current);
    },
    [],
  );

  const open = useMemo(() => movements.filter(isOpen), [movements]);
  const openNetworkWide = useMemo(
    () => (movements === allMovements ? open : allMovements.filter(isOpen)),
    [movements, allMovements, open],
  );
  const groups = useMemo(() => delayGroups(movements, units, now, thresholds), [movements, units, now, thresholds]);

  // D-b: the escalation register is whole-network, so a row outside the chosen service is marked,
  // never dropped.
  const escalated = useMemo(
    () => openNetworkWide.filter((movement) => movement.escalation !== undefined),
    [openNetworkWide],
  );
  // Q-12: "Attention" is never dropped. The severe causes across the whole network, plus any urgent
  // movement outside the chosen service, each marked rather than hidden.
  const networkGroups = useMemo(
    () => (movements === allMovements ? groups : delayGroups(allMovements, units, now, thresholds)),
    [movements, allMovements, groups, units, now, thresholds],
  );
  const urgentOutsideMovements = useMemo(
    () => (service === null ? [] : urgentMovementsOutsideService(openNetworkWide, service, units, now, configuration)),
    [openNetworkWide, service, units, now, configuration],
  );
  const attention = useMemo(() => {
    const severeRows = networkGroups
      .filter((group) => SEVERE_CAUSES.includes(group.cause))
      .flatMap((group) => group.movements.map((movement) => ({ movement, title: group.title as string | undefined })));
    const shownAttentionIds = new Set(severeRows.map((row) => row.movement.id));
    const extraAttention =
      service === null
        ? []
        : urgentOutsideMovements
            .filter((movement) => !shownAttentionIds.has(movement.id))
            .map((movement) => ({
              movement,
              title: networkGroups.find((group) => group.movements.some((candidate) => candidate.id === movement.id))
                ?.title,
            }));
    return [...severeRows, ...extraAttention];
  }, [networkGroups, service, urgentOutsideMovements]);

  const closedToday = useMemo(
    () => movements.filter((movement) => movement.closure !== undefined && dayOf(movement.closure.at) === dayOf(now)),
    [movements, now],
  );

  const noRecordedServiceCount = useMemo(
    () => (service === null ? 0 : noRecordedServiceMovementCount(allMovements, units)),
    [service, allMovements, units],
  );

  const isOutsideService = (movement: Movement): boolean =>
    service !== null && !movementBelongsToService(movement, service, units);

  const escalate = (movement: Movement) => {
    raise("RECORD_ESCALATION", {
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
          <button
            type="button"
            className={styles.aliasBannerDismiss}
            onClick={() => {
              startTransition(() => {
                setAliasBannerDismissed(true);
              });
            }}
          >
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
          noRecordedServiceCount={noRecordedServiceCount}
          urgentOutside={{
            count: urgentOutsideMovements.length,
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
          onNotWired={() => {
            showNotice("Not wired in this prototype.");
          }}
          banner={banner}
          initialSevere={showSevere}
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
