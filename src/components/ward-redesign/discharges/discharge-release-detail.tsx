// Fork of DischargeReleaseDetail in src/components/ward-management/discharges/discharge-detail-panes.tsx.
"use client";

import { useEffect, useId, useRef } from "react";
import Link from "next/link";
import { releaseBand, type ReleaseBand } from "@/components/ward-management/ward-bed-availability";
import { LEAVING_DESTINATIONS } from "@/components/ward-management/ward-admissions";
import { WardFreshness } from "@/components/ward-management/ward-freshness";
import type { BedRelease } from "@/components/ward-management/ward-model";
import { patientHref } from "@/components/ward-management/shell/ward-facade";
import { Badge, Button, StatusGlyph, buttonClass, durMinutes } from "@/components/wf";
import { ReadyToLeave } from "@/components/ward-management/discharges/discharge-ready-to-leave";
import pageStyles from "@/components/ward-management/discharges/discharges-third-edition.module.css";
import {
  BAND_LABELS,
  unitLabel,
  healthServiceLabel,
  recordName,
  recordedMoment,
} from "@/components/ward-management/discharges/discharge-board-model";
import { RecordedDischargeMilestones } from "@/components/ward-management/discharges/discharge-board-parts";
import { DischargeDependenciesPanel } from "@/components/ward-management/discharges/discharge-logistics-lazy";
import type { DischargeWorkspaceState } from "@/components/ward-management/discharges/use-discharge-workspace-state";
import { HELD_UP, pastWords, type ReleasePanelPart } from "./discharges-parts";
import redesign from "./discharges-redesign.module.css";

const DETAIL_TABS = [
  ["milestones", "Milestones"],
  ["barriers", "Barriers"],
  ["transport", "Transport"],
  ["dossier", "Record"],
] as const;

type DrawerTab = DischargeWorkspaceState["drawerTab"];

function tabPanelProps(prefix: string, tab: DrawerTab, active: DrawerTab) {
  return {
    role: "tabpanel",
    id: `${prefix}-panel-${tab}`,
    "aria-labelledby": `${prefix}-tab-${tab}`,
    tabIndex: 0,
    hidden: active !== tab,
  } as const;
}

/** The detail panel's tabs: milestones, barriers, transport and record. */
function DischargeDetailTabs({
  idPrefix,
  hasBlocker,
  drawerTab,
  setDrawerTab,
}: {
  idPrefix: string;
  hasBlocker: boolean;
  drawerTab: DrawerTab;
  setDrawerTab: DischargeWorkspaceState["setDrawerTab"];
}) {
  return (
    <div className={pageStyles.drawerTabs} role="tablist" aria-label="Discharge inspection sections">
      {DETAIL_TABS.map(([id, label], index) => (
        <button
          key={id}
          type="button"
          role="tab"
          id={`${idPrefix}-tab-${id}`}
          aria-controls={`${idPrefix}-panel-${id}`}
          aria-selected={drawerTab === id}
          tabIndex={drawerTab === id ? 0 : -1}
          className={`${pageStyles.drawerTab} ${drawerTab === id ? pageStyles.drawerTabActive : ""}`}
          onClick={() => setDrawerTab(id)}
          onKeyDown={(event) => {
            const next =
              event.key === "Home"
                ? 0
                : event.key === "End"
                  ? DETAIL_TABS.length - 1
                  : event.key === "ArrowRight"
                    ? (index + 1) % DETAIL_TABS.length
                    : event.key === "ArrowLeft"
                      ? (index - 1 + DETAIL_TABS.length) % DETAIL_TABS.length
                      : null;
            if (next === null) return;
            event.preventDefault();
            setDrawerTab(DETAIL_TABS[next][0]);
            event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
          }}
        >
          {label}
          {id === "barriers" && hasBlocker ? <span className={pageStyles.tabBadgeAlert}>!</span> : null}
        </button>
      ))}
    </div>
  );
}

/**
 * A bed release opened from Now. Redesign (Josh, 30 Oct): the phone leads with the person, surname
 * first, then the ward; "When" says once how the release stands against its date; the badge says
 * "Held up". `openOn` is the part a row's button promised: Chase opens on the barriers, and Confirm
 * date on the release's own "New expected out" control, in its discharge arrangements beside the
 * barriers (`RECORD_DISCHARGE_PLAN_CHANGE`, which also marks earlier confirmations to check again).
 */
