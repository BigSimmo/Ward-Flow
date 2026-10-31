"use client";

// Preview copy of the Alerts screen's broadcast draft and dispatch (`alerts/alerts-screen.tsx`,
// "---- Broadcast ----"), so the redesigned composer opens with the real first template and sends
// the same `DISPATCH_BROADCAST_ALERT` event. The modal focus contract is the screen's own.

import { useCallback, useRef, useState } from "react";

import {
  WA_BROADCAST_TEMPLATES,
  type BroadcastCategory,
  type BroadcastKind,
  type BroadcastSeverity,
  type BroadcastTargetScope,
} from "@/components/ward-management/alerts/ward-broadcast-model";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { useWardFlowClock, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { WARD_FLOW_ROLE_LABELS } from "@/components/ward-management/ward-flow-roles";
import { useModalFocus } from "@/components/wf";

import { BroadcastComposerRedesign } from "./broadcast-composer";

const SCOPE_LABELS: Record<BroadcastTargetScope, string> = {
  all: "All Inpatient Units & ED Liaison Desks",
  metro_adult: "Metropolitan Adult Acute Services",
  ed_liaison: "Emergency Department Mental Health Liaison",
  forensic: "Frankland Centre Forensic Mental Health",
  adolescent: "CAMHS Adolescent Acute Units",
  older_adult: "Psychogeriatric & Older Adult Units",
  regional_wachs: "WACHS Regional Mental Health Network",
};

export function BroadcastHost() {
  const access = useEffectiveWardAccess();
  const deskRole = access.role === "admin" ? "executive" : access.role;
  const coordDesk = access.role === "coordinator";
  const { units, dispatch, eventLog } = useWardFlowSelect("units", "dispatch", "eventLog");
  const clockNow = useWardFlowClock();

  const [broadcastModalOpen, setBroadcastModalOpen] = useState(true);
  const [broadcastConfirmed, setBroadcastConfirmed] = useState(false);
  const defaultTmpl = WA_BROADCAST_TEMPLATES[0];
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(defaultTmpl?.id ?? "custom");
  const [broadcastTitle, setBroadcastTitle] = useState(defaultTmpl?.title ?? "Demo: HDU full — check discharges");
  const [broadcastMessage, setBroadcastMessage] = useState(defaultTmpl?.defaultMessage ?? "");
  const [broadcastSeverity, setBroadcastSeverity] = useState<BroadcastSeverity>(defaultTmpl?.severity ?? "critical");
  const [broadcastCategory, setBroadcastCategory] = useState<BroadcastCategory>(
    defaultTmpl?.category ?? "capacity_gridlock",
  );
  const [broadcastScope, setBroadcastScope] = useState<BroadcastTargetScope>(defaultTmpl?.targetScope ?? "all");
  const [broadcastDurationMinutes, setBroadcastDurationMinutes] = useState(defaultTmpl?.defaultDurationMinutes ?? 240);
  const [broadcastType, setBroadcastType] = useState<BroadcastKind>(defaultTmpl?.kind ?? "directive");
  const [broadcastRequest, setBroadcastRequest] = useState<{ logSequence: number; title: string } | null>(null);
  const broadcastResult = broadcastRequest
    ? eventLog?.find(
        (entry) => entry.sequence > broadcastRequest.logSequence && entry.type === "DISPATCH_BROADCAST_ALERT",
      )
    : undefined;
  const broadcastAccepted = broadcastResult?.accepted === true;
  const broadcastRefused = broadcastResult?.accepted === false;
  const isBroadcastModalOpen = broadcastModalOpen && !broadcastAccepted;
  const broadcastFeedback = broadcastRefused ? "Broadcast was not accepted. Your draft has been kept." : null;

  const modalRef = useRef<HTMLDivElement | null>(null);
  const modalCloseRef = useRef<HTMLButtonElement | null>(null);
  const handleCloseBroadcastModal = useCallback(() => setBroadcastModalOpen(false), []);
  useModalFocus({
    open: isBroadcastModalOpen,
    onClose: handleCloseBroadcastModal,
    panelRef: modalRef,
    initialFocusRef: modalCloseRef,
    focusOnOpen: "immediate",
  });

  const handleSelectTemplate = (tmplId: string) => {
    setSelectedTemplateId(tmplId);
    if (tmplId === "custom") {
      setBroadcastTitle("");
      setBroadcastMessage("");
      setBroadcastSeverity("critical");
      setBroadcastCategory("capacity_gridlock");
      setBroadcastScope("all");
      setBroadcastDurationMinutes(240);
      setBroadcastType("directive");
      return;
    }
    const tmpl = WA_BROADCAST_TEMPLATES.find((t) => t.id === tmplId);
    if (tmpl) {
      setBroadcastTitle(tmpl.title);
      setBroadcastMessage(tmpl.defaultMessage);
      setBroadcastSeverity(tmpl.severity);
      setBroadcastCategory(tmpl.category);
      setBroadcastScope(tmpl.targetScope);
      setBroadcastDurationMinutes(tmpl.defaultDurationMinutes);
      setBroadcastType(tmpl.kind ?? "directive");
    }
  };

  const handleDispatchBroadcast = () => {
    if (!broadcastConfirmed || !broadcastTitle.trim() || !broadcastMessage.trim()) return;
    if (broadcastRequest && !broadcastResult) return;
    setBroadcastRequest({ logSequence: eventLog?.at(-1)?.sequence ?? -1, title: broadcastTitle.trim() });
    dispatch({
      type: "DISPATCH_BROADCAST_ALERT",
      role: deskRole,
      now: clockNow,
      title: broadcastTitle,
      message: broadcastMessage,
      severity: broadcastSeverity,
      category: broadcastCategory,
      targetScope: broadcastScope,
      targetScopeLabel: SCOPE_LABELS[broadcastScope],
      durationMinutes: broadcastDurationMinutes,
      dispatchedByName: coordDesk ? "State Mental Health Bed Desk Coordinator" : WARD_FLOW_ROLE_LABELS[deskRole],
      kind: broadcastType === "bed_call" ? "bed_call" : "directive",
    });
  };

  const severityLabel = (severity: BroadcastSeverity) =>
    severity === "critical" ? "Critical" : severity === "warning" ? "Warning" : "Advisory";

  return isBroadcastModalOpen ? (
    <BroadcastComposerRedesign
      modalRef={modalRef}
      handleCloseBroadcastModal={handleCloseBroadcastModal}
      modalCloseRef={modalCloseRef}
      broadcastRefused={broadcastRefused}
      broadcastFeedback={broadcastFeedback}
      selectedTemplateId={selectedTemplateId}
      handleSelectTemplate={handleSelectTemplate}
      broadcastType={broadcastType}
      setBroadcastType={setBroadcastType}
      broadcastSeverity={broadcastSeverity}
      setBroadcastSeverity={setBroadcastSeverity}
      broadcastDurationMinutes={broadcastDurationMinutes}
      setBroadcastDurationMinutes={setBroadcastDurationMinutes}
      broadcastScope={broadcastScope}
      setBroadcastScope={setBroadcastScope}
      units={units}
      broadcastTitle={broadcastTitle}
      setBroadcastTitle={setBroadcastTitle}
      broadcastMessage={broadcastMessage}
      setBroadcastMessage={setBroadcastMessage}
      severityLabel={severityLabel}
      broadcastConfirmed={broadcastConfirmed}
      setBroadcastConfirmed={setBroadcastConfirmed}
      broadcastRequest={broadcastRequest}
      broadcastResult={broadcastResult}
      handleDispatchBroadcast={handleDispatchBroadcast}
    />
  ) : null;
}
