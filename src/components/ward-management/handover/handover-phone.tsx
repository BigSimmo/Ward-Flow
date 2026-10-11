"use client";

/**
 * The phone layout of the refined Handover page (shown at 48rem and narrower). Its own design, not
 * a squashed desktop: on the phone, Handover is "ISBAR for my shift". Print, filters and columns
 * stay on desktop. Patients are named by record and UMRN only, never by the journey id.
 */
import { useState, type ReactNode } from "react";
import { Check, ChevronDown, ClipboardCopy } from "lucide-react";
import {
  Button,
  Count,
  Drawer,
  Icon,
  Sheet,
  SrOnly,
  StatusGlyph,
  Tabs,
  durMinutes,
  type WfTone,
} from "@/components/wf";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { rowTone, type ColumnContext } from "./handover-columns";
import {
  HANDOVER_SHIFTS,
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
};

type PhoneTab = "pts" | "beds";

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

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

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

function PatientCard({
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
  const lines = isbarLines(row, ctx.now).filter((line) => line.key === "I" || line.key === "S" || line.key === "R");
  return (
    <article
      className={`${styles.card} ${highlighted ? styles.hl : ""}`}
      data-act={isActNow(row, ctx.now) ? "true" : undefined}
      data-testid="ward-handover-phone-card"
    >
      <header className={styles.cardHead}>
        <StatusGlyph tone={rowTone(row, ctx)} />
        <button type="button" className={styles.cardButton} onClick={() => onPick(row.id)}>
          <span className={styles.cardName}>{row.name}</span>
          {highlighted ? <SrOnly>, highlighted</SrOnly> : null}
        </button>
        <Tier tier={row.tier} />
        <span className={styles.spacer} />
        <b className={styles.wait}>
          <SrOnly>Waiting </SrOnly>
          {durMinutes(ctx.now - row.openedAt)}
        </b>
      </header>
      <div className={styles.cardRoute}>
        {row.edShort} to {destinationText(row)}
      </div>
      <div className={`${styles.nextBox} ${styles[`next_${step.tone}`]}`}>
        {step.tone === "act" ? (
          <StatusGlyph tone="danger" size={9} />
        ) : step.tone === "due" ? (
          <StatusGlyph tone="warning" size={9} />
        ) : null}
        <span>{step.text}</span>
      </div>
      <dl className={styles.isbar}>
        {lines.map((line) => (
          <div key={line.key}>
            <dt title={line.label}>
              <span aria-hidden="true">{line.key}</span>
              <SrOnly>{line.label}</SrOnly>
            </dt>
            <dd>{line.text}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

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
  const due = dueShort(row, ctx.now);
  return (
    <button
      type="button"
      className={`${styles.prow} ${highlighted ? styles.hl : ""}`}
      onClick={() => onPick(row.id)}
      data-testid="ward-handover-phone-row"
    >
      <span className={styles.prowTop}>
        <StatusGlyph tone={rowTone(row, ctx)} />
        <b className={styles.prowName}>{row.name}</b>
        {highlighted ? <SrOnly>, highlighted</SrOnly> : null}
        <Tier tier={row.tier} />
        <span className={styles.spacer} />
        <b className={styles.wait}>
          <SrOnly>Waiting </SrOnly>
          {durMinutes(ctx.now - row.openedAt)}
        </b>
      </span>
      <span className={styles.prowLine}>
        {row.edShort} to {destinationText(row)}
      </span>
      <span className={`${styles.prowLine} ${styles.prowNext}`}>
        {step.text}
        {due ? (
          <>
            {" · "}
            <span className={styles.mono}>{due}</span>
          </>
        ) : null}
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
  const cards = CARD_GROUPS.has(group.id);
  return (
    <section className={styles.sec} aria-label={group.title}>
      <button type="button" className={styles.secHead} aria-expanded={open} aria-controls={bodyId} onClick={onToggle}>
        <StatusGlyph tone={GROUP_TONE[group.id] ?? "neutral"} />
        <b className={styles.secTitle}>{group.title}</b>
        <Count n={group.rows.length} />
        <span className={styles.spacer} />
        <Icon icon={ChevronDown} size={16} className={styles.chev} />
      </button>
      {open ? (
        cards ? (
          <div id={bodyId} className={styles.cards}>
            {group.rows.map((row) => (
              <PatientCard key={row.id} row={row} ctx={ctx} highlighted={isHighlighted(row)} onPick={onPick} />
            ))}
          </div>
        ) : (
          <div id={bodyId} className={styles.list}>
            {group.rows.map((row) => (
              <PatientRow key={row.id} row={row} ctx={ctx} highlighted={isHighlighted(row)} onPick={onPick} />
            ))}
          </div>
        )
      ) : null}
    </section>
  );
}

/* ------------------------------------------------------------------ beds */

function OccupancyBar({ ward }: { ward: HandoverWard }) {
  const empty = Math.max(0, ward.empty - ward.ready);
  return (
    <span
      className={styles.obar}
      role="img"
      aria-label={`${ward.occupied} occupied, ${empty} empty not ready, ${ward.ready} ready`}
    >
      {ward.occupied > 0 ? <i className={styles.segOcc} style={{ flexGrow: ward.occupied }} /> : null}
      {empty > 0 ? <i className={styles.segEmpty} style={{ flexGrow: empty }} /> : null}
      {ward.ready > 0 ? <i className={styles.segReady} style={{ flexGrow: ward.ready }} /> : null}
    </span>
  );
}

function WardRow({ ward, now }: { ward: HandoverWard; now: Instant }) {
  const stale = wardIsStale(ward, now);
  return (
    <div className={styles.wardRow}>
      <span className={styles.phoneWardName}>
        <b>{ward.name}</b>
        <span className={styles.wardSub}>
          <span className={styles.trunc}>{ward.service}</span>
          {" · "}
          {stale ? (
            <span className={styles.stale}>
              <StatusGlyph tone="warning" size={8} />
              {durMinutes(now - ward.confirmedAt)} ago
              <SrOnly>, feed over 15 min</SrOnly>
            </span>
          ) : (
            <span>{durMinutes(now - ward.confirmedAt)} ago</span>
          )}
        </span>
      </span>
      <OccupancyBar ward={ward} />
      <span className={`${styles.ready} ${ward.ready > 0 ? styles.readyOn : ""}`}>
        {ward.ready}
        <SrOnly> ready</SrOnly>
      </span>
    </div>
  );
}

function BedsView({
  rows,
  wards,
  now,
  noneOpen,
  onToggleNone,
}: {
  rows: HandoverRow[];
  wards: HandoverWard[];
  now: Instant;
  noneOpen: boolean;
  onToggleNone: () => void;
}) {
  const sum = (key: "ready" | "beds" | "occupied" | "holds" | "longStays") =>
    wards.reduce((total, ward) => total + ward[key], 0);
  const ready = sum("ready");
  const beds = sum("beds");
  const occupied = sum("occupied");
  const held = sum("holds");
  const stale = wards.filter((ward) => wardIsStale(ward, now)).length;
  const waiting = rows.filter(isWaitingForBed).length;
  const withReady = wards
    .filter((ward) => ward.ready > 0)
    .sort((a, b) => b.ready - a.ready || a.name.localeCompare(b.name));
  const noReady = wards.filter((ward) => ward.ready <= 0).sort((a, b) => a.name.localeCompare(b.name));
  const preparing = wards.reduce((total, ward) => total + ward.pendingPreparation, 0);
  return (
    <div className={styles.beds} data-testid="ward-handover-phone-beds">
      <div className={styles.tiles}>
        <div className={`${styles.tile} ${styles.tileOk}`}>
          <b className={`${styles.tileValue} ${styles.inkSuccess}`}>{ready}</b>
          <span className={styles.tileLabel}>Beds ready</span>
          <span className={styles.tileSub}>
            for <b>{waiting}</b> waiting
            {preparing > 0 ? `, ${preparing} being made ready` : ""}
          </span>
        </div>
        <div className={styles.tile}>
          <b className={styles.tileValue}>{pct(occupied, beds)}%</b>
          <span className={styles.tileLabel}>Occupied</span>
          <span className={styles.tileSub}>
            {occupied} of {beds} beds
          </span>
        </div>
        <div className={styles.tile}>
          <b className={`${styles.tileValue} ${held > 0 ? styles.inkWarning : ""}`}>{held}</b>
          <span className={styles.tileLabel}>Discharges held</span>
          <span className={styles.tileSub}>{sum("longStays")} stays over 7 days</span>
        </div>
        <div className={styles.tile}>
          <b className={`${styles.tileValue} ${stale > 0 ? styles.inkWarning : ""}`}>{stale}</b>
          <span className={styles.tileLabel}>Feeds over 15 min</span>
          <span className={styles.tileSub}>of {wards.length} wards</span>
        </div>
      </div>

      <section className={styles.sec} aria-labelledby="ward-handover-phone-ready-title">
        <div className={`${styles.secHead} ${styles.secHeadStatic}`}>
          <StatusGlyph tone="success" />
          <b className={styles.secTitle} id="ward-handover-phone-ready-title">
            Wards with ready beds
          </b>
          <Count n={withReady.length} />
        </div>
        {withReady.length ? (
          <div className={styles.list}>
            {withReady.map((ward) => (
              <WardRow key={ward.id} ward={ward} now={now} />
            ))}
          </div>
        ) : (
          <p className={styles.empty}>No ward in scope shows a ready bed.</p>
        )}
      </section>

      {noReady.length ? (
        <section className={styles.sec} aria-label="No ready beds">
          <button
            type="button"
            className={styles.secHead}
            aria-expanded={noneOpen}
            aria-controls="ward-handover-phone-no-ready"
            onClick={onToggleNone}
          >
            <StatusGlyph tone="closed" />
            <b className={styles.secTitle}>No ready beds</b>
            <Count n={noReady.length} />
            <span className={styles.spacer} />
            <Icon icon={ChevronDown} size={16} className={styles.chev} />
          </button>
          {noneOpen ? (
            <div id="ward-handover-phone-no-ready" className={styles.list}>
              {noReady.map((ward) => (
                <WardRow key={ward.id} ward={ward} now={now} />
              ))}
            </div>
          ) : null}
        </section>
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
}: HandoverPhoneProps) {
  const [tab, setTab] = useState<PhoneTab>("pts");
  const [shiftSheetOpen, setShiftSheetOpen] = useState(false);
  /** Sections the user has opened or closed, over each group's default. */
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const [noneOpen, setNoneOpen] = useState(true);

  const current = handoverShift(shift);
  const at = handoverAt(shift, now);
  const passed = handoverHasPassed(shift, now);
  const actCount = rows.filter((row) => groupOf(row, ctx.now, ctx.cutoff) === "act").length;
  const dueCount = rows.filter((row) => groupOf(row, ctx.now, ctx.cutoff) === "due").length;
  const waitCount = rows.filter(isWaitingForBed).length;
  const readyCount = wards.reduce((total, ward) => total + ward.ready, 0);
  const highlightedCount = rows.filter(isHighlighted).length;

  const figures: { id: HandoverPill; n: number; label: string; tone: WfTone }[] = [
    { id: "act", n: actCount, label: "Act now", tone: "danger" },
    { id: "due", n: dueCount, label: `Due ${formatInstantWithDay(ctx.cutoff, now)}`, tone: "warning" },
    { id: "bed", n: waitCount, label: "Waiting", tone: "neutral" },
  ];

  const isOpen = (id: string) => toggled[id] ?? CARD_GROUPS.has(id);

  return (
    <div className={styles.phone} data-testid="ward-handover-phone" data-ward-design="v6">
      <header className={styles.bar}>
        <h1 className={styles.barTitle}>Handover</h1>
        <button
          type="button"
          className={styles.shiftChip}
          aria-haspopup="dialog"
          aria-expanded={shiftSheetOpen}
          aria-label={`Which handover, ${formatInstantWithDay(at, now)}`}
          onClick={() => setShiftSheetOpen(true)}
          data-testid="ward-handover-phone-shift"
        >
          <span className={styles.shiftChipPill}>
            <b>{formatInstantWithDay(at, now)}</b>
            <Icon icon={ChevronDown} size={14} />
          </span>
        </button>
      </header>

      <div className={styles.main}>
        <section className={styles.phoneHero} aria-labelledby="ward-handover-phone-title">
          <div className={styles.heroTop}>
            <div className={styles.heroName}>
              <span className={styles.eyebrow}>
                {current.label} · {scopeLabel}
              </span>
              <h2 className={styles.heroTitle} id="ward-handover-phone-title">
                {formatInstantWithDay(at, now)} handover
              </h2>
            </div>
            <span className={styles.spacer} />
            <span className={styles.countdown}>
              {passed ? "Passed" : "In"}
              <b>{durMinutes(Math.abs(at - now))}</b>
              {passed ? "ago" : null}
            </span>
          </div>
          <div className={styles.figures} role="group" aria-label="Highlight">
            {figures.map((figure) => (
              <button
                key={figure.id}
                type="button"
                className={styles.figure}
                aria-pressed={pill === figure.id}
                onClick={() => onPill(figure.id)}
                data-testid={`ward-handover-phone-figure-${figure.id}`}
              >
                <b className={styles.figureValue}>{figure.n}</b>
                <span className={styles.figureLabel}>
                  <StatusGlyph tone={figure.tone} size={9} />
                  <span className={styles.trunc}>{figure.label}</span>
                </span>
              </button>
            ))}
          </div>
          {signedAt !== null ? (
            <div className={styles.signed} data-testid="ward-handover-phone-signed">
              <StatusGlyph tone="success" size={9} />
              Signed {formatInstantWithDay(signedAt, now)}
            </div>
          ) : null}
        </section>

        <Tabs<PhoneTab>
          label="Handover views"
          className={styles.tabs}
          value={tab}
          onChange={setTab}
          idPrefix="ward-handover-phone"
          items={[
            { id: "pts", label: "Patients", count: rows.length },
            { id: "beds", label: "Beds", count: readyCount },
          ]}
        />

        {tab === "pts" ? (
          <div
            role="tabpanel"
            id="ward-handover-phone-panel-pts"
            aria-labelledby="ward-handover-phone-tab-pts"
            className={styles.panel}
          >
            {passed ? (
              <div className={styles.banner} role="note">
                <StatusGlyph tone="closed" size={9} />
                <span>{formatInstantWithDay(at, now)} has passed. Showing the board now.</span>
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
            <p className={styles.note}>Print, filters and columns are on desktop</p>
          </div>
        ) : (
          <div
            role="tabpanel"
            id="ward-handover-phone-panel-beds"
            aria-labelledby="ward-handover-phone-tab-beds"
            className={styles.panel}
          >
            <BedsView
              rows={rows}
              wards={wards}
              now={now}
              noneOpen={noneOpen}
              onToggleNone={() => setNoneOpen((open) => !open)}
            />
          </div>
        )}

        <p className={styles.note}>Synthetic data. Not a medical device.</p>
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

      <Drawer
        open={drawerOpen}
        onClose={onCloseDrawer}
        title={flowPanel ? "Patient" : "Sign off"}
        testId="ward-handover-phone-drawer"
      >
        {flowPanel ?? signOffPanel}
      </Drawer>
    </div>
  );
}
