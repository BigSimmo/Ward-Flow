"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { CalendarClock } from "lucide-react";
import type { Unit } from "@/components/ward-management/ward-model";
import { CountBubble, Icon, SrOnly, StatusGlyph, buttonClass, cx, type WfTone } from "@/components/wf";
import styles from "./ward-decisions-cockpit.module.css";

export interface DepartureDecision {
  id: string;
  title: string;
  badge: "Ready" | "Blocked" | "Done";
  onConfirm?: () => void;
  onClear?: () => void;
}

export interface LeaveDecision {
  id: string;
  title: string;
}

export interface IntakeDecision {
  id: string;
  title: string;
  onAccept?: () => void;
}

/**
 * How many decisions are still open: referrals to answer, discharges ready or held up, and the
 * morning rollup until it is confirmed (overdue, or due and actionable). Leave rows are for
 * awareness only and never count. The Decisions tab badge and the cockpit heading both read this,
 * so they always agree with the windows' own counts.
 */
export function openDecisionCount({
  intakes,
  departures,
  rollupOverdue,
  rollupConfirmed,
  rollupActionable,
}: {
  intakes: readonly IntakeDecision[];
  departures: readonly DepartureDecision[];
  rollupOverdue: boolean;
  rollupConfirmed: boolean;
  rollupActionable: boolean;
}): number {
  const rollupOpen = !rollupConfirmed && (rollupOverdue || rollupActionable) ? 1 : 0;
  return (
    intakes.length + departures.filter((row) => row.badge === "Ready" || row.badge === "Blocked").length + rollupOpen
  );
}

/**
 * Bed projection for the Departures window. Shown only when the screen supplies it: the cockpit
 * never works out a bed figure of its own.
 */
export interface DecisionBedProjection {
  freeNow: number;
  freeBy: number;
  /** Clock time the second figure is for, such as "14:00". */
  byLabel: string;
}

export interface WardDecisionsCockpitProps {
  unit: Unit;
  demonstration?: boolean;
  rollupOverdue?: boolean;
  rollupConfirmed?: boolean;
  rollupTimeLabel?: string;
  plannedDischarges?: number;
  onConfirmRollup?: () => void;
  staffingFact?: string;
  intakes?: IntakeDecision[];
  departures?: DepartureDecision[];
  leaves?: LeaveDecision[];
  projection?: DecisionBedProjection;
  children?: ReactNode;
}

type WindowId = "staffing" | "intake" | "departures" | "leave";
type Group = "act" | "wait" | "ready" | "done";
type ActionKind = "sign" | "clear" | "accept";

interface DecisionItem {
  id: string;
  group: Group;
  tone: WfTone;
  title: string;
  sub?: string;
  testId?: string;
  actions?: ReactNode;
  /** Shown for awareness only. Nothing here can be decided, so it never counts as open. */
  info?: boolean;
}

interface WindowSpec {
  id: WindowId;
  title: string;
  hours: string;
}

const WINDOWS: readonly WindowSpec[] = [
  { id: "staffing", title: "Staffing", hours: "07:00–09:30" },
  { id: "intake", title: "Intake", hours: "09:30–13:00" },
  { id: "departures", title: "Departures", hours: "11:00–14:00" },
  { id: "leave", title: "Leave", hours: "14:00–18:00" },
];

const GROUP_ORDER: readonly Group[] = ["act", "wait", "ready", "done"];

const GROUP_TONE = new Map<Group, WfTone>([
  ["act", "danger"],
  ["wait", "neutral"],
  ["ready", "warning"],
  ["done", "success"],
]);

/** An action the cockpit sent, read back against the next props to say whether it was recorded. */
interface SentAction {
  seq: number;
  kind: ActionKind;
  ids: string[];
  titles: Map<string, string>;
}

