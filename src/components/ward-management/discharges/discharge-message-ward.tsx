"use client";

import { MessageSquare } from "lucide-react";
import { Button, Menu, useOptionalToast } from "@/components/wf";
import type { Instant } from "@/components/ward-management/ward-clock";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import type { BedRelease } from "@/components/ward-management/ward-model";

/**
 * DC1 (Josh, 3 Nov 2026): the bed coordinator asks the ward about one discharge without leaving the
 * board. Each ask is a set sentence, never typed text, sent as the existing desk alert to that one
 * ward (`DISPATCH_BROADCAST_ALERT` with `targetUnitIds`), so the ward sees it on its desk and
 * acknowledges it there, and Alerts keeps the record.
 */
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
  dispatch: (event: WardFlowEvent) => unknown;
}) {
  const toast = useOptionalToast();
  const send = (ask: (typeof ASKS)[number]) => {
    dispatch({
      type: "DISPATCH_BROADCAST_ALERT",
      role: "coordinator",
      now,
      title: `Discharge: ${who}`,
      message: ask.line(who),
      severity: "advisory",
      category: "capacity_gridlock",
      targetScope: "all",
      targetScopeLabel: wardName,
      durationMinutes: 240,
      dispatchedByName: "State Mental Health Bed Desk Coordinator",
      kind: "directive",
      targetUnitIds: [release.unitId],
    });
    toast?.push({ tone: "success", title: `Sent to ${wardName}`, body: ask.label });
  };
  return (
    <Menu
      label={`Message ${wardName}`}
      align="end"
      items={ASKS.map((ask) => ({ id: ask.id, label: ask.label, onSelect: () => send(ask) }))}
      trigger={(props) => (
        <Button size="sm" variant="sec" icon={MessageSquare} {...props} data-testid="ward-discharge-message-ward">
          Message ward
        </Button>
      )}
    />
  );
}