export function DischargeReleaseDetail({
  s,
  detailRelease,
  openOn,
}: {
  s: DischargeWorkspaceState;
  detailRelease: BedRelease;
  openOn: ReleasePanelPart | null;
}) {
  const tabIdPrefix = useId();
  const {
    dayZero,
    now,
    setPopulation,
    isPhone,
    phoneReleaseMore,
    setPhoneReleaseMore,
    drawerTab,
    setDrawerTab,
    readyChange,
    setReadyChange,
    ticksFor,
    setTick,
    linkedReleaseRecord,
    releaseOnCto,
    selectedUnit,
    openRecord,
    detailTone,
    detailBadgeLabel,
    releasePaneClass,
  } = s;
  const barrierRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // The part a row's button named gets the focus, after the panel's own first-control focus. The
  // arrangements (with the release's own "New expected out" date control) load when idle, so the
  // date control is looked for a few times before giving up.
  useEffect(() => {
    if (openOn === null || openOn === "milestones") return;
    let tries = 0;
    let timer = 0;
    const look = () => {
      const target =
        openOn === "date"
          ? panelRef.current?.querySelector<HTMLElement>(
              '[data-testid="ward-discharge-dependencies"] select[aria-label="Day"]',
            )
          : barrierRef.current;
      if (target) {
        target.focus({ preventScroll: true });
        target.scrollIntoView?.({ block: "center" });
      } else if (tries++ < 20) timer = window.setTimeout(look, 100);
    };
    timer = window.setTimeout(look, 0);
    return () => window.clearTimeout(timer);
  }, [openOn]);
  const overdue = detailRelease.state !== "discharged" && detailRelease.expectedAt < now;
  const heldUp = detailRelease.state !== "discharged" && detailRelease.blocker !== null;
  const badgeLabel = heldUp ? HELD_UP : detailBadgeLabel;
  const tabList = (hasBlocker: boolean) => (
    <DischargeDetailTabs
      idPrefix={tabIdPrefix}
      hasBlocker={hasBlocker}
      drawerTab={drawerTab}
      setDrawerTab={setDrawerTab}
    />
  );
  const releasePanelProps = (tab: DrawerTab) => (isPhone ? {} : tabPanelProps(tabIdPrefix, tab, drawerTab));
  const personName = linkedReleaseRecord ? recordName(linkedReleaseRecord) : null;
  const wardName = unitLabel(selectedUnit, detailRelease.unitId);
  return (
    <>
      {isPhone ? (
        <>
          {/* Redesign (Josh, 30 Oct): the person leads, surname first; the ward second. */}
          <div className={pageStyles.phIdentity}>
            <h3 className={pageStyles.patientFullName}>{personName ?? wardName}</h3>
            <p className={pageStyles.phIdentityMeta}>
              {[
                personName ? wardName : null,
                healthServiceLabel(selectedUnit),
                linkedReleaseRecord?.identity.kind === "linked" ? linkedReleaseRecord.identity.patient.umrn : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {detailTone ? (
              <Badge tone={detailTone} size="sm">
                {badgeLabel}
              </Badge>
            ) : null}
          </div>
          <dl className={pageStyles.phFacts}>
            <div>
              <dt>{detailRelease.state === "discharged" ? "Released" : "Expected out"}</dt>
              <dd className={pageStyles.mono}>
                {recordedMoment(
                  detailRelease.state === "discharged" ? detailRelease.confirmedAt : detailRelease.expectedAt,
                  dayZero,
                )}
              </dd>
            </div>
            {/* One cell for how the release stands against its date (was When and Against date). */}
            <div>
              <dt>When</dt>
              <dd>
                {detailRelease.state === "discharged" ? (
                  "Departed"
                ) : overdue ? (
                  <>
                    <StatusGlyph tone="danger" size={9} /> {pastWords(now - detailRelease.expectedAt)}
                  </>
                ) : (
                  `${BAND_LABELS[releaseBand(detailRelease, now) as ReleaseBand]} · in ${durMinutes(detailRelease.expectedAt - now)}`
                )}
              </dd>
            </div>
            <div className={redesign.factWide}>
              <dt>Destination</dt>
              <dd>
                {LEAVING_DESTINATIONS.find((item) => item.id === linkedReleaseRecord?.leavingDestination)?.label ??
                  "Not recorded"}
              </dd>
            </div>
          </dl>
        </>
      ) : (
        <>
          <div className={pageStyles.identity}>
            <div className={pageStyles.identityText}>
              <h3 className={pageStyles.patientFullName}>{personName ?? wardName}</h3>
              <p className={pageStyles.identityMeta}>
                {linkedReleaseRecord?.identity.kind === "linked" && (
                  <span className={pageStyles.mono}>UMRN {linkedReleaseRecord.identity.patient.umrn}</span>
                )}
                <span>{wardName}</span>
                <span>{healthServiceLabel(selectedUnit)}</span>
              </p>
            </div>
            {detailTone ? (
              <Badge tone={detailTone} size="sm">
                {badgeLabel}
              </Badge>
            ) : null}
          </div>
          <dl className={pageStyles.detailStats}>
            {overdue ? (
              <div>
                <dt>Overdue</dt>
                <dd>{pastWords(now - detailRelease.expectedAt).replace(/ past$/, "")}</dd>
              </div>
            ) : detailRelease.state !== "discharged" ? (
              <div>
                <dt>Due in</dt>
                <dd>{durMinutes(detailRelease.expectedAt - now)}</dd>
              </div>
            ) : null}
            <div>
              <dt>{detailRelease.state === "discharged" ? "Released" : "Expected"}</dt>
              <dd>
                {recordedMoment(
                  detailRelease.state === "discharged" ? detailRelease.confirmedAt : detailRelease.expectedAt,
                  dayZero,
                )}
              </dd>
            </div>
          </dl>
        </>
      )}

      {isPhone && linkedReleaseRecord?.identity.kind === "linked" ? (
        // A4-22 (audit round 2): on the phone the link opens the person's own page
        // rather than switching the board to History and losing the selection.
        <Link
          className={buttonClass({ variant: "ghost", size: "sm", className: pageStyles.bridgeButton })}
          href={patientHref(linkedReleaseRecord.identity.patient.id)}
        >
          Patient page →
        </Link>
      ) : linkedReleaseRecord ? (
        <Button
          variant="ghost"
          size="sm"
          className={pageStyles.bridgeButton}
          onClick={(e) => {
            setPopulation("records");
            openRecord(linkedReleaseRecord, e.currentTarget);
          }}
        >
          View patient discharge record →
        </Button>
      ) : null}

      {isPhone ? null : tabList(Boolean(detailRelease.blocker))}

      <div {...releasePanelProps("milestones")} className={releasePaneClass("milestones")}>
        <RecordedDischargeMilestones
          title={isPhone ? "Milestones" : undefined}
          milestones={[
            {
              label: "Expected discharge date",
              state: "complete",
              detail: recordedMoment(detailRelease.expectedAt, dayZero),
            },
            {
              label: "Release stage recorded",
              state: detailRelease.state === "expected" ? "pending" : "complete",
              detail: `${detailRelease.state.charAt(0).toUpperCase()}${detailRelease.state.slice(1)} · ${recordedMoment(detailRelease.confirmedAt, dayZero)}`,
            },
            // A4-23 (audit round 2): the phone shows the blocker panes together, so
            // the blocker is said once, in its own box below, not again as a milestone.
            ...(isPhone
              ? []
              : [
                  {
                    label: "Recorded discharge blocker",
                    state: detailRelease.blocker ? ("blocked" as const) : ("pending" as const),
                    detail: detailRelease.blocker ?? "No discharge blocker recorded",
                  },
                ]),
            {
              label: "Physical departure",
              state: detailRelease.state === "discharged" ? "complete" : "pending",
              detail:
                linkedReleaseRecord?.leftAt != null
                  ? recordedMoment(linkedReleaseRecord.leftAt, dayZero)
                  : detailRelease.state === "discharged"
                    ? "Departure recorded; time not recorded"
                    : "Not recorded",
            },
          ]}
        />
        {detailRelease.preparing ? (
          <p className={pageStyles.note}>
            Preparation recorded: {detailRelease.preparationNote ?? "Reason not recorded"}. This is informational and
            does not establish completion.
          </p>
        ) : null}
        <ReadyToLeave
          onCto={releaseOnCto}
          ticked={ticksFor(detailRelease.id)}
          onToggle={(itemId) => {
            const on = !ticksFor(detailRelease.id).includes(itemId);
            setTick(detailRelease.id, itemId, on);
            setReadyChange({ releaseId: detailRelease.id, itemId, ticked: on });
          }}
          lastChange={readyChange?.releaseId === detailRelease.id ? readyChange : null}
          onUndo={() => {
            if (readyChange) setTick(readyChange.releaseId, readyChange.itemId, !readyChange.ticked);
            setReadyChange(null);
          }}
          onDismiss={() => setReadyChange(null)}
        />
      </div>

      <div ref={panelRef} {...releasePanelProps("barriers")} className={releasePaneClass("barriers")}>
        <div ref={barrierRef} tabIndex={-1} className={redesign.focusTarget} aria-label="Barriers">
          {detailRelease.blocker ? (
            <div className={pageStyles.barrierBox}>
              <div className={pageStyles.barrierText}>
                <span className={pageStyles.barrierCause}>
                  <StatusGlyph tone="danger" size={9} />
                  {detailRelease.blocker}
                </span>
                <span className={pageStyles.secondary}>Recorded discharge blocker</span>
              </div>
            </div>
          ) : (
            <div className={pageStyles.barrierBox}>
              <span className={pageStyles.barrierCause}>
                <StatusGlyph tone="success" size={9} />
                No discharge blocker recorded
              </span>
              <p className={pageStyles.note}>Clinical, pharmacy and transit clearance are not recorded here.</p>
            </div>
          )}
        </div>
        <DischargeDependenciesPanel
          release={detailRelease}
          now={now}
          dayZero={dayZero}
          role={s.releaseActor.role}
          dispatch={s.dispatch}
        />
      </div>

      {isPhone ? (
        <button
          type="button"
          className={pageStyles.phMore}
          aria-expanded={phoneReleaseMore}
          onClick={() => setPhoneReleaseMore((open) => !open)}
        >
          {phoneReleaseMore ? "Hide transport and record" : "Show transport and record"}
        </button>
      ) : null}
      <div {...releasePanelProps("transport")} className={releasePaneClass("transport")}>
        <dl className={pageStyles.factList}>
          <dt>Booking reference</dt>
          <dd>Not recorded</dd>
          <dt>Provider</dt>
          <dd>Not recorded</dd>
          <dt>Unit</dt>
          <dd>{wardName}</dd>
        </dl>
      </div>

      <div {...releasePanelProps("dossier")} className={releasePaneClass("dossier")}>
        <dl className={pageStyles.factList}>
          <dt>{detailRelease.state === "discharged" ? "Recorded release" : "Expected release"}</dt>
          <dd>
            {recordedMoment(
              detailRelease.state === "discharged" ? detailRelease.confirmedAt : detailRelease.expectedAt,
              dayZero,
            )}
          </dd>
          {detailRelease.waitingOn && (
            <>
              <dt>Waiting on</dt>
              <dd>{detailRelease.waitingOn}</dd>
            </>
          )}
          {detailRelease.blocker && (
            <>
              <dt>Blocker</dt>
              <dd className={pageStyles.blocker}>{detailRelease.blocker}</dd>
            </>
          )}
          <dt>Last reported</dt>
          <dd>
            <WardFreshness
              confirmedAt={detailRelease.confirmedAt}
              confirmedByRole={detailRelease.confirmedBy}
              now={now}
            />
            <span className={pageStyles.secondary}>{recordedMoment(detailRelease.confirmedAt, dayZero)}</span>
          </dd>
          {detailRelease.preparing && (
            <>
              <dt>Bed preparation</dt>
              <dd>{detailRelease.preparationNote ?? "In progress · reason not recorded"}</dd>
            </>
          )}
        </dl>
      </div>
    </>
  );
}
