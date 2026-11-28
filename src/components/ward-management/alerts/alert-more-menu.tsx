"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AlarmClock, ArrowUpRight, Check, Ellipsis, Siren } from "lucide-react";

import { Button, Dialog, Menu, StatusGlyph, useOptionalToast, type MenuItem } from "@/components/wf";
import { SnoozePicker } from "@/components/ward-management/inbox-snooze-control";
import { wardChromeRole } from "@/components/ward-management/ward-chrome-role";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import type { InboxItem } from "@/components/ward-management/ward-derivations";
import type { InboxSnoozeReason } from "@/components/ward-management/ward-inbox-snooze";
import type { Movement, Rejection } from "@/components/ward-management/ward-model";
import {
  useOptionalWardFlowSelect,
  useWardFlowClock,
  useWardFlowSelect,
} from "@/components/ward-management/ward-flow-provider";
import { isAlertLive } from "./global-alert-view";
import { useSendPullNow } from "./global-alert-panels";
import { broadcastKind, isPullNowOverdue, pullNowOffered } from "./ward-broadcast-model";
import styles from "./alerts.module.css";

type MoreMenuProps = {
  item: InboxItem;
  movement: Movement | undefined;
  subjectLine: string;
  displayName: string;
  now: Instant;
  /** The one reason every act is unavailable (a role limit); shown beside each item. */
  actionDisabledReason?: string;
  seen: boolean;
  snoozed: boolean;
  actNow: boolean;
  escalationApplies: boolean;
  isEscalated: boolean;
  onAcknowledge: () => void;
  onReturn: () => void;
  onSnooze: (until: Instant, reason: InboxSnoozeReason) => void;
  onEscalate: () => void;
};

/**
 * Acknowledge, Snooze, Escalate and Pull now: the less common acts on an alert, behind the kit More
 * menu in the drawer foot beside Take and Patient page (audit two, #1). A refused act keeps its
 * reason on the item, on a second line under its name.
 */
export function AlertMoreMenu(props: MoreMenuProps) {
  return (
    <WithPullNowItem movement={props.movement}>
      {(pull) => <MoreMenu {...props} pull={props.actionDisabledReason ? undefined : pull} />}
    </WithPullNowItem>
  );
}

/**
 * Builds the Pull now menu item for a movement (Alerts drawer and the phone movement sheet, audit two
 * #1 and #33). It sends the same RAISE_PULL_NOW as the Pull now button; the engine's refusal shows as a
 * toast, since the menu has closed by then. Outside the provider (isolated tests, previews) there is no item.
 */
export function WithPullNowItem({
  movement,
  children,
}: {
  movement: Movement | undefined;
  children: (pull: MenuItem | undefined) => ReactNode;
}) {
  return useOptionalWardFlowSelect() && movement ? (
    <PullNowItemBuilder movement={movement}>{children}</PullNowItemBuilder>
  ) : (
    <>{children(undefined)}</>
  );
}

function PullNowItemBuilder({
  movement,
  children,
}: {
  movement: Movement;
  children: (pull: MenuItem | undefined) => ReactNode;
}) {
  const { broadcastAlerts, movements, rejections, units } = useWardFlowSelect(
    "broadcastAlerts",
    "movements",
    "rejections",
    "units",
  );
  const sendPullNow = useSendPullNow(movement);
  const now = useWardFlowClock();
  const toast = useOptionalToast();
  // Where the rejection list stood when Pull now was sent; a refusal after that point is shown once.
  const [sentFrom, setSentFrom] = useState<number | null>(null);
  const toasted = useRef<Rejection | null>(null);
  const isCoordinatorDesk = wardChromeRole(usePathname() ?? "") === "coordinator";
  const live = broadcastAlerts.some(
    (alert) =>
      broadcastKind(alert) === "pull_now" && alert.movementId === movement.id && isAlertLive(alert, movements, now),
  );
  const refusal =
    sentFrom === null
      ? undefined
      : rejections
          .slice(sentFrom)
          .find((r: Rejection) => r.attempted === "RAISE_PULL_NOW" && r.movementId === movement.id);
  useEffect(() => {
    if (!refusal || toasted.current === refusal) return;
    toasted.current = refusal;
    toast?.push({
      tone: "warning",
      title: refusal.reason.replace(/^RAISE_PULL_NOW /, "").replace(/^./, (c: string) => c.toUpperCase()),
    });
  }, [refusal, toast]);
  const offered = live || pullNowOffered(movement, (id) => units.some((unit) => unit.id === id));
  const pull: MenuItem | undefined = offered
    ? {
        id: "pull-now",
        icon: Siren,
        label: withReason(
          "Pull now",
          live || isCoordinatorDesk ? undefined : "Only the bed coordinator sends Pull now",
        ),
        disabled: live || !isCoordinatorDesk,
        meta: live ? "Sent" : undefined,
        onSelect: () => {
          if (!isCoordinatorDesk || live) return;
          setSentFrom(rejections.length);
          sendPullNow();
        },
      }
    : undefined;
  return <>{children(pull)}</>;
}

