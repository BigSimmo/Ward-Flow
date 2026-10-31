"use client";

import { useState, type ReactNode } from "react";

import { HelpFlow, type HelpOpen } from "@/components/ward-redesign/pop-help/help-flow";
import { HOW_DO_I_NEWS } from "@/components/ward-redesign/pop-help/help-tasks-data";
import { NoticeStack } from "@/components/ward-redesign/notices/notice-stack";

import { CornerCard } from "./corner-card";

/**
 * The product tour mock-up, drawn over its page and opened on load. `page` is the page it opens over.
 *
 * Final round (D-91): closing the tour (Close, Skip tour or Done) shows how the help corner cards
 * step aside from notices, as the notices mock-up places them: the What's new card at the bottom
 * right with a notice beside it on a computer; on a phone the notice pill rests above the dock and
 * the card steps back while it shows. Got it, Escape or See all in Help close the card; the notice
 * is a synthetic save, worded as the app's own.
 */
export function PopTour({ page }: { page: ReactNode }) {
  const [flow, setFlow] = useState<{ key: number; initial: HelpOpen }>({ key: 0, initial: { kind: "tour" } });
  const [flowOpen, setFlowOpen] = useState(true);
  const [corner, setCorner] = useState<"pending" | "shown" | "closed">("pending");
  const open = (initial: HelpOpen) => {
    setFlow((current) => ({ key: current.key + 1, initial }));
    setFlowOpen(true);
  };
  return (
    <>
      {page}
      {flowOpen ? (
        <HelpFlow
          key={flow.key}
          initial={flow.initial}
          onDone={() => {
            setFlowOpen(false);
            setCorner((state) => (state === "pending" ? "shown" : state));
          }}
        />
      ) : null}
      {corner === "shown" ? (
        <>
          <CornerCard
            kind="whats-new"
            lines={[HOW_DO_I_NEWS.line]}
            onPrimary={() => open({ kind: "help", view: "new" })}
            onClose={() => setCorner("closed")}
          />
          <NoticeStack
            notices={[
              {
                id: "handover-note",
                tone: "success",
                title: "Handover note saved for the night shift",
                autoDismiss: true,
              },
            ]}
          />
        </>
      ) : null}
    </>
  );
}
