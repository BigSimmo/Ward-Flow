"use client";

import { useState } from "react";
import { Check, MessageSquare, Send } from "lucide-react";
import { Button, Menu, requestConfirm, useOptionalToast } from "@/components/wf";
import type { BroadcastAlert } from "@/components/ward-management/alerts/ward-broadcast-model";
import type { Instant } from "@/components/ward-management/ward-clock";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { ASK_WARDS_MINUTES, ASK_WARDS_WINDOW_TEXT } from "@/components/ward-management/ward-operational-defaults";
import type { BedRelease } from "@/components/ward-management/ward-model";

/**
 * DC1 (Josh, 3 Nov 2026): the bed coordinator asks a ward about a discharge without leaving the
 * board. Each ask is a set sentence, never typed text, sent as the existing desk alert to the named
 * wards only (`DISPATCH_BROADCAST_ALERT` with `targetUnitIds`), so the ward sees it on its desk and
 * acknowledges it there, and Alerts keeps the record.
 *
 * M6 (Josh, 3 Nov 2026): this and Quick actions' ask (#1339, `alerts/ask-wards.ts`) share one rule:
 * one advisory directive to the wards not yet asked, skipping a ward named in a live alert with the
 * same title, shown for ASK_WARDS_MINUTES (shared with #1339 in ward-operational-defaults). Whichever lands second swaps its copy for the shared helper.
 *
 * Round 2 (3 Nov 2026): a send waits for the store's answer and says when it was refused, an ask
 * that is still live for that ward cannot be sent twice, and one tap asks every ward with an
 * overdue date at once.
 */
const SENDER = "State Mental Health Bed Desk Coordinator";

const ASKS = [
  {
    id: "date",
    label: "Confirm the discharge date",
    line: (who: string) => `Please confirm the expected discharge for ${who}, or record a new date.`,
  },
  {
    id: "hold-up",
    label: "Update the hold-up",
    line: (who: string) => `Please update what is holding up the discharge for ${who}.`,
  },
  {
    id: "call",
    label: "Call the bed coordinator",
    line: (who: string) => `Please call the bed coordinator about the discharge for ${who}.`,
  },
] as const;

const OVERDUE_TITLE = "Discharge dates passed";
const OVERDUE_LINE =
  "Expected discharge dates have passed on your ward. Please confirm each one on Discharges or record a new date.";
const scopeLabel = (names: readonly string[]) => (names.length === 1 ? names[0]! : `${names.length} wards`);

/** "A, B and C", or "A, B, C and 18 more wards" past three, so a long list stays readable. */
function listNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length <= 3) return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
  return `${names.slice(0, 3).join(", ")} and ${names.length - 3} more wards`;
}

type DispatchOutcome = { status?: string; message?: string; isCurrent?: () => boolean } | undefined | void;
type Dispatch = (event: WardFlowEvent) => unknown;
type AskFields = Omit<Extract<WardFlowEvent, { type: "DISPATCH_BROADCAST_ALERT" }>, "type">;

function liveAsk(alerts: readonly BroadcastAlert[], title: string, message: string, unitId: string, now: Instant) {
  return alerts.some(
    (alert) =>
      alert.status === "active" &&
      alert.expiresAt > now &&
      alert.title === title &&
      alert.message === message &&
      (alert.targetUnitIds ?? []).includes(unitId),
  );
}

async function sendAsk(dispatch: Dispatch, fields: AskFields): Promise<{ ok: boolean; message?: string }> {
  const outcome = (await dispatch({ type: "DISPATCH_BROADCAST_ALERT", ...fields })) as DispatchOutcome;
  if (outcome && outcome.status === "accepted" && outcome.isCurrent?.() !== false) return { ok: true };
  return { ok: false, message: outcome?.message };
}

function askEvent(now: Instant, title: string, message: string, scopeLabel: string, unitIds: string[]): AskFields {
  return {
    role: "coordinator",
    now,
    title,
    message,
    severity: "advisory",
    category: "capacity_gridlock",
    targetScope: "all",
    targetScopeLabel: scopeLabel,
    durationMinutes: ASK_WARDS_MINUTES,
    dispatchedByName: SENDER,
    kind: "directive",
    targetUnitIds: unitIds,
  };
}

