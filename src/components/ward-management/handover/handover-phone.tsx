"use client";

/**
 * The phone layout of the refined Handover page (shown at 48rem and narrower). Its own design, not
 * a squashed desktop: on the phone, Handover is "ISBAR for my shift". Print, filters and columns
 * stay on desktop. Patients are named by record and UMRN only, never by the journey id.
 */
import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, ClipboardCopy, FileText, PhoneCall, Share2, Users } from "lucide-react";
import {
  Button,
  Drawer,
  FolderTabs,
  Hero,
  HeroAct,
  HeroFigures,
  HeroQuickChips,
  HeroTop,
  folderTabClasses,
  heroChipClassName,
  Menu,
  type HeroActProps,
  FactGrid,
  FilterChip,
  Icon,
  PhoneSheet,
  PillTabs,
  SrOnly,
  StatusGlyph,
  StatusPill,
  cx,
  durMinutes,
  phoneRows,
  type SinceItem,
  type WfTone,
  FormalName,
} from "@/components/wf";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import type { ColumnContext } from "./handover-columns";
import {
  HANDOVER_SHIFTS,
  handoverStatusLabel,
  destinationText,
  groupOf,
  handoverAt,
  handoverHasPassed,
  isActOrUrgent,
  isbarLines,
  obsLong,
  nextStep,
  type HandoverPill,
  type HandoverRow,
  type HandoverShiftId,
  type HandoverWard,
  type RowGroup,
} from "./handover-model";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { handoverDeskOf, peopleToHandOver } from "./handover-desk";
import styles from "./handover-phone.module.css";
import pageTop from "../page-top-title.module.css";
import { HandoverShiftMenu, HandoverSinceLine } from "./handover-glance";
import parts from "./handover-sheet-parts.module.css";
import { HandoverBeds } from "./handover-beds";

export type HandoverPhoneProps = {
  shift: HandoverShiftId;
  onShift: (id: HandoverShiftId) => void;
  now: Instant;
  /** Meeting-order groups (act, due, bed, acc, mov) with their titles. */
  groups: RowGroup[];
  /** Rows in scope. */
  rows: HandoverRow[];
  /** Wards in scope. */
  wards: HandoverWard[];
  ctx: ColumnContext;
  pill: HandoverPill | null;
  onPill: (pill: HandoverPill) => void;
  isHighlighted: (row: HandoverRow) => boolean;
  onClearHighlight: () => void;
  signedAt: Instant | null;
  onCopySummary: () => void;
  copied: boolean;
  onShowSignOff: () => void;
  onPick: (movementId: string) => void;
  drawerOpen: boolean;
  onCloseDrawer: () => void;
  flowPanel: ReactNode | null;
  signOffPanel: ReactNode;
  /** Lead-REC-E-1: false for a desk that can never sign this handover off (the site bed manager). */
  signOffOffered?: boolean;
  journeyUnavailable?: boolean;
  /** Act-now patients the scope leaves out, so narrowing never hides them from the handover. */
  outsideAct: HandoverRow[];
  /** The patient whose ISBAR is open, if any. */
  selected?: HandoverRow;
  onCopyIsbar: (row: HandoverRow) => void;
  patientHrefOf: (row: HandoverRow) => string | undefined;
  /** The preceding handover boundary and what changed since. */
  since: string;
  sinceItems: SinceItem[];
  onCopySince: () => void;
  /** Open promises and callbacks to carry over, shown under the Since previous handover card. */
  carryOver?: ReactNode;
  /** Fable batch 3: shown on the Patients tab only, after the carry-over ("To review before handover"). */
  patientsExtra?: ReactNode;
  /** The On-call page, when this desk can open it: the chip row's last chip. */
  onCallHref?: string;
  /** Bumped when a sign-off check asks for the Beds tab (audit four item 20). */
  bedsAsk?: number;
  /** Highlight chips with their counts. */
  chips: { id: string; label: string; count: number; pressed: boolean; onToggle: () => void }[];
  /** The meeting timer, as on desktop. */
  meetingOn: boolean;
  onToggleMeeting: () => void;
  /** Feature 15: opens the Shift digest sheet. */
  onOpenDigest?: () => void;
  history: ReactNode;
  /** Q61 to Q63: the site bed manager's site sign-off, first on the sheet tab only, so opening a ward lands on its
   * sheet; null for any other desk. */
  siteSignOff?: ReactNode;
  /** Page tops: the ward replies act row (overdue first); its button takes the reader to the replies card. */
  promisesAct?: HeroActProps;
};

