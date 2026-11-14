"use client";

import { Lock, Plus } from "lucide-react";

import { HeroAct, HeroFigures, HeroQuickChips, HeroTop } from "@/components/wf";

import { useSeclusionSummary } from "./seclusion-summary";

/**
 * Page tops (Josh, 9 Nov 2026): the Forms page's top while its Seclusion view is chosen. Figures from
 * the view's own counts (`useSeclusionSummary`); the buttons ask the view below to open its dialogs.
 * Operational only (D-72): nothing here works out an order length, review time or legal limit.
 */
export function SeclusionTop({
  phone,
  onAsk,
}: {
  phone: boolean;
  onAsk: (kind: "start" | "incident" | "room") => void;
}) {
  const { live, rooms, available, lastDay, mayRecord, mayRecordIncident } = useSeclusionSummary();
  const start = mayRecord
    ? {
        label: "Start seclusion or restraint",
        phoneLabel: "Start",
        testId: "seclusion-start-open",
        onClick: () => onAsk("start"),
      }
    : undefined;
  return (
    <HeroTop
      figures={
        <HeroFigures
          items={[
            {
              id: "live",
              value: live.length,
              label: "in use now",
              tone: live.length > 0 ? "danger" : undefined,
              testId: "seclusion-figure-live",
            },
            {
              id: "rooms",
              value: available,
              unit: ` / ${rooms.length}`,
              label: "rooms available",
              testId: "seclusion-figure-rooms",
            },
            {
              id: "incidents",
              value: lastDay.length,
              // A phone keeps the label to one line; the desktop names the window.
              label: phone ? "incidents" : "incidents, last day",
              testId: "seclusion-figure-incidents",
            },
          ]}
        />
      }
      act={
        live.length === 0 ? (
          <HeroAct tone="calm" title="None recorded as in use" action={start} testId="seclusion-act" />
        ) : (
          <HeroAct
            tone="danger"
            title={`${live.length} recorded as in use`}
            sub="Listed below, longest running first"
            action={start}
            testId="seclusion-act"
          />
        )
      }
      chips={
        <HeroQuickChips
          label="Seclusion actions"
          items={[
            ...(mayRecordIncident
              ? [
                  {
                    id: "incident",
                    label: "Record incident",
                    icon: <Plus strokeWidth={1.75} aria-hidden="true" />,
                    testId: "seclusion-incident-open",
                    onClick: () => onAsk("incident"),
                  },
                ]
              : []),
            ...(rooms.length > 0
              ? [
                  {
                    id: "room",
                    label: "Change a room",
                    icon: <Lock strokeWidth={1.75} aria-hidden="true" />,
                    testId: "seclusion-room-open",
                    onClick: () => onAsk("room"),
                  },
                ]
              : []),
          ]}
        />
      }
    />
  );
}
