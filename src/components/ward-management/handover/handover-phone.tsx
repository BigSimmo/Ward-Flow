"use client";

/**
 * The phone layout of the refined Handover page (shown at 48rem and narrower). Its own design, not
 * a squashed desktop: on the phone, Handover is "ISBAR for my shift". Print, filters and columns
 * stay on desktop. Patients are named by record and UMRN only, never by the journey id.
 */
import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, ChevronRight, ClipboardCopy, Clock, Eye, Timer } from "lucide-react";
import {
  Button,
  Count,
  Drawer,
  FactGrid,
  FilterChip,
  Icon,
  PhoneHero,
  PhoneSheet,
  PillTabs,
  Sheet,
  SrOnly,
  StatusGlyph,
  StatusPill,
  durMinutes,
  type SinceItem,
  type WfTone,
} from "@/components/wf";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { rowTone, type ColumnContext } from "./handover-columns";
import {
  HANDOVER_SHIFTS,
  STAGE_LABEL,
  destinationText,
  dueShort,
  groupOf,
  handoverAt,
  handoverHasPassed,
  handoverShift,
  isActNow,
  isWaitingForBed,
  isbarLines,
  nextStep,
  wardIsStale,
  type HandoverPill,
  type HandoverRow,
  type HandoverShiftId,
  type HandoverWard,
  type RowGroup,
} from "./handover-model";
import styles from "./handover-phone.module.css";

export type HandoverPhoneProps = {
  shift: HandoverShiftId;
  onShift: (id: HandoverShiftId) => void;
  now: Instant;
  scopeLabel: string;
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
  /** Act-now patients the scope leaves out, so narrowing never hides them from the handover. */
  outsideAct: HandoverRow[];
  /** The patient whose ISBAR is open, if any. */
  selected?: HandoverRow;
  onCopyIsbar: (row: HandoverRow) => void;
  patientHrefOf: (row: HandoverRow) => string | undefined;
  /** Since you looked (v10): the window start and what changed since. */
  since: string;
  sinceItems: SinceItem[];
  onCopySince: () => void;
  /** Highlight chips with their counts. */
  chips: { id: string; label: string; count: number; pressed: boolean; onToggle: () => void }[];
  /** The meeting timer, as on desktop. */
  meetingOn: boolean;
  onToggleMeeting: () => void;
  history: ReactNode;
};

type PhoneTab = "pts" | "beds" | "hist";

const GROUP_TONE: Record<string, WfTone> = {
  act: "danger",
  due: "warning",
  bed: "neutral",
  acc: "neutral",
  mov: "info",
  out: "danger",
};

/** Act now and Due show full cards and start open; the other groups are compact and start closed. */
const CARD_GROUPS = new Set(["act", "due", "out"]);

function relative(at: Instant, now: Instant): string {
  return at <= now ? `Passed ${durMinutes(now - at)} ago` : `In ${durMinutes(at - now)}`;
}

/* ------------------------------------------------------------------ shift sheet */