export function DischargeMessageWard({
  release,
  who,
  wardName,
  now,
  dispatch,
}: {
  release: BedRelease;
  who: string;
  wardName: string;
  now: Instant;
  dispatch: Dispatch;
}) {
  const toast = useOptionalToast();
  const { broadcastAlerts } = useWardFlowSelect("broadcastAlerts");
  const [sending, setSending] = useState(false);
  const title = `Discharge: ${who}`;
  const sent = (ask: (typeof ASKS)[number]) => liveAsk(broadcastAlerts, title, ask.line(who), release.unitId, now);
  const send = async (ask: (typeof ASKS)[number]) => {
    if (sending || sent(ask)) return;
    setSending(true);
    const result = await sendAsk(dispatch, askEvent(now, title, ask.line(who), wardName, [release.unitId]));
    setSending(false);
    toast?.push(
      result.ok
        ? { tone: "success", title: `Sent to ${wardName}`, body: ask.label }
        : { tone: "warning", title: "Not sent", body: result.message ?? "Try again in a moment." },
    );
  };
  return (
    <Menu
      label={`Message ${wardName}`}
      align="end"
      items={ASKS.map((ask) => {
        const already = sent(ask);
        return {
          id: ask.id,
          label: already ? `${ask.label} · sent` : ask.label,
          disabled: already || sending,
          icon: already ? Check : undefined,
          onSelect: () => void send(ask),
        };
      })}
      trigger={(props) => (
        <Button
          size="sm"
          variant="sec"
          icon={MessageSquare}
          disabled={sending}
          {...props}
          data-testid="ward-discharge-message-ward"
        >
          {sending ? "Sending" : "Message ward"}
        </Button>
      )}
    />
  );
}

/**
 * One tap for the coordinator's most common chase: every ward with an overdue expected date gets one
 * set ask, in a single alert to just those wards. Wards already asked in the ask window are
 * left out, so the button never nags twice. Confirmed first, because it reaches several desks.
 */
export function DischargeAskOverdueWards({
  overdue,
  wardName,
  now,
  dispatch,
}: {
  overdue: readonly BedRelease[];
  wardName: (unitId: string) => string;
  now: Instant;
  dispatch: Dispatch;
}) {
  const toast = useOptionalToast();
  const { broadcastAlerts } = useWardFlowSelect("broadcastAlerts");
  const [sending, setSending] = useState(false);
  const wards = [...new Set(overdue.map((release) => release.unitId))];
  const pending = wards.filter(
    (unitId) =>
      !broadcastAlerts.some(
        (alert) =>
          alert.status === "active" &&
          alert.expiresAt > now &&
          alert.title === OVERDUE_TITLE &&
          (alert.targetUnitIds ?? []).includes(unitId),
      ),
  );
  if (wards.length === 0) return null;
  const allAsked = pending.length === 0;
  const ask = async () => {
    if (sending || allAsked) return;
    const names = pending.map(wardName);
    const confirmed = await requestConfirm({
      title: `Ask ${pending.length} ${pending.length === 1 ? "ward" : "wards"}?`,
      message: `${listNames(names)} will each be asked to confirm their overdue discharge dates or record new ones. It shows on their screen for ${ASK_WARDS_WINDOW_TEXT}.`,
      confirmLabel: "Send",
      cancelLabel: "Not now",
    });
    if (!confirmed) return;
    setSending(true);
    // Round 2 stress test: one alert to all the wards, not one each. Twenty-one separate alerts
    // filled the coordinator's own notice strip; one alert reads "0 of 21 acknowledged" and each
    // ward still sees only its own patients on its Discharges page.
    const result = await sendAsk(dispatch, askEvent(now, OVERDUE_TITLE, OVERDUE_LINE, scopeLabel(names), pending));
    setSending(false);
    toast?.push(
      result.ok
        ? {
            tone: "success",
            // M6 (Josh, 3 Nov 2026): the same words as Quick actions' ask (#1339, askedLine).
            title: `Asked ${pending.length} ${pending.length === 1 ? "ward" : "wards"}. It shows on their screen for ${ASK_WARDS_WINDOW_TEXT}.`,
            body: listNames(names),
          }
        : { tone: "warning", title: "Not sent", body: result.message ?? "Try again in a moment." },
    );
  };
  return (
    <Button
      size="sm"
      variant="sec"
      icon={allAsked ? Check : Send}
      disabled={sending || allAsked}
      onClick={() => void ask()}
      data-testid="ward-discharge-ask-overdue"
      aria-label={
        allAsked
          ? `Every ward with an overdue date has been asked in the last ${ASK_WARDS_WINDOW_TEXT}`
          : `Ask ${pending.length} ${pending.length === 1 ? "ward" : "wards"} to confirm their overdue discharge dates`
      }
    >
      {sending ? "Sending" : allAsked ? "Asked" : pending.length === 1 ? "Ask the ward" : `Ask ${pending.length} wards`}
    </Button>
  );
}