type PhoneTab = "pts" | "beds" | "hist";

const GROUP_TONE: Record<string, WfTone> = {
  act: "danger",
  urg: "danger",
  due: "warning",
  rel: "warning",
  bed: "neutral",
  acc: "neutral",
  mov: "info",
  out: "danger",
};

/** Act now, Flagged urgent and Due show full cards and start open; the other groups are compact and start closed. */
const CARD_GROUPS = new Set(["act", "urg", "due", "out"]);

/* ------------------------------------------------------------------ patients */

function Tier({ tier }: { tier: number }) {
  return (
    <span className={styles.tier}>
      <span aria-hidden="true">T{tier}</span>
      <SrOnly>Tier {tier}</SrOnly>
    </span>
  );
}

/** A dense patient row (v10): tier and name, the route, the next step, the wait and the owner. */
function PatientRow({
  row,
  ctx,
  highlighted,
  onPick,
}: {
  row: HandoverRow;
  ctx: ColumnContext;
  highlighted: boolean;
  onPick: (movementId: string) => void;
}) {
  const step = nextStep(row, ctx.now, ctx.cutoff, ctx.readyBeds);
  const act = isActOrUrgent(row, ctx.now);
  return (
    <button
      type="button"
      className={`${styles.prow} ${highlighted ? styles.hl : ""}`}
      data-act={act ? "true" : undefined}
      onClick={() => onPick(row.id)}
      data-testid="ward-handover-phone-row"
    >
      <span className={styles.prowText}>
        <span className={styles.prowTop}>
          <Tier tier={row.tier} />
          <b className={styles.prowName}>
            <FormalName name={row.name} />
          </b>
          {highlighted ? <SrOnly>, highlighted</SrOnly> : null}
        </span>
        {/* Audit A4-28: the UMRN on every phone row, as on desktop, so two people of one name differ. */}
        <span className={styles.prowLine}>
          <span className={styles.prowUmrn}>{row.umrn}</span> · {row.edShort} to {destinationText(row)}
        </span>
        <span className={`${styles.prowLine} ${styles.prowNext}`}>
          {step.tone === "act" ? (
            <StatusGlyph tone="danger" size={9} />
          ) : step.tone === "due" ? (
            <StatusGlyph tone="warning" size={9} />
          ) : null}
          <span className={styles.trunc}>{step.text}</span>
        </span>
      </span>
      <span className={styles.prowEnd}>
        <b className={styles.wait}>
          <SrOnly>Waiting </SrOnly>
          {durMinutes(ctx.now - row.openedAt)}
        </b>
        <span className={styles.prowOwner}>{row.ownerShort}</span>
      </span>
    </button>
  );
}

