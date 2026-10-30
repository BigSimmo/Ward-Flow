"use client";

// Preview copy of the Alerts screen's broadcast composer (`alerts/broadcast-composer.tsx`). Every
// field, the confirmation wording and the dispatch are unchanged. Redesign: a wider dialog with the
// form on the left and a preview of what each desk will see on the right, beside the confirmation
// and Dispatch, which stays greyed (with its reason) until the box is ticked.
import type { RefObject } from "react";
import { Lock, Radio, X } from "lucide-react";

import { Button, Checkbox, Field, IconTile, Kbd, Select, StatusGlyph, TextInput, Textarea } from "@/components/wf";
import type { WardFlowState } from "@/components/ward-management/ward-flow-reducer";

import {
  WA_BROADCAST_TEMPLATES,
  type BroadcastKind,
  type BroadcastSeverity,
  type BroadcastTargetScope,
} from "@/components/ward-management/alerts/ward-broadcast-model";
import { broadcastScopeCount } from "@/components/ward-management/alerts/global-alert-view";
import { cx } from "@/components/wf";
import { minutesText } from "@/components/ward-management/alerts/alerts-model";
import styles from "@/components/ward-management/alerts/alerts.module.css";
import pop from "./broadcast.module.css";

/** The scope names the Target scope list uses, without their counts. */
const SCOPE_NAMES: Record<BroadcastTargetScope, string> = {
  all: "All inpatient wards and ED desks",
  metro_adult: "Metropolitan adult units",
  ed_liaison: "ED mental health liaison desks",
  forensic: "Frankland Centre forensic",
  adolescent: "CAMHS adolescent acute units",
  older_adult: "Older adult units",
  regional_wachs: "WACHS regional network",
};

