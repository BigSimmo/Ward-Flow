"use client";

// The Alerts screen's broadcast composer dialog. Moved out of `alerts-screen.tsx` to keep it under
// the line cap; the screen keeps the draft, the modal focus contract and the dispatch.
import type { RefObject } from "react";
import { Radio, X } from "lucide-react";

import { Button, Checkbox, Field, IconTile, Kbd, Select, StatusGlyph, TextInput, Textarea } from "@/components/wf";
import type { WardFlowState } from "@/components/ward-management/ward-flow-reducer";

import {
  WA_BROADCAST_TEMPLATES,
  type BroadcastKind,
  type BroadcastSeverity,
  type BroadcastTargetScope,
} from "./ward-broadcast-model";
import { broadcastScopeCount } from "./global-alert-view";
import { minutesText } from "./alerts-model";
import styles from "./alerts.module.css";

const SCOPE_LABELS: Record<BroadcastTargetScope, string> = {
  all: "All inpatient wards and ED desks",
  metro_adult: "Metropolitan adult units",
  ed_liaison: "ED mental health liaison desks",
  forensic: "Frankland Centre forensic",
  adolescent: "CAMHS adolescent acute units",
  older_adult: "Older adult units",
  regional_wachs: "WACHS regional network",
};

export function BroadcastComposer({
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
  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- a backdrop click closes it for the pointer, and the shared modal focus helper closes it on Escape
    <div
      ref={modalRef}
      className={styles.modalOverlay}
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
      <div className={styles.composer} onClick={(e) => e.stopPropagation()}>
        <div className={styles.drawerHead}>
          <IconTile icon={Radio} />
          <div className={styles.drawerHeadTitles}>
            <h2 id="broadcast-title" className={styles.drawerTitle}>
              Broadcast network alert
            </h2>
            <p id="broadcast-desc" className={styles.drawerSubtitle}>
              Records a synthetic directive for the chosen scope. No external alert is sent.
            </p>
          </div>
          <Kbd>esc</Kbd>
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
        <div className={styles.composerBody}>
          {broadcastRefused && (
            <div className={styles.feedbackLine} role="alert" aria-label="Broadcast feedback">
              <StatusGlyph tone="danger" />
              <span className={styles.feedbackText}>{broadcastFeedback}</span>
            </div>
          )}

          <Field label="Start from" id="alerts-broadcast-template">
            <Select
              value={selectedTemplateId}
              onChange={(e) => {
                handleSelectTemplate(e.target.value);
                setBroadcastConfirmed(false);
              }}
            >
              {WA_BROADCAST_TEMPLATES.map((tmpl) => (
                <option key={tmpl.id} value={tmpl.id}>
                  {tmpl.name}
                </option>
              ))}
              <option value="custom">Custom directive</option>
            </Select>
          </Field>

          <Field label="Type" id="alerts-broadcast-type">
            <Select
              value={broadcastType}
              onChange={(e) => {
                setBroadcastType(e.target.value as BroadcastKind);
                setBroadcastConfirmed(false);
              }}
            >
              <option value="directive">Directive, wards and ED acknowledge</option>
              <option value="bed_call">Bed call, wards answer how many beds</option>
            </Select>
          </Field>

          <div className={styles.composerPair}>
            <Field label="Severity" id="alerts-broadcast-severity">
              <Select
                value={broadcastSeverity}
                onChange={(e) => {
                  setBroadcastSeverity(e.target.value as BroadcastSeverity);
                  setBroadcastConfirmed(false);
                }}
              >
                <option value="advisory">Advisory</option>
                <option value="warning">Warning</option>
                <option value="critical">Critical</option>
              </Select>
            </Field>
            <Field label="Expires" id="alerts-broadcast-duration">
              <Select
                value={broadcastDurationMinutes}
                onChange={(e) => {
                  setBroadcastDurationMinutes(Number(e.target.value));
                  setBroadcastConfirmed(false);
                }}
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
              onChange={(e) => {
                setBroadcastScope(e.target.value as BroadcastTargetScope);
                setBroadcastConfirmed(false);
              }}
            >
              {/* Ops-12: each count is read from the unit list, never typed. */}
              <option value="all">All inpatient wards and ED desks, {broadcastScopeCount(units, "all")}</option>
              <option value="metro_adult">Metropolitan adult units, {broadcastScopeCount(units, "metro_adult")}</option>
              <option value="ed_liaison">
                ED mental health liaison desks, {broadcastScopeCount(units, "ed_liaison")}
              </option>
              <option value="forensic">Frankland Centre forensic, {broadcastScopeCount(units, "forensic")}</option>
              <option value="adolescent">
                CAMHS adolescent acute units, {broadcastScopeCount(units, "adolescent")}
              </option>
              <option value="older_adult">Older adult units, {broadcastScopeCount(units, "older_adult")}</option>
              <option value="regional_wachs">
                WACHS regional network, {broadcastScopeCount(units, "regional_wachs")}
              </option>
            </Select>
          </Field>

          <Field label="Title" id="alerts-broadcast-title">
            <TextInput
              value={broadcastTitle}
              onChange={(e) => {
                setBroadcastTitle(e.target.value);
                setBroadcastConfirmed(false);
              }}
              placeholder="Short operational title"
            />
          </Field>

          <Field label="Directive" id="alerts-broadcast-message">
            <Textarea
              rows={3}
              maxLength={280}
              placeholder="Enter the flow directive"
              value={broadcastMessage}
              onChange={(e) => {
                setBroadcastMessage(e.target.value);
                setBroadcastConfirmed(false);
              }}
              data-gramm="false"
              data-enable-grammarly="false"
              spellCheck={false}
              autoComplete="off"
            />
          </Field>

          <div className={styles.previewBlock}>
            <span className={styles.drawerSectionTitle}>Preview on every desk</span>
            <div className={styles.previewCard}>
              <StatusGlyph
                tone={
                  broadcastSeverity === "critical" ? "danger" : broadcastSeverity === "warning" ? "warning" : "info"
                }
              />
              <div className={styles.directiveText}>
                <strong className={styles.directiveTitle}>{broadcastTitle.trim() || "Untitled directive"}</strong>
                <span className={styles.quiet}>
                  {severityLabel(broadcastSeverity)} · expires in {minutesText(broadcastDurationMinutes)}
                </span>
              </div>
            </div>
          </div>

          <Checkbox
            id="alerts-broadcast-safeguard"
            checked={broadcastConfirmed}
            onChange={(e) => setBroadcastConfirmed(e.target.checked)}
            label={`I confirm this directive is clinically authorised to be recorded for ${SCOPE_LABELS[broadcastScope]} (${broadcastScopeCount(units, broadcastScope)}). No external notifications are sent.`}
          />
        </div>
        <div className={styles.drawerFoot}>
          <span className={styles.confirmNote}>Recorded by the state bed desk coordinator</span>
          <Button className={styles.btn} onClick={handleCloseBroadcastModal}>
            Cancel
          </Button>
          <Button
            variant="pri"
            icon={Radio}
            className={styles.btn}
            data-testid="ward-alerts-broadcast-confirm"
            disabled={
              !broadcastConfirmed ||
              !broadcastTitle.trim() ||
              !broadcastMessage.trim() ||
              (!!broadcastRequest && !broadcastResult)
            }
            onClick={handleDispatchBroadcast}
          >
            Dispatch
          </Button>
        </div>
      </div>
    </div>
  );
}