function GroupSection({
  group,
  open,
  onToggle,
  ctx,
  isHighlighted,
  onPick,
}: {
  group: RowGroup;
  open: boolean;
  onToggle: () => void;
  ctx: ColumnContext;
  isHighlighted: (row: HandoverRow) => boolean;
  onPick: (movementId: string) => void;
}) {
  const bodyId = `ward-handover-phone-group-${group.id}`;
  return (
    <section className={styles.sec} aria-label={group.title}>
      <button type="button" className={styles.secHead} aria-expanded={open} aria-controls={bodyId} onClick={onToggle}>
        <StatusGlyph tone={GROUP_TONE[group.id] ?? "neutral"} />
        <span className={styles.secTitle}>{group.title}</span>
        <b className={styles.secCount}>{group.rows.length}</b>
        <span className={styles.spacer} />
        <Icon icon={ChevronDown} size={16} className={styles.chev} />
      </button>
      {open ? (
        <div id={bodyId} className={styles.list}>
          {group.rows.map((row) => (
            <PatientRow key={row.id} row={row} ctx={ctx} highlighted={isHighlighted(row)} onPick={onPick} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

/** One patient's ISBAR as a bottom sheet, with Patient and Copy ISBAR in its footer. */
function IsbarSheet({
  row,
  ctx,
  onClose,
  onCopy,
  patientHref,
}: {
  row: HandoverRow;
  ctx: ColumnContext;
  onClose: () => void;
  onCopy: () => void;
  patientHref: string | undefined;
}) {
  const router = useRouter();
  const step = nextStep(row, ctx.now, ctx.cutoff, ctx.readyBeds);
  return (
    <PhoneSheet
      open
      onClose={onClose}
      title={row.name}
      description={
        <span className={styles.isbarMeta}>
          <span className={styles.mono}>{row.umrn}</span>
          {row.formCode ? ` · Form ${row.formCode}` : ""}
        </span>
      }
      height="tall"
      primary={{ label: "Copy for handover", onAction: onCopy }}
      secondary={
        patientHref
          ? { label: "Patient page", onAction: () => router.push(patientHref) }
          : { label: "Patient page", onAction: () => undefined, disabledReason: "No patient record is linked" }
      }
      data-testid="ward-handover-phone-isbar"
    >
      <div className={styles.isbarBody}>
        <div className={styles.isbarPills}>
          <StatusPill tone={step.tone === "act" ? "danger" : step.tone === "due" ? "warning" : undefined} size="sm">
            {handoverStatusLabel(row)}
          </StatusPill>
          <StatusPill size="sm">T{row.tier}</StatusPill>
          <StatusPill size="sm">waiting {durMinutes(ctx.now - row.openedAt)}</StatusPill>
        </div>
        <FactGrid
          facts={[
            { id: "from", label: "From", value: row.edShort },
            { id: "to", label: "To", value: destinationText(row) },
            { id: "owner", label: "Owner", value: row.ownerShort },
            { id: "obs", label: "Obs", value: obsLong(row) },
          ]}
        />
        <h3 className={styles.isbarHead}>ISBAR</h3>
        <dl className={styles.isbar}>
          {isbarLines(row, ctx.now, ctx.readyBeds, ctx.dayZero).map((line) => (
            <div key={line.key}>
              <dt>
                <b aria-hidden="true">{line.key}</b>
                <span>{line.label}</span>
              </dt>
              <dd>{line.text}</dd>
            </div>
          ))}
        </dl>
      </div>
    </PhoneSheet>
  );
}

/* ------------------------------------------------------------------ page */

export function HandoverPhone({
  shift,
  onShift,
  now,
  groups,
  rows,
  wards,
  ctx,
  pill,
  onPill,
  isHighlighted,
  onClearHighlight,
  signedAt,
  onCopySummary,
  copied,
  onShowSignOff,
  onPick,
  drawerOpen,
  onCloseDrawer,
  flowPanel,
  signOffPanel,
  signOffOffered = true,
  journeyUnavailable,
  outsideAct,
  selected,
  onCopyIsbar,
  patientHrefOf,
  since,
  sinceItems,
  onCopySince,
  carryOver,
  patientsExtra,
  onCallHref,
  chips,
  meetingOn,
  onToggleMeeting,
  onOpenDigest,
  history,
  siteSignOff,
  promisesAct,
  bedsAsk = 0,
}: HandoverPhoneProps) {
  // Role branches: the nurse in charge's one ward, and the ED desk (no Beds tab, no sign-off).
  const { ownWard, edDesk } = handoverDeskOf(
    useEffectiveWardAccess(),
    wards.map((ward) => ward.unit),
  );
  const [tab, setTab] = useState<PhoneTab>("pts");
  // Audit four item 20: a sign-off check's "Check counts" opens this sheet's Beds tab, as on desktop.
  const [seenBedsAsk, setSeenBedsAsk] = useState(bedsAsk);
  if (bedsAsk !== seenBedsAsk) {
    setSeenBedsAsk(bedsAsk);
    if (!edDesk) setTab("beds");
  }
  const [sinceOpen, setSinceOpen] = useState(false);
  /** Sections the user has opened or closed, over each group's default. */
  const [toggled, setToggled] = useState<Record<string, boolean>>({});

  const at = handoverAt(shift, now);
  const passed = handoverHasPassed(shift, now);
  const actCount = rows.filter((row) => groupOf(row, ctx.now, ctx.cutoff) === "act").length;
  const urgentCount = rows.filter((row) => groupOf(row, ctx.now, ctx.cutoff) === "urg").length;
  const dueCount = rows.filter((row) => groupOf(row, ctx.now, ctx.cutoff) === "due").length;
  const readyCount = wards.reduce((total, ward) => total + ward.ready, 0);
  const highlightedCount = rows.filter(isHighlighted).length;
  const clock = formatInstantWithDay(at, now);

  const isOpen = (id: string) => toggled[id] ?? CARD_GROUPS.has(id);

  return (
    <div className={styles.phone} data-testid="ward-handover-phone" data-ward-design="v10">
      <Hero
        level={1}
        testId="ward-handover-phone-hero"
        // Design review (27 Nov 2026): the Which handover pill sits at the title row's right end.
        className={cx(pageTop.hero, folderTabClasses.hero, styles.heroShiftEnd)}
        // A4-29 (audit round 2): the title counts every row listed under Act now, Urgent and Due, so it
        // agrees with the figures beneath it.
        title={
          <>
            {ownWard
              ? peopleToHandOver(actCount + urgentCount + dueCount)
              : `${actCount + urgentCount + dueCount} to hand over`}
          </>
        }
        aside={
          // Locked A28: one menu for Which handover, the desktop's pill (it replaces the sheet and its chip).
          <HandoverShiftMenu
            shift={shift}
            now={now}
            label={{ clock, words: HANDOVER_SHIFTS.find((item) => item.id === shift)?.label ?? "" }}
            onChange={onShift}
          />
        }
      >
        <HeroTop
          figures={
            <HeroFigures
              // Help's "Start with Act now" lights these figures (the old count strip's id).
              testId="ward-handover-kpi-strip"
              items={[
                { id: "act", value: actCount, label: "act now", onClick: () => onPill("act"), pressed: pill === "act" },
                {
                  id: "urg",
                  value: urgentCount,
                  label: "urgent",
                  onClick: () => onPill("urg"),
                  pressed: pill === "urg",
                },
                {
                  id: "due",
                  value: dueCount,
                  label: `due by ${formatInstantWithDay(ctx.cutoff, now)}`,
                  onClick: () => onPill("due"),
                  pressed: pill === "due",
                },
              ]}
            />
          }
          act={promisesAct ? <HeroAct {...promisesAct} /> : undefined}
          chips={
            <HeroQuickChips
              label="Handover actions"
              items={[
                {
                  id: "meeting",
                  label: meetingOn ? "Timer on" : "Meeting timer",
                  icon: <Users strokeWidth={1.75} aria-hidden="true" />,
                  pressed: meetingOn,
                  testId: "ward-handover-phone-meeting",
                  onClick: onToggleMeeting,
                },
                // Audit four item 101 (A3-28, locked A28): the outputs sit under one Share chip, as on
                // desktop: the Shift digest and Copy for handover. Copy left the bottom bar.
                {
                  id: "share",
                  label: "Share",
                  node: (
                    <Menu
                      label="Share"
                      // Gate r10 F4: right-aligned to the chip, so the menu stays inside the phone gutter;
                      // same order as desktop (the output first, then the pack).
                      align="end"
                      items={[
                        {
                          id: "copy",
                          label: (
                            <span data-testid="ward-handover-phone-copy">
                              {copied ? "Copied" : "Copy for handover"}
                            </span>
                          ),
                          icon: copied ? Check : ClipboardCopy,
                          onSelect: onCopySummary,
                        },
                        ...(onOpenDigest
                          ? [
                              {
                                id: "digest",
                                label: <span data-testid="ward-handover-phone-digest">Shift digest</span>,
                                icon: FileText,
                                onSelect: onOpenDigest,
                              },
                            ]
                          : []),
                      ]}
                      trigger={(props) => (
                        <button
                          type="button"
                          {...props}
                          className={heroChipClassName}
                          data-testid="ward-handover-phone-share"
                        >
                          <Share2 size={16} strokeWidth={1.75} aria-hidden="true" />
                          <span>Share</span>
                          <ChevronDown size={14} strokeWidth={1.75} aria-hidden="true" />
                        </button>
                      )}
                    />
                  ),
                },
                // Fable batch 3: the On-call chip ends the row, as on desktop. It is a page, not an output.
                ...(onCallHref
                  ? [
                      {
                        id: "on-call",
                        label: "On-call",
                        icon: <PhoneCall strokeWidth={1.75} aria-hidden="true" />,
                        href: onCallHref,
                        testId: "ward-handover-on-call",
                      },
                    ]
                  : []),
              ]}
            />
          }
        >
          <HandoverSinceLine
            since={since}
            items={sinceItems}
            onOpen={() => setSinceOpen(true)}
            signOffNote={
              edDesk
                ? // ROLE BRANCH (ed): this desk cannot sign off, so the line says who does, or when it was signed.
                  signedAt !== null
                  ? `Signed off ${formatInstantWithDay(signedAt, now)}`
                  : "Coordinator or ward signs off"
                : null
            }
          />
        </HeroTop>
      </Hero>
      <FolderTabs label="Handover views" value={tab} testId="ward-handover-phone-tabs" className={styles.folder}>
        <PillTabs<PhoneTab>
          label="Handover views"
          className={folderTabClasses.switch}
          value={tab}
          onChange={setTab}
          idPrefix="ward-handover-phone"
          items={[
            { id: "pts", label: "Patients", count: rows.length },
            ...(edDesk ? [] : [{ id: "beds" as const, label: "Beds", count: readyCount }]),
            { id: "hist", label: "History" },
          ]}
        />
      </FolderTabs>

      <div className={styles.main}>
        {tab === "pts" ? siteSignOff : null}
        {/* Fable batch 3: on Beds, "Beds now" comes first; the carry-over stays on the other tabs. */}
        {tab === "beds" ? null : carryOver}
        {tab === "pts" ? patientsExtra : null}

        {tab === "pts" ? (
          <div
            role="tabpanel"
            id="ward-handover-phone-panel-pts"
            aria-labelledby="ward-handover-phone-tab-pts"
            className={styles.panel}
          >
            <div className={cx(styles.chips, phoneRows.chipRow, parts.phChipRow)} role="group" aria-label="Highlight">
              {chips.map((chip) => (
                <FilterChip
                  key={chip.id}
                  pressed={chip.pressed}
                  onPressedChange={chip.onToggle}
                  className={cx(styles.chip, phoneRows.chip, chip.count === 0 && phoneRows.zero)}
                >
                  <b className={styles.chipCount}>{chip.count}</b>
                  {/* Triangle guard (3 Nov 2026): no act-now triangle on a filter chip; the rows carry it. */}
                  {chip.label}
                </FilterChip>
              ))}
            </div>
            {passed ? (
              <div className={styles.banner} role="note">
                <StatusGlyph tone="closed" size={9} />
                <span>{clock} has passed. Showing the board now.</span>
              </div>
            ) : null}
            {pill !== null || highlightedCount > 0 ? (
              <div className={styles.banner} role="status">
                <StatusGlyph tone="neutral" size={9} />
                <span className={styles.bannerText}>
                  <b>{highlightedCount}</b> synthetic rows highlighted, all rows stay
                </span>
                <Button variant="ghost" size="sm" className={styles.bannerAction} onClick={onClearHighlight}>
                  Clear
                </Button>
              </div>
            ) : null}
            {rows.length === 0 ? <p className={styles.empty}>No open journeys in this scope.</p> : null}
            <div className={styles.listCard}>
              {groups
                .filter((group) => group.rows.length > 0)
                .map((group) => (
                  <GroupSection
                    key={group.id}
                    group={group}
                    open={isOpen(group.id)}
                    onToggle={() => setToggled((prev) => ({ ...prev, [group.id]: !isOpen(group.id) }))}
                    ctx={ctx}
                    isHighlighted={isHighlighted}
                    onPick={onPick}
                  />
                ))}
              {outsideAct.length ? (
                <GroupSection
                  group={{
                    id: "out",
                    title: "Act now outside this scope",
                    why: "Left out by the scope, never hidden from the handover",
                    rows: outsideAct,
                  }}
                  open={isOpen("out")}
                  onToggle={() => setToggled((prev) => ({ ...prev, out: !isOpen("out") }))}
                  ctx={ctx}
                  isHighlighted={isHighlighted}
                  onPick={onPick}
                />
              ) : null}
            </div>
          </div>
        ) : tab === "beds" ? (
          <div
            role="tabpanel"
            id="ward-handover-phone-panel-beds"
            aria-labelledby="ward-handover-phone-tab-beds"
            className={styles.panel}
          >
            {/* Batch 3 (one Handover): the phone's Beds tab is the same "Beds now" card, stacked.
                The older BedsView stays in this file, unused. */}
            <HandoverBeds rows={rows} wards={wards} held={[]} now={now} onOpenPatient={onPick} />
          </div>
        ) : (
          <div
            role="tabpanel"
            id="ward-handover-phone-panel-hist"
            aria-labelledby="ward-handover-phone-tab-hist"
            className={styles.panel}
          >
            {history}
          </div>
        )}

        <p className={`${styles.note} ${styles.phPageNote}`}>Synthetic data. Not approved for clinical use.</p>
      </div>

      {/* Audit four item 101: the bottom bar holds Sign off alone, one full-width filled button; a desk
          that does not sign off has no bar. The copy result is still said to a screen reader. */}
      <SrOnly role="status">{copied ? "Summary copied" : ""}</SrOnly>
      {edDesk || !signOffOffered ? null : (
        <div className={styles.sticky}>
          <Button
            variant="pri"
            icon={Check}
            className={styles.stickyButton}
            onClick={onShowSignOff}
            data-testid="ward-handover-phone-sign-off"
          >
            {signedAt !== null ? `Signed ${formatInstantWithDay(signedAt, now)}` : "Sign off"}
          </Button>
        </div>
      )}

      <PhoneSheet
        open={sinceOpen}
        onClose={() => setSinceOpen(false)}
        title="Since previous handover"
        description={`Previous handover at ${since}`}
        primary={{
          label: "Copy for handover",
          onAction: onCopySince,
        }}
        data-testid="ward-handover-phone-since-sheet"
      >
        {sinceItems.length === 0 ? (
          <p className={styles.empty}>Nothing has changed since {since}.</p>
        ) : (
          <ul className={styles.digest}>
            {sinceItems.map((item) => (
              <li key={item.id}>
                <span className={styles.digestFigure}>
                  {item.tone ? <StatusGlyph tone={item.tone} size={12} /> : null}
                  {item.value}
                </span>
                <span className={styles.digestText}>
                  <b>{item.word}</b>
                  {item.detail ? <span>{item.detail}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </PhoneSheet>

      {drawerOpen && selected && flowPanel ? (
        <IsbarSheet
          row={selected}
          ctx={ctx}
          onClose={onCloseDrawer}
          onCopy={() => onCopyIsbar(selected)}
          patientHref={patientHrefOf(selected)}
        />
      ) : edDesk || !signOffOffered ? null : (
        <Drawer
          open={drawerOpen && !flowPanel}
          onClose={onCloseDrawer}
          title={journeyUnavailable ? "Journey no longer open" : "Sign off"}
          testId="ward-handover-phone-drawer"
        >
          {signOffPanel}
        </Drawer>
      )}
    </div>
  );
}