export function BroadcastComposerRedesign({
  modalRef,
  handleCloseBroadcastModal,
  modalCloseRef,
  broadcastRefused,
  broadcastFeedback,
  selectedTemplateId,
  handleSelectTemplate,
  broadcastType,
  setBroadcastType,
  broadcastSeverity,
  setBroadcastSeverity,
  broadcastDurationMinutes,
  setBroadcastDurationMinutes,
  broadcastScope,
  setBroadcastScope,
  units,
  broadcastTitle,
  setBroadcastTitle,
  broadcastMessage,
  setBroadcastMessage,
  severityLabel,
  broadcastConfirmed,
  setBroadcastConfirmed,
  broadcastRequest,
  broadcastResult,
  handleDispatchBroadcast,
}: {
  modalRef: RefObject<HTMLDivElement | null>;
  handleCloseBroadcastModal: () => void;
  modalCloseRef: RefObject<HTMLButtonElement | null>;
  broadcastRefused: boolean;
  broadcastFeedback: string | null;
  selectedTemplateId: string;
  handleSelectTemplate: (tmplId: string) => void;
  broadcastType: BroadcastKind;
  setBroadcastType: (kind: BroadcastKind) => void;
  broadcastSeverity: BroadcastSeverity;
  setBroadcastSeverity: (severity: BroadcastSeverity) => void;
  broadcastDurationMinutes: number;
  setBroadcastDurationMinutes: (minutes: number) => void;
  broadcastScope: BroadcastTargetScope;
  setBroadcastScope: (scope: BroadcastTargetScope) => void;
  units: WardFlowState["units"];
  broadcastTitle: string;
  setBroadcastTitle: (title: string) => void;
  broadcastMessage: string;
  setBroadcastMessage: (message: string) => void;
  severityLabel: (severity: BroadcastSeverity) => string;
  broadcastConfirmed: boolean;
  setBroadcastConfirmed: (confirmed: boolean) => void;
  /** Read only for whether a dispatch is still waiting on its verdict. */
  broadcastRequest: unknown;
  broadcastResult: unknown;
  handleDispatchBroadcast: () => void;
}) {
  const severityTone =
    broadcastSeverity === "critical" ? "danger" : broadcastSeverity === "warning" ? "warning" : "info";
  // The banner's own kind wording (`shell/ward-broadcast-banner-body.tsx`).
  const kindLabel =
    broadcastType === "bed_call"
      ? "Bed call"
      : broadcastSeverity === "critical"
        ? "Critical directive"
        : broadcastSeverity === "warning"
          ? "Operational advisory"
          : "Network notice";
  const scopeName = SCOPE_NAMES[broadcastScope];
  // Redesign: Dispatch stays greyed until every step is done, and says which one is left.
  const dispatchWaitsFor = !broadcastTitle.trim()
    ? "Type a title first."
    : !broadcastMessage.trim()
      ? "Type the directive first."
      : !broadcastConfirmed
        ? "Tick the confirmation first."
        : broadcastRequest && !broadcastResult
          ? "Still sending."
          : undefined;
  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- a backdrop click closes it for the pointer, and the shared modal focus helper closes it on Escape
    <div
      ref={modalRef}
      className={cx(styles.modalOverlay, pop.overlay)}
      role="dialog"
      aria-modal="true"
      aria-labelledby="broadcast-title"
      aria-describedby="broadcast-desc"
      tabIndex={-1}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleCloseBroadcastModal();
        }
      }}
    >
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- only stops a click inside the dialog reaching the backdrop that closes it */}
      <div className={cx(styles.composer, pop.composer)} onClick={(e) => e.stopPropagation()}>
        <div className={styles.drawerHead}>
          <IconTile icon={Radio} />
          <div className={styles.drawerHeadTitles}>
            <h2 id="broadcast-title" className={styles.drawerTitle}>
              Broadcast network alert
            </h2>
            <p id="broadcast-desc" className={styles.drawerSubtitle}>
              Records a synthetic directive. No external alert is sent.
            </p>
          </div>
          {/* Redesign: the key named as Tools and Help name it. */}
          <Kbd>Esc</Kbd>
          <Button
            ref={modalCloseRef}
            iconOnly
            icon={X}
            variant="ghost"
            size="sm"
            onClick={handleCloseBroadcastModal}
            aria-label="Close broadcast modal"
            title="Close broadcast modal (Esc)"
          />
        </div>
        <div className={cx(styles.composerBody, pop.body)}>
          <div className={pop.form}>
            {broadcastRefused && (
              <div className={styles.feedbackLine} role="alert" aria-label="Broadcast feedback">
                <StatusGlyph tone="danger" />
                <span className={styles.feedbackText}>{broadcastFeedback}</span>
              </div>
            )}

            <Field label="Start from" id="alerts-broadcast-template">
              <Select value={selectedTemplateId} onChange={(e) => handleSelectTemplate(e.target.value)}>
                {WA_BROADCAST_TEMPLATES.map((tmpl) => (
                  <option key={tmpl.id} value={tmpl.id}>
                    {tmpl.name}
                  </option>
                ))}
                <option value="custom">Custom directive</option>
              </Select>
            </Field>

            <Field label="Type" id="alerts-broadcast-type">
              <Select value={broadcastType} onChange={(e) => setBroadcastType(e.target.value as BroadcastKind)}>
                <option value="directive">Directive, wards and ED acknowledge</option>
                <option value="bed_call">Bed call, wards answer how many beds</option>
              </Select>
            </Field>

            <div className={styles.composerPair}>
              <Field label="Severity" id="alerts-broadcast-severity">
                <Select
                  value={broadcastSeverity}
                  onChange={(e) => setBroadcastSeverity(e.target.value as BroadcastSeverity)}
                >
                  <option value="advisory">Advisory</option>
                  <option value="warning">Warning</option>
                  <option value="critical">Critical</option>
                </Select>
              </Field>
              <Field label="Expires" id="alerts-broadcast-duration">
                <Select
                  value={broadcastDurationMinutes}
                  onChange={(e) => setBroadcastDurationMinutes(Number(e.target.value))}
                >
                  <option value={60}>1h</option>
                  <option value={120}>2h</option>
                  <option value={240}>4h</option>
                  <option value={480}>8h</option>
                  <option value={720}>12h</option>
                  <option value={1440}>24h</option>
                </Select>
              </Field>
            </div>

            <Field label="Target scope" id="alerts-broadcast-target">
              <Select
                value={broadcastScope}
                onChange={(e) => setBroadcastScope(e.target.value as BroadcastTargetScope)}
              >
                {/* Redesign: names only. The count (read from the unit list, Ops-12) is said once, on the
                    preview's "Goes to" line. */}
                {(Object.keys(SCOPE_NAMES) as BroadcastTargetScope[]).map((scope) => (
                  <option key={scope} value={scope}>
                    {SCOPE_NAMES[scope]}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Title" id="alerts-broadcast-title">
              <TextInput
                value={broadcastTitle}
                onChange={(e) => setBroadcastTitle(e.target.value)}
                placeholder="Short operational title"
              />
            </Field>

            <Field label="Directive" id="alerts-broadcast-message">
              <Textarea
                rows={3}
                maxLength={280}
                placeholder="Enter the flow directive"
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
                data-gramm="false"
                data-enable-grammarly="false"
                spellCheck={false}
                autoComplete="off"
              />
            </Field>
          </div>

          <aside className={pop.side} aria-label="Preview and confirmation">
            {/* Redesign: true for any scope, not only every desk. */}
            <span className={styles.drawerSectionTitle}>What each desk sees</span>
            {/* What each desk in the scope sees in its broadcast banner, from the draft as typed. */}
            <div className={pop.preview} data-tone={severityTone}>
              <div className={pop.previewHead}>
                <StatusGlyph tone={severityTone} />
                <span className={pop.previewKind}>{kindLabel}</span>
                <span className={pop.previewExpires}>Expires in {minutesText(broadcastDurationMinutes)}</span>
              </div>
              <strong className={pop.previewTitle}>{broadcastTitle.trim() || "Untitled directive"}</strong>
              <p className={pop.previewMessage}>{broadcastMessage.trim() || "No directive typed yet."}</p>
              {/* Redesign: the sender moves here from the footer, as desks see it. The Type list already
                  says who answers; a bed call names its severity, which its kind line does not. */}
              <p className={pop.previewFoot}>
                {broadcastType === "bed_call" ? `${severityLabel(broadcastSeverity)} · ` : null}
                Dispatched by the state bed desk coordinator
              </p>
            </div>
            <p className={pop.reach}>
              <span>Goes to</span> <b>{scopeName}</b> · {broadcastScopeCount(units, broadcastScope)}
            </p>

            <Checkbox
              id="alerts-broadcast-safeguard"
              checked={broadcastConfirmed}
              onChange={(e) => setBroadcastConfirmed(e.target.checked)}
              label="I confirm this directive is clinically authorised for immediate statewide network broadcast."
            />
            {/* Redesign: what Dispatch waits for sits here, beside the step that clears it. */}
            {dispatchWaitsFor ? (
              <p className={pop.waits} id="alerts-broadcast-waits">
                <Lock size={14} aria-hidden="true" />
                {dispatchWaitsFor}
              </p>
            ) : null}
          </aside>
        </div>
        <div className={cx(styles.drawerFoot, pop.foot)}>
          <Button className={styles.btn} onClick={handleCloseBroadcastModal}>
            Cancel
          </Button>
          <Button
            variant="pri"
            icon={Radio}
            className={styles.btn}
            data-testid="ward-alerts-broadcast-confirm"
            disabledReason={dispatchWaitsFor}
            reasonDisplay="tooltip"
            onClick={handleDispatchBroadcast}
          >
            Dispatch
          </Button>
        </div>
      </div>
    </div>
  );
}