/**
 * States B review: a refused act keeps its whole name, with the reason on a second quiet line under it
 * (as kit meta it sat beside the name and cut "Escalate" to "Escal…").
 */
function withReason(label: string, reason: string | undefined): ReactNode {
  if (!reason) return label;
  return (
    <span className={styles.menuLabel}>
      <span>{label}</span>
      <span className={styles.menuReason}>{reason}</span>
    </span>
  );
}

function MoreMenu({
  subjectLine,
  displayName,
  now,
  actionDisabledReason,
  seen,
  snoozed,
  actNow,
  escalationApplies,
  isEscalated,
  movement,
  item,
  onAcknowledge,
  onReturn,
  onSnooze,
  onEscalate,
  pull,
}: MoreMenuProps & { pull: MenuItem | undefined }) {
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const escalateReason =
    actionDisabledReason ??
    (!movement
      ? "This alert has no movement to escalate"
      : !escalationApplies
        ? "Escalation is only for an exhausted bed search"
        : isEscalated
          ? "Already escalated"
          : undefined);
  const items: MenuItem[] = [
    ...(pull ? [pull] : []),
    {
      id: "acknowledge",
      icon: Check,
      label: withReason(
        seen ? "Seen" : "Acknowledge",
        actionDisabledReason ?? (seen ? "Already acknowledged" : undefined),
      ),
      disabled: Boolean(actionDisabledReason) || seen,
      onSelect: onAcknowledge,
    },
    {
      id: "snooze",
      icon: AlarmClock,
      label: withReason(snoozed ? "Return now" : "Snooze", actionDisabledReason),
      disabled: Boolean(actionDisabledReason),
      onSelect: snoozed ? onReturn : () => setSnoozeOpen(true),
    },
    {
      id: "escalate",
      icon: isEscalated ? Check : ArrowUpRight,
      label: withReason(isEscalated ? "Escalated" : "Escalate", escalateReason),
      disabled: Boolean(escalateReason),
      onSelect: onEscalate,
    },
  ];
  return (
    <>
      <Menu
        label={`More actions for ${subjectLine}`}
        align="end"
        items={items}
        trigger={(props) => (
          <Button {...props} variant="ghost" icon={Ellipsis} data-testid="alerts-more-actions">
            More
          </Button>
        )}
      />
      <Dialog
        open={snoozeOpen}
        onClose={() => setSnoozeOpen(false)}
        title="Snooze"
        description={displayName}
        size="sm"
        closeLabel="Close snooze"
      >
        <SnoozePicker
          actNow={actNow}
          now={now}
          onSnooze={(until, reason) => onSnooze(until, reason)}
          close={() => setSnoozeOpen(false)}
          inset={false}
        />
      </Dialog>
      <span hidden data-alert-id={item.id} />
    </>
  );
}

/** The live Pull now this alert's movement already has, as one quiet line in the drawer body. */
export function PullNowSentLine({ movement }: { movement: Movement }) {
  return useOptionalWardFlowSelect() ? <PullNowSent movement={movement} /> : null;
}

function PullNowSent({ movement }: { movement: Movement }) {
  const { broadcastAlerts, movements } = useWardFlowSelect("broadcastAlerts", "movements");
  const now = useWardFlowClock();
  const live = broadcastAlerts.find(
    (alert) =>
      broadcastKind(alert) === "pull_now" && alert.movementId === movement.id && isAlertLive(alert, movements, now),
  );
  if (!live) return null;
  return (
    <span className={styles.quiet}>
      <StatusGlyph tone={isPullNowOverdue(live, now) ? "danger" : "neutral"} size={9} /> Pull now sent, answer by{" "}
      <span className={styles.mono}>{live.answerBy !== undefined ? formatInstantWithDay(live.answerBy, now) : ""}</span>
    </span>
  );
}