/** "Name (bed not recorded)" and "Bed on leave · back 15:42" read as a title over a short line. */
function splitTitle(title: string): { name: string; detail?: string } {
  const bracket = /^(.*\S)\s*\(([^()]+)\)$/.exec(title);
  if (bracket) {
    const detail = bracket[2];
    return { name: bracket[1], detail: detail.charAt(0).toUpperCase() + detail.slice(1) };
  }
  const dot = title.indexOf(" · ");
  if (dot > 0) {
    const detail = title.slice(dot + 3);
    return { name: title.slice(0, dot), detail: detail.charAt(0).toUpperCase() + detail.slice(1) };
  }
  return { name: title };
}

function joinSub(...parts: (string | undefined)[]): string | undefined {
  const kept = parts.filter((part): part is string => Boolean(part));
  return kept.length > 0 ? kept.join(" · ") : undefined;
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function WardDecisionsCockpit({
  unit,
  demonstration = false,
  rollupOverdue = false,
  rollupConfirmed = false,
  rollupTimeLabel = "09:30",
  plannedDischarges = 0,
  onConfirmRollup,
  staffingFact,
  intakes = [],
  departures = [],
  leaves = [],
  projection,
  children,
}: WardDecisionsCockpitProps) {
  // A screen that supplies the rollup action or the bed projection is wired, even on a quiet ward
  // with nothing to decide yet; only a bare cockpit falls back to the placeholder.
  const live =
    demonstration ||
    children != null ||
    onConfirmRollup !== undefined ||
    projection !== undefined ||
    intakes.length > 0 ||
    departures.length > 0 ||
    leaves.length > 0;
  if (!live) {
    return (
      <section className={styles.container} aria-label="Ward decision controls">
        <h2>Decision cockpit</h2>
        <p>
          Not wired in this prototype. This illustrative cockpit does not record clinical decisions or send messages.
        </p>
        <p>Use the ward overview, arrival and discharge controls for supported record updates.</p>
      </section>
    );
  }

  return (
    <Queue
      unitName={unit.name}
      rollupOverdue={rollupOverdue}
      rollupConfirmed={rollupConfirmed}
      rollupTimeLabel={rollupTimeLabel}
      plannedDischarges={plannedDischarges}
      onConfirmRollup={onConfirmRollup}
      staffingFact={staffingFact}
      intakes={intakes}
      departures={departures}
      leaves={leaves}
      projection={projection}
      wired={children != null}
    >
      {children}
    </Queue>
  );
}

function Queue({
  unitName,
  rollupOverdue,
  rollupConfirmed,
  rollupTimeLabel,
  plannedDischarges,
  onConfirmRollup,
  staffingFact,
  intakes,
  departures,
  leaves,
  projection,
  wired,
  children,
}: {
  unitName: string;
  rollupOverdue: boolean;
  rollupConfirmed: boolean;
  rollupTimeLabel: string;
  plannedDischarges: number;
  onConfirmRollup?: () => void;
  staffingFact?: string;
  intakes: IntakeDecision[];
  departures: DepartureDecision[];
  leaves: LeaveDecision[];
  projection?: DecisionBedProjection;
  wired: boolean;
  children?: ReactNode;
}) {
  const baseId = useId();
  const [sent, setSent] = useState<SentAction | null>(null);
  const [history, setHistory] = useState<{ id: string; kind: ActionKind; title: string }[]>([]);
  const [dismissedSeq, setDismissedSeq] = useState(0);
  const [showDone, setShowDone] = useState(false);

  // Whether an action was recorded is read back from the live rows, never assumed: a sign-off is
  // recorded once the row no longer offers Sign off, a hold once the row is no longer held up, and
  // an accept once the referral has left the intake list.
  function recorded(kind: ActionKind, id: string): boolean {
    if (kind === "sign") return !departures.some((row) => row.id === id && row.onConfirm && row.badge !== "Done");
    if (kind === "clear") return !departures.some((row) => row.id === id && row.badge === "Blocked");
    return !intakes.some((row) => row.id === id);
  }

  function send(kind: ActionKind, rows: { id: string; title: string; run: () => void }[]) {
    if (rows.length === 0) return;
    for (const row of rows) row.run();
    const titles = new Map(rows.map((row) => [row.id, splitTitle(row.title).name]));
    setSent((current) => ({ seq: (current?.seq ?? 0) + 1, kind, ids: rows.map((row) => row.id), titles }));
    setHistory((current) => [
      ...current.filter((entry) => !rows.some((row) => row.id === entry.id && entry.kind === kind)),
      ...rows.map((row) => ({ id: row.id, kind, title: splitTitle(row.title).name })),
    ]);
  }

  useEffect(() => {
    if (!sent) return;
    const timer = window.setTimeout(() => {
      setDismissedSeq(sent.seq);
    }, 6000);
    return () => {
      window.clearTimeout(timer);
    };
  }, [sent]);

  const readyRows = departures.filter((row) => row.badge === "Ready");
  const heldRows = departures.filter((row) => row.badge === "Blocked");
  const doneRows = departures.filter((row) => row.badge === "Done");
  const signable = readyRows.filter((row): row is DepartureDecision & { onConfirm: () => void } => !!row.onConfirm);

  const doneHere = (kind: ActionKind) =>
    history.filter(
      (entry) => entry.kind === kind && recorded(kind, entry.id) && !departures.some((row) => row.id === entry.id),
    );

  const items: Record<WindowId, DecisionItem[]> = {
    staffing: [],
    intake: [],
    departures: [],
    leave: [],
  };

  if (rollupOverdue) {
    items.staffing.push({
      id: "rollup",
      group: "act",
      tone: "danger",
      title: `${rollupTimeLabel} Morning Bed Rollup Overdue`,
      sub: staffingFact,
      testId: "ward-morning-rollup-overdue-banner",
      actions: onConfirmRollup ? (
        <button
          type="button"
          className={cx(buttonClass({ variant: "sec", size: "sm" }), styles.pill)}
          data-testid="ward-confirm-morning-rollup-btn"
          onClick={onConfirmRollup}
        >
          Confirm rollup
        </button>
      ) : (
        <span className={styles.unwired}>Not wired in this prototype.</span>
      ),
    });
  } else if (!rollupConfirmed && onConfirmRollup) {
    items.staffing.push({
      id: "rollup",
      group: "wait",
      tone: "neutral",
      title: `Morning Bed Rollup due ${rollupTimeLabel}`,
      sub: staffingFact,
    });
  }
  if (rollupConfirmed) {
    items.staffing.push({
      id: "rollup-done",
      group: "done",
      tone: "success",
      title: `${rollupTimeLabel} Morning Bed Rollup Confirmed`,
      sub: `${plannedDischarges} discharges scheduled today`,
      testId: "ward-morning-rollup-confirmed-banner",
    });
  }

  for (const row of intakes) {
    const { name, detail } = splitTitle(row.title);
    const { onAccept } = row;
    items.intake.push({
      id: row.id,
      group: "wait",
      tone: "warning",
      title: name,
      sub: joinSub(detail, "Referral to answer"),
      actions: onAccept ? (
        <button
          type="button"
          className={cx(buttonClass({ variant: "sec", size: "sm" }), styles.pill)}
          onClick={() => {
            send("accept", [{ id: row.id, title: row.title, run: onAccept }]);
          }}
        >
          Accept
        </button>
      ) : (
        <span className={styles.unwired}>Not wired in this prototype.</span>
      ),
    });
  }
  for (const entry of doneHere("accept")) {
    items.intake.push({ id: `done-${entry.id}`, group: "done", tone: "success", title: entry.title, sub: "Accepted" });
  }

  for (const row of heldRows) {
    const { name, detail } = splitTitle(row.title);
    const { onConfirm, onClear } = row;
    items.departures.push({
      id: row.id,
      group: "act",
      tone: "danger",
      title: name,
      sub: joinSub(detail, "Held up"),
      actions: (
        <>
          {onConfirm ? (
            <button
              type="button"
              className={cx(buttonClass({ variant: "ghost", size: "sm" }), styles.pill)}
              onClick={() => {
                send("sign", [{ id: row.id, title: row.title, run: onConfirm }]);
              }}
            >
              Sign off
            </button>
          ) : null}
          {onClear ? (
            <button
              type="button"
              className={cx(buttonClass({ variant: "sec", size: "sm" }), styles.pill)}
              onClick={() => {
                send("clear", [{ id: row.id, title: row.title, run: onClear }]);
              }}
            >
              Clear
            </button>
          ) : null}
        </>
      ),
    });
  }
  for (const row of readyRows) {
    const { name, detail } = splitTitle(row.title);
    const { onConfirm } = row;
    items.departures.push({
      id: row.id,
      group: "ready",
      tone: "warning",
      title: name,
      sub: detail ?? "Ready to sign off",
      actions: onConfirm ? (
        <button
          type="button"
          className={cx(buttonClass({ variant: "ghost", size: "sm" }), styles.pill)}
          onClick={() => {
            send("sign", [{ id: row.id, title: row.title, run: onConfirm }]);
          }}
        >
          Sign off
        </button>
      ) : null,
    });
  }
  for (const row of doneRows) {
    const { name, detail } = splitTitle(row.title);
    items.departures.push({
      id: row.id,
      group: "done",
      tone: "success",
      title: name,
      sub: joinSub(detail, "Signed off"),
    });
  }
  for (const entry of doneHere("sign")) {
    items.departures.push({
      id: `done-${entry.id}`,
      group: "done",
      tone: "success",
      title: entry.title,
      sub: "Signed off",
    });
  }

  for (const row of leaves) {
    const { name, detail } = splitTitle(row.title);
    items.leave.push({
      id: row.id,
      group: "wait",
      tone: "neutral",
      title: name,
      sub: detail ?? "On leave",
      info: true,
    });
  }

  const isOpen = (item: DecisionItem) => item.group !== "done" && !item.info;
  const windowItems = new Map(Object.entries(items) as Array<[WindowId, DecisionItem[]]>);
  const itemsOf = (id: WindowId): DecisionItem[] => windowItems.get(id) ?? [];
  const openCount = (id: WindowId) => itemsOf(id).filter(isOpen).length;
  // The heading's total is the same count the Decisions tab badge shows, and it equals the windows'
  // own counts added up, so it never says Done beside a window that still has something to decide.
  const dueCount = openDecisionCount({
    intakes,
    departures,
    rollupOverdue,
    rollupConfirmed,
    rollupActionable: onConfirmRollup !== undefined,
  });
  const windowTone = (id: WindowId): WfTone => {
    const open = itemsOf(id).filter(isOpen);
    if (open.length === 0) return "success";
    if (open.some((item) => item.group === "act")) return "danger";
    if (open.some((item) => item.tone === "warning")) return "warning";
    return "neutral";
  };

  const [chosen, setChosen] = useState<WindowId>(() => {
    for (const group of ["act", "ready", "wait"] as const) {
      const found = WINDOWS.find((spec) => itemsOf(spec.id).some((item) => item.group === group));
      if (found) return found.id;
    }
    return "staffing";
  });

  const spec = WINDOWS.find((entry) => entry.id === chosen) ?? WINDOWS[0];
  const here = itemsOf(chosen);
  const open = openCount(chosen);
  const decidable = here.filter((item) => !item.info).length;
  const decided = decidable - open;
  const showBulk = chosen === "departures" && signable.length > 0;

  function choose(id: WindowId) {
    setChosen(id);
    setShowDone(false);
  }

  let notice: { tone: WfTone; text: string } | null = null;
  // The notice belongs to the window the action was taken in, so another window never shows it.
  const sentWindow: WindowId | null = sent ? (sent.kind === "accept" ? "intake" : "departures") : null;
  if (sent && sent.seq !== dismissedSeq && chosen === sentWindow) {
    const done = sent.ids.filter((id) => recorded(sent.kind, id));
    const n = sent.ids.length;
    const first = sent.titles.get(sent.ids[0]) ?? "";
    if (sent.kind === "sign") {
      notice =
        done.length === n
          ? {
              tone: "success",
              text: n === 1 ? `${first} signed off` : `${plural(n, "discharge", "discharges")} signed off`,
            }
          : done.length === 0
            ? { tone: "closed", text: "Sign off not recorded. Nothing was changed." }
            : {
                tone: "closed",
                text: `${done.length} of ${n} signed off. ${n - done.length} not recorded, nothing changed for them.`,
              };
    } else if (sent.kind === "clear") {
      notice =
        done.length === n
          ? { tone: "success", text: `Hold cleared for ${first}` }
          : { tone: "closed", text: "Hold not cleared. Nothing was changed." };
    } else {
      notice =
        done.length === n
          ? { tone: "success", text: `${first} accepted` }
          : { tone: "closed", text: "Accept not recorded. Nothing was changed." };
    }
  }

  const groupLabel = new Map<Group, string>([
    ["act", chosen === "departures" ? "Held up" : "Act now"],
    ["wait", "Waiting"],
    ["ready", "Ready to sign off"],
    ["done", "Done"],
  ]);

  return (
    <div className={styles.container}>
      <h2 className={styles.srOnly}>Decisions, {dueCount > 0 ? `${dueCount} due` : "Done"}</h2>

      <div className={styles.steps} role="group" aria-label="Decision windows">
        {WINDOWS.map((entry) => {
          const count = openCount(entry.id);
          const tone = windowTone(entry.id);
          const describedBy = `${baseId}-${entry.id}-count`;
          return (
            <button
              key={entry.id}
              type="button"
              className={styles.windowStep}
              data-on={chosen === entry.id}
              aria-pressed={chosen === entry.id}
              aria-label={`${entry.title}, ${entry.hours}`}
              aria-describedby={describedBy}
              onClick={() => {
                choose(entry.id);
              }}
            >
              <StatusGlyph tone={tone} />
              <span className={styles.stepText}>
                <b>{entry.title}</b>
                <span>
                  {entry.hours}
                  {entry.id === "staffing" && staffingFact ? ` · ${staffingFact}` : ""}
                </span>
              </span>
              <CountBubble n={count} className={cx(styles.stepCount, tone === "danger" && styles.countAct)} />
              <SrOnly id={describedBy}>{count > 0 ? `${count} to decide` : "Clear"}</SrOnly>
            </button>
          );
        })}
      </div>

      <div className={styles.split}>
        <section className={styles.card} aria-label={spec.title} id={`gate-${chosen}`}>
          <header className={styles.head}>
            <Icon icon={CalendarClock} size={16} className={styles.headIcon} />
            <h3 className={styles.headTitle}>{spec.title}</h3>
            <span className={cx(styles.mono, styles.hideNarrow)}>{spec.hours}</span>
            <span className={styles.headMeta}>{open > 0 ? `${open} to decide` : "Nothing due"}</span>
          </header>

          <p className={styles.notice} role="status" aria-live="polite">
            {notice ? (
              <>
                <StatusGlyph tone={notice.tone} />
                <span>{notice.text}</span>
              </>
            ) : null}
          </p>

          {here.length === 0 && chosen !== "staffing" ? (
            <ul className={styles.rows}>
              <DecisionRow
                item={{
                  id: "none",
                  group: "done",
                  tone: "success",
                  title: "Nothing due",
                  sub: "Clear for this window",
                }}
              />
            </ul>
          ) : null}

          {GROUP_ORDER.map((group) => {
            const list = here.filter((item) => item.group === group);
            if (list.length === 0) return null;
            const collapsible = group === "done" && list.length > 2;
            const hidden = collapsible && !showDone;
            const listId = `${baseId}-${chosen}-${group}`;
            return (
              <div key={group} className={styles.group}>
                <div className={styles.sec}>
                  <StatusGlyph tone={GROUP_TONE.get(group) ?? "neutral"} />
                  <h4 className={styles.secTitle}>{groupLabel.get(group)}</h4>
                  <CountBubble n={list.length} className={cx(group === "act" && styles.countAct)} />
                  {collapsible ? (
                    <button
                      type="button"
                      className={cx(buttonClass({ variant: "ghost", size: "sm" }), styles.pill, styles.secToggle)}
                      aria-expanded={showDone}
                      aria-controls={listId}
                      onClick={() => {
                        setShowDone((value) => !value);
                      }}
                    >
                      {showDone ? "Hide" : "Show"}
                    </button>
                  ) : null}
                </div>
                {hidden ? null : (
                  <ul id={listId} className={cx(styles.rows, (group === "ready" || group === "done") && styles.grid2)}>
                    {list.map((item) => (
                      <DecisionRow key={item.id} item={item} />
                    ))}
                  </ul>
                )}
              </div>
            );
          })}

          {chosen === "staffing" ? (
            <div className={styles.staffingBody}>
              {here.length === 0 ? (
                <ul className={styles.rows}>
                  <DecisionRow
                    item={{
                      id: "none",
                      group: "done",
                      tone: "success",
                      title: "Nothing due",
                      sub: staffingFact ?? unitName,
                    }}
                  />
                </ul>
              ) : null}
              {children}
              {!wired && !onConfirmRollup ? <p className={styles.unwiredLine}>Not wired in this prototype.</p> : null}
            </div>
          ) : null}

          {showBulk ? (
            <div className={styles.bulk}>
              <span className={styles.bulkMeta}>
                <b>{signable.length}</b> ready to sign off
              </span>
              <button
                type="button"
                className={cx(buttonClass({ variant: "pri", size: "lg" }), styles.pill)}
                onClick={() => {
                  send(
                    "sign",
                    signable.map((row) => ({ id: row.id, title: row.title, run: row.onConfirm })),
                  );
                }}
              >
                Sign off {signable.length}
              </button>
            </div>
          ) : null}
        </section>

        <aside className={styles.card} aria-label="Window progress">
          <div className={styles.head}>
            <Icon icon={CalendarClock} size={16} className={styles.headIcon} />
            <span className={styles.headTitle}>{spec.title}</span>
            <span className={cx(styles.mono, styles.headEnd)}>{spec.hours}</span>
          </div>
          <div className={styles.progress}>
            <div className={styles.prow}>
              <span>{decidable > 0 ? `${decided} of ${decidable} decided` : "Nothing due"}</span>
            </div>
            {decidable > 0 ? (
              <div
                className={styles.bar}
                role="progressbar"
                aria-label={`${spec.title} decided`}
                aria-valuemin={0}
                aria-valuemax={decidable}
                aria-valuenow={decided}
              >
                <i style={{ width: `${(decided / decidable) * 100}%` }} />
              </div>
            ) : null}
            {chosen === "departures" && projection ? (
              <div className={styles.proj}>
                <div>
                  <b>{projection.freeNow}</b>
                  <span>Free beds now</span>
                </div>
                <div>
                  <b>{projection.freeBy}</b>
                  <span>Free by {projection.byLabel}</span>
                </div>
              </div>
            ) : null}
          </div>
          <h3 className={styles.sideSec}>Other windows</h3>
          <ul className={styles.rows}>
            {WINDOWS.filter((entry) => entry.id !== chosen).map((entry) => {
              const count = openCount(entry.id);
              return (
                <li key={entry.id} className={styles.row}>
                  <StatusGlyph tone={windowTone(entry.id)} />
                  <div className={styles.rowText}>
                    <h4 className={styles.rowTitle}>{entry.title}</h4>
                    <span className={styles.rowSub}>{entry.hours}</span>
                  </div>
                  <span className={styles.when}>{count > 0 ? `${count} to decide` : "Clear"}</span>
                  <span className={styles.rowActions}>
                    {count > 0 ? (
                      <button
                        type="button"
                        className={cx(buttonClass({ variant: "sec", size: "sm" }), styles.pill)}
                        aria-label={`Open ${entry.title} window`}
                        onClick={() => {
                          choose(entry.id);
                        }}
                      >
                        Open
                      </button>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
        </aside>
      </div>
    </div>
  );
}

function DecisionRow({ item }: { item: DecisionItem }) {
  return (
    <li className={styles.row} data-testid={item.testId}>
      <StatusGlyph tone={item.tone} />
      <span className={styles.rowText}>
        <span className={styles.rowTitle}>{item.title}</span>
        {item.sub ? <span className={styles.rowSub}>{item.sub}</span> : null}
      </span>
      {item.actions ? <span className={styles.rowActions}>{item.actions}</span> : null}
    </li>
  );
}
