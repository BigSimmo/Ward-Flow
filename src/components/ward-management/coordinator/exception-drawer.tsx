"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Badge, Card, EmptyState, StatusGlyph, Tabs } from "@/components/wf";
import { DeclineRegister } from "@/components/ward-management/decline-register";
import { OverrideRegister } from "@/components/ward-management/override-register";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import type { DeclineEntry, InboxItem, OverrideEntry } from "@/components/ward-management/ward-derivations";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";
import { dischargeHref } from "@/components/ward-management/shell/ward-facade";
import type { Rejection, Unit } from "@/components/ward-management/ward-model";

import styles from "./home.module.css";

export type RegisterTabId = "declines" | "overrides" | "exceptions" | "refused";

/** Order fixed here: arrow-key order and DOM order both read off this one list. v6 Home mockup
 *  (7 Oct 2026) puts Exceptions first, then the two records, then Refused. */
const REGISTER_TABS: { id: RegisterTabId; label: string }[] = [
  { id: "exceptions", label: "Exceptions" },
  { id: "declines", label: "Declines" },
  { id: "overrides", label: "Overrides" },
  { id: "refused", label: "Refused" },
];

const ALERTS_HREF = "/mockups/ward-flow/alerts";

type ExceptionDrawerProps = {
  items: InboxItem[];
  /** Display-only silence reminders derived from existing referral timestamps. Not inbox facts. */
  silenceReminders?: ReadonlyMap<string, string>;
  /** Transitions the reducer refused, oldest first as stored. Rendered newest first. */
  rejections: Rejection[];
  /** OD-3's unrestricted coordinator read (`allOverrides`). */
  overrides: OverrideEntry[];
  /** The whole-network decline register (`allDeclines`). */
  declines: DeclineEntry[];
  /** Threaded through for `OverrideRegister`/`DeclineRegister`, which resolve a unit id to a name. */
  units: Unit[];
  now: Instant;
  /** Phone only: whether the collapsible bar is open. Above 48rem the panel always shows. */
  open: boolean;
  onToggle: () => void;
  onSelectMovement: (movementId: string) => void;
  /**
   * Discharge notification rows carry `admissionId` and link to that stay on the discharges board,
   * not a movement. Called as the link opens, so the caller can close its panel; the link itself
   * navigates, so the drawer needs no router.
   */
  onSelectDischarge?: (admissionId: string) => void;
  /** `band`: the desktop strip under the Home hero. `column`: the phone card under the queue. */
  placement?: "band" | "column";
  /** Optional controlled tab, so the hero's Exceptions and Declines counts open their own tab. */
  tab?: RegisterTabId;
  onTabChange?: (tab: RegisterTabId) => void;
};

/**
 * The coordinator's four registers, one card on Home: Exceptions, Declines, Overrides and Refused.
 *
 * - Above 48rem the tab strip and panel always show. On a phone the card collapses behind
 *   "Today's answers", which carries all four counts (owner ruling 2026-09-07), and selecting a
 *   row closes it so Confirm stays in reach.
 * - All four tabpanels stay mounted at every width; only `hidden` and `data-open` change, so a
 *   tab's `aria-controls` never dangles.
 * - Every count is the `.length` of the array its own panel renders, and every row it counts is
 *   on screen (Ruling 3): a tab reading 7 over a panel showing 5 is the same defect, so the
 *   mockup's "2 more" truncation is not used.
 * - Refusals are their own tab, separate from exceptions: a refusal and an inbox item are
 *   different facts a coordinator answers differently.
 */
function commandInboxTitle(item: InboxItem): string {
  if (item.id.startsWith("bed-pull-") || item.title === "Bed pull expired") {
    return "Reserved time has passed, bed still held";
  }
  return item.title;
}