function ShiftSheet({
  open,
  shift,
  now,
  onShift,
  onClose,
}: {
  open: boolean;
  shift: HandoverShiftId;
  now: Instant;
  onShift: (id: HandoverShiftId) => void;
  onClose: () => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title="Which handover" testId="ward-handover-phone-shift-sheet">
      <div role="radiogroup" aria-label="Which handover" className={styles.shiftList}>
        {HANDOVER_SHIFTS.map((item) => {
          const at = handoverAt(item.id, now);
          const checked = item.id === shift;
          return (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={checked}
              className={styles.shiftOption}
              onClick={() => {
                onShift(item.id);
                onClose();
              }}
            >
              <b className={styles.shiftOptionTime}>{formatInstantWithDay(at, now)}</b>
              <span className={styles.shiftOptionText}>
                <b>{item.label}</b>
                <span>{relative(at, now)}</span>
              </span>
              {checked ? <Icon icon={Check} size={16} className={styles.shiftOptionCheck} /> : null}
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}

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
  const act = isActNow(row, ctx.now);
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
          <b className={styles.prowName}>{row.name}</b>
          {highlighted ? <SrOnly>, highlighted</SrOnly> : null}
        </span>
        <span className={styles.prowLine}>
          {row.edShort} to {destinationText(row)}
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
      primary={{ label: "Copy ISBAR", onAction: onCopy }}
      secondary={
        patientHref
          ? { label: "Patient", onAction: () => router.push(patientHref) }
          : { label: "Patient", onAction: () => undefined, disabledReason: "No patient record is linked" }
      }
      data-testid="ward-handover-phone-isbar"
    >
      <div className={styles.isbarBody}>
        <div className={styles.isbarPills}>
          <StatusPill tone={step.tone === "act" ? "danger" : step.tone === "due" ? "warning" : undefined} size="sm">
            {STAGE_LABEL[row.stage]}
          </StatusPill>
          <StatusPill size="sm">T{row.tier}</StatusPill>
          <StatusPill size="sm">waiting {durMinutes(ctx.now - row.openedAt)}</StatusPill>
        </div>
        <FactGrid
          facts={[
            { id: "from", label: "From", value: row.edShort },
            { id: "to", label: "To", value: destinationText(row) },
            { id: "owner", label: "Owner", value: row.ownerShort },
            { id: "obs", label: "Obs", value: row.obs === "Standard" ? "Standard obs" : row.obs },
          ]}
        />
        <h3 className={styles.isbarHead}>ISBAR</h3>
        <dl className={styles.isbar}>
          {isbarLines(row, ctx.now).map((line) => (
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

/* ------------------------------------------------------------------ beds */

function WardRow({ ward, incoming, now }: { ward: HandoverWard; incoming: number; now: Instant }) {
  const stale = wardIsStale(ward, now);
  return (
    <div className={styles.wardRow}>
      <span className={styles.phoneWardName}>
        <b>{ward.name}</b>
        <span className={styles.wardSub}>
          <span className={styles.trunc}>
            <b>{ward.pendingPreparation}</b> being made ready · <b>{ward.holds}</b> held · <b>{incoming}</b> incoming
          </span>
          {stale ? (
            <span className={styles.stale}>
              <StatusGlyph tone="warning" size={8} />
              {durMinutes(now - ward.confirmedAt)} ago
              <SrOnly>, feed over 15 min</SrOnly>
            </span>
          ) : null}
        </span>
      </span>
      <span className={styles.readyCell}>
        <b className={`${styles.ready} ${ward.ready > 0 ? styles.readyOn : ""}`}>{ward.ready}</b>
        <span className={styles.readyWord}>ready</span>
      </span>
    </div>
  );
}

/** Beds (v10 phone): wards grouped by service, each with what is ready, held and incoming. */
function BedsView({ rows, wards, now }: { rows: HandoverRow[]; wards: HandoverWard[]; now: Instant }) {
  const services = [...new Set(wards.map((ward) => ward.service))];
  const incomingTo = (ward: HandoverWard) => rows.filter((row) => row.to?.unitId === ward.id).length;
  return (
    <div className={styles.beds} data-testid="ward-handover-phone-beds">
      {wards.length === 0 ? <p className={styles.empty}>No ward in this scope.</p> : null}
      {wards.length ? (
        <div className={styles.listCard}>
          {services.map((service) => {
            const list = wards
              .filter((ward) => ward.service === service)
              .sort((a, b) => b.ready - a.ready || a.name.localeCompare(b.name));
            const ready = list.reduce((total, ward) => total + ward.ready, 0);
            return (
              <section key={service} className={styles.sec} aria-label={String(service)}>
                <h3 className={`${styles.secHead} ${styles.secHeadStatic}`}>
                  <span className={styles.secTitle}>{service}</span>
                  <b className={styles.secCount}>{ready}</b>
                  <span className={styles.secTitle}>ready</span>
                </h3>
                <div className={styles.list}>
                  {list.map((ward) => (
                    <WardRow key={ward.id} ward={ward} incoming={incomingTo(ward)} now={now} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ page */

export function HandoverPhone({
  shift,
  onShift,
  now,
  scopeLabel,
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
  outsideAct,
  selected,
  onCopyIsbar,
  patientHrefOf,
  since,
  sinceItems,
  onCopySince,
  chips,
  meetingOn,
  onToggleMeeting,
  history,
}: HandoverPhoneProps) {
  const [tab, setTab] = useState<PhoneTab>("pts");
  const [shiftSheetOpen, setShiftSheetOpen] = useState(false);
  const [sinceOpen, setSinceOpen] = useState(false);
  /** Sections the user has opened or closed, over each group's default. */
  const [toggled, setToggled] = useState<Record<string, boolean>>({});

  const current = handoverShift(shift);
  const at = handoverAt(shift, now);
  const passed = handoverHasPassed(shift, now);
  const actCount = rows.filter((row) => groupOf(row, ctx.now, ctx.cutoff) === "act").length;
  const dueCount = rows.filter((row) => groupOf(row, ctx.now, ctx.cutoff) === "due").length;
  const waitCount = rows.filter(isWaitingForBed).length;
  const readyCount = wards.reduce((total, ward) => total + ward.ready, 0);
  const highlightedCount = rows.filter(isHighlighted).length;
  const clock = formatInstantWithDay(at, now);
  const countdown = `${passed ? "passed" : "in"} ${durMinutes(Math.abs(at - now))}${passed ? " ago" : ""}`;
  const sinceShown = sinceItems.filter((item) => item.id !== "opened");

  const isOpen = (id: string) => toggled[id] ?? CARD_GROUPS.has(id);

  return (
    <div className={styles.phone} data-testid="ward-handover-phone" data-ward-design="v10">
      <PhoneHero
        level={1}
        data-testid="ward-handover-phone-hero"
        eyebrow={`${clock} ${current.label.toLowerCase()} · ${scopeLabel.toLowerCase()}`}
        chip={<span className={styles.heroCountdown}>{countdown}</span>}
        title={`${dueCount} to hand over`}
        sub={
          signedAt !== null
            ? `Signed ${formatInstantWithDay(signedAt, now)} · ${readyCount} beds ready across ${scopeLabel.toLowerCase()}`
            : `${readyCount} beds ready across ${scopeLabel.toLowerCase()}`
        }
        figures={[
          {
            id: "act",
            value: actCount,
            label: "Act now",
            tone: "danger",
            pressed: pill === "act",
            onPress: () => onPill("act"),
          },
          {
            id: "due",
            value: dueCount,
            label: `Due ${formatInstantWithDay(ctx.cutoff, now)}`,
            tone: "warning",
            pressed: pill === "due",
            onPress: () => onPill("due"),
          },
          {
            id: "bed",
            value: waitCount,
            label: "Waiting",
            tone: "neutral",
            pressed: pill === "bed",
            onPress: () => onPill("bed"),
          },
        ]}
        actions={
          <div className={styles.heroActions}>
            <Button
              variant="onHero"
              icon={Clock}
              aria-haspopup="dialog"
              aria-expanded={shiftSheetOpen}
              onClick={() => setShiftSheetOpen(true)}
              data-testid="ward-handover-phone-shift"
            >
              Change handover
            </Button>
            <Button
              variant="onHero"
              iconOnly
              icon={Timer}
              aria-pressed={meetingOn}
              aria-label={meetingOn ? "Stop the meeting timer" : "Start the meeting timer"}
              onClick={onToggleMeeting}
            />
          </div>
        }
      />

      <div className={styles.main}>
        <button
          type="button"
          className={styles.sinceCard}
          aria-haspopup="dialog"
          onClick={() => setSinceOpen(true)}
          data-testid="ward-handover-phone-since"
        >
          <Icon icon={Eye} size={16} />
          <span className={styles.sinceText}>
            <span className={styles.sinceTitle}>Since you looked at {since}</span>
            <span className={styles.sinceMeta}>
              {sinceShown.map((item, index) => (
                <span key={item.id}>
                  {index ? " · " : ""}
                  <b>{item.value}</b> {item.word}
                </span>
              ))}
            </span>
          </span>
          <Icon icon={ChevronRight} size={16} className={styles.chev} />
        </button>

        <div className={styles.seg}>
          <PillTabs<PhoneTab>
            label="Handover views"
            value={tab}
            onChange={setTab}
            idPrefix="ward-handover-phone"
            fill
            items={[
              { id: "pts", label: "Patients", count: rows.length },
              { id: "beds", label: "Beds" },
              { id: "hist", label: "History" },
            ]}
          />
        </div>

        {tab === "pts" ? (
          <div
            role="tabpanel"
            id="ward-handover-phone-panel-pts"
            aria-labelledby="ward-handover-phone-tab-pts"
            className={styles.panel}
          >
            <div className={styles.chips} role="group" aria-label="Highlight">
              {chips.map((chip) => (
                <FilterChip
                  key={chip.id}
                  pressed={chip.pressed}
                  onPressedChange={chip.onToggle}
                  className={styles.chip}
                >
                  <b className={styles.chipCount}>{chip.count}</b>
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
            <p className={styles.note}>Print, filters and columns are on desktop</p>
          </div>
        ) : tab === "beds" ? (
          <div
            role="tabpanel"
            id="ward-handover-phone-panel-beds"
            aria-labelledby="ward-handover-phone-tab-beds"
            className={styles.panel}
          >
            <BedsView rows={rows} wards={wards} now={now} />
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

        <p className={`${styles.note} ${styles.phPageNote}`}>Synthetic data. Not a medical device.</p>
      </div>

      <div className={styles.sticky}>
        <Button
          variant="sec"
          icon={copied ? Check : ClipboardCopy}
          className={styles.stickyButton}
          onClick={onCopySummary}
          data-testid="ward-handover-phone-copy"
        >
          {copied ? "Copied" : "Copy summary"}
        </Button>
        <Button
          variant="pri"
          icon={Check}
          className={styles.stickyButton}
          onClick={onShowSignOff}
          data-testid="ward-handover-phone-sign-off"
        >
          {signedAt !== null ? `Signed ${formatInstantWithDay(signedAt, now)}` : "Sign off"}
        </Button>
        <SrOnly role="status">{copied ? "Summary copied" : ""}</SrOnly>
      </div>

      <ShiftSheet
        open={shiftSheetOpen}
        shift={shift}
        now={now}
        onShift={onShift}
        onClose={() => setShiftSheetOpen(false)}
      />

      <PhoneSheet
        open={sinceOpen}
        onClose={() => setSinceOpen(false)}
        title="Since you looked"
        description={`Your last look at ${since}`}
        primary={{
          label: "Copy as handover text",
          onAction: onCopySince,
        }}
        secondary={{ label: "Done", onAction: () => setSinceOpen(false) }}
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
      ) : (
        <Drawer
          open={drawerOpen && !flowPanel}
          onClose={onCloseDrawer}
          title="Sign off"
          testId="ward-handover-phone-drawer"
        >
          {signOffPanel}
        </Drawer>
      )}
    </div>
  );
}