export function ExceptionDrawer({
  items,
  silenceReminders,
  rejections,
  overrides,
  declines,
  units,
  now,
  open,
  onToggle,
  onSelectMovement,
  onSelectDischarge,
  placement = "column",
  tab,
  onTabChange,
}: ExceptionDrawerProps) {
  const [ownTab, setOwnTab] = useState<RegisterTabId>("exceptions");
  const activeTab = tab ?? ownTab;
  const setActiveTab = onTabChange ?? setOwnTab;
  // Owner, 26 Sept 2026: resolves a silence reminder's bare movement id to the patient's name.
  const resolvePatientIdentity = usePatientOf();

  // Newest first: a coordinator wants to see what just got refused.
  const refusalsNewestFirst = [...rejections].reverse();

  // Escape closes the phone bar.
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onToggle();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onToggle]);

  const countFor: Record<RegisterTabId, number> = {
    declines: declines.length,
    overrides: overrides.length,
    exceptions: items.length,
    refused: rejections.length,
  };
  const inboxMovementIds = new Set(items.map((item) => item.movementId));
  const unmatchedSilence = [...(silenceReminders?.entries() ?? [])].filter(
    ([movementId]) => !inboxMovementIds.has(movementId),
  );
  const checkedAt = formatInstantWithDay(now, now);

  return (
    <Card
      className={styles.registersCard}
      data-placement={placement}
      aria-label="Declines, overrides and exceptions"
      data-testid="ward-coordinator-registers"
    >
      {/* Phone only: the collapsible bar. Hidden from 48rem up by CSS, never unmounted. */}
      <button
        type="button"
        className={styles.registersToggle}
        aria-expanded={open}
        aria-controls="ward-coordinator-registers-panel"
        onClick={onToggle}
      >
        {open ? <ChevronDown aria-hidden="true" /> : <ChevronUp aria-hidden="true" />}
        <span id="ward-exceptions-toggle-label">Today’s answers</span>
        <span className={styles.registersToggleCounts}>
          <span data-testid="ward-exceptions-toggle-decline-count">
            {declines.length === 1 ? "1 decline" : `${declines.length} declines`}
          </span>
          <span data-testid="ward-exceptions-toggle-override-count">
            {overrides.length === 0
              ? "No overrides"
              : overrides.length === 1
                ? "1 override"
                : `${overrides.length} overrides`}
          </span>
          <span data-testid="ward-exceptions-toggle-count">
            {items.length === 1 ? "1 exception" : `${items.length} exceptions`}
          </span>
          {/* All four render at every value; the danger glyph only once something was refused. */}
          <span
            data-testid="ward-exceptions-toggle-refusal-count"
            title={`${rejections.length} refused action${rejections.length === 1 ? "" : "s"}`}
          >
            {rejections.length > 0 ? <StatusGlyph tone="danger" size={9} /> : null}
            {rejections.length === 1 ? "1 refused" : `${rejections.length} refused`}
          </span>
        </span>
      </button>
      <div
        id="ward-coordinator-registers-panel"
        className={styles.registersPanel}
        data-open={open}
        role="region"
        aria-labelledby="ward-exceptions-toggle-label"
      >
        <Tabs
          label="Today’s answers"
          idPrefix="ward-register"
          className={styles.registersTabs}
          items={REGISTER_TABS.map((tab) => ({
            id: tab.id,
            label: tab.label,
            count: countFor[tab.id] > 0 ? countFor[tab.id] : undefined,
          }))}
          value={activeTab}
          onChange={setActiveTab}
        />

        <section
          role="tabpanel"
          id="ward-register-panel-exceptions"
          aria-label="Exceptions"
          hidden={activeTab !== "exceptions"}
          className={styles.registerPanel}
        >
          {items.length === 0 ? (
            <EmptyState title="No exceptions right now" meta={`Checked at ${checkedAt}`} />
          ) : (
            <ul className={styles.registerList}>
              {items.map((item) => {
                const silenceCopy = silenceReminders?.get(item.movementId);
                const content = (
                  <>
                    <span className={styles.registerMain}>
                      <span className={styles.registerTitle}>{commandInboxTitle(item)}</span>
                      <span className={styles.registerSub}>
                        {item.detail} · {item.owner}
                      </span>
                      {silenceCopy !== undefined ? (
                        <span className={styles.registerNote} data-testid={`ward-exception-silence-${item.id}`}>
                          {silenceCopy}
                        </span>
                      ) : null}
                    </span>
                    <Badge tone={item.tone === "danger" ? "danger" : "warning"} size="sm" className={styles.noShrink}>
                      {item.tone === "danger" ? "Act now" : "At risk"}
                    </Badge>
                  </>
                );
                // Same routing as the Tasks drawer: a discharge notification row opens by admission.
                const { admissionId } = item;
                return (
                  <li key={item.id}>
                    {admissionId !== undefined ? (
                      <Link
                        href={dischargeHref(admissionId)}
                        data-testid={`ward-exception-${item.id}`}
                        data-tone={item.tone}
                        className={styles.registerRow}
                        onClick={() => {
                          onSelectDischarge?.(admissionId);
                        }}
                      >
                        {content}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        data-testid={`ward-exception-${item.id}`}
                        data-tone={item.tone}
                        className={styles.registerRow}
                        onClick={() => {
                          onSelectMovement(item.movementId);
                        }}
                      >
                        {content}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {unmatchedSilence.length > 0 ? (
            <ul className={styles.registerList} data-testid="ward-silence-reminders">
              {unmatchedSilence.map(([movementId, copy]) => (
                <li key={movementId}>
                  <button
                    type="button"
                    className={styles.registerRow}
                    onClick={() => onSelectMovement(movementId)}
                    data-testid={`ward-silence-reminder-${movementId}`}
                  >
                    <span className={styles.registerMain}>
                      <span className={styles.registerTitle}>{resolvePatientIdentity({ movementId }).displayName}</span>
                      <span className={styles.registerSub}>{copy}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <div className={styles.cardFoot}>
            <span className={styles.footMeta}>{items.length === 0 ? "None now" : "All shown"}</span>
            <Link href={ALERTS_HREF} className={styles.footLink}>
              View all
            </Link>
          </div>
        </section>

        <section
          role="tabpanel"
          id="ward-register-panel-declines"
          aria-label="Declines"
          hidden={activeTab !== "declines"}
          className={styles.registerPanel}
          data-testid="ward-coordinator-decline-register"
        >
          <DeclineRegister entries={declines} units={units} now={now} />
        </section>

        <section
          role="tabpanel"
          id="ward-register-panel-overrides"
          // The register's own name, not the shorter tab label beside it.
          aria-label="Override register"
          hidden={activeTab !== "overrides"}
          className={styles.registerPanel}
          data-testid="ward-coordinator-override-register"
        >
          <OverrideRegister entries={overrides} units={units} now={now} />
        </section>

        <section
          role="tabpanel"
          id="ward-register-panel-refused"
          aria-label="Refused"
          hidden={activeTab !== "refused"}
          className={styles.registerPanel}
          data-testid="ward-refusals"
        >
          {refusalsNewestFirst.length === 0 ? (
            <EmptyState title="No refused actions" meta={`Checked at ${checkedAt}`} />
          ) : (
            <>
              <p className={styles.registerLead} id="ward-refusals-lead">
                Refused actions, newest first
              </p>
              <ul className={styles.registerList} aria-labelledby="ward-refusals-lead">
                {refusalsNewestFirst.map((rejection) => (
                  <li key={rejection.id} data-testid={`ward-refusal-${rejection.id}`} className={styles.registerRow}>
                    <span className={styles.registerMain}>
                      <span className={styles.registerTitle}>{rejection.attempted}</span>
                      <span className={styles.registerSub}>{rejection.reason}</span>
                    </span>
                    <Badge tone="danger" variant="mono" size="sm" className={styles.noShrink}>
                      {formatInstantWithDay(rejection.at, now)}
                    </Badge>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
    </Card>
  );
}
