"use client";

import { ChevronRight, Phone, PhoneCall } from "lucide-react";
import type { ReactNode } from "react";

import { useOptionalToast } from "@/components/ui/toast";
import { Card, CardHead, StatusGlyph, cx, useIsPhone, useIsTabletPortrait } from "@/components/wf";
import type { MockupOption } from "@/components/ward-management/preview/preview-option";

import type { CallRow, CallTarget } from "./patient-call-list";
import type { PatientMode } from "./patient-mode";
import {
  CellAction,
  PatientStatusCard,
  buildPatientStatus,
  type PatientStatusContext,
  type StatusCell,
} from "./patient-status-card";
import styles from "./patient-now-layouts.module.css";

/**
 * Patient Now, three mockup layouts (device audit 11 Oct 2026, Patient, Recommended). Each keeps
 * one next step and drops the Transit operations, Destination review and Transport dispatch block
 * from Now: destination and transport open as sheets from their cells. Who to call shows the
 * number with a call button. The screen passes the same parts to each option.
 *
 *   A  Status card first: the guide's layout. Status card, then Legal now and Who to call (two-up
 *      on iPad portrait, the rail on desktop), then Record a change and Why they're here.
 *   B  Next step first: one sentence and one button lead the tab, the gates sit under it as a
 *      strip, and the people to call are a strip of call tiles.
 *   C  Owner checklist: the gates are numbered steps, each with its owner's number and call
 *      button, so who to call sits beside the step they own.
 */

export type PatientNowLayoutParts = {
  option: MockupOption;
  mode: PatientMode;
  context: PatientStatusContext;
  /** Status card props the screen already builds (phone bar lead, foot line). */
  statusCardProps?: Pick<Parameters<typeof PatientStatusCard>[0], "barLead" | "barMain" | "phoneFoot">;
  legal: ReactNode;
  why: ReactNode;
  /** Record a change, leave and absence cards, and the record overview, in that order. */
  change: ReactNode;
  calls: CallRow[];
  /** The owner of each gate, as a directory target, for option C. */
  ownerTargets: Partial<Record<string, CallTarget>>;
  ownerCalls: (target: CallTarget) => CallRow | undefined;
  /** Rows under the work: destination and transport sheets, Review and corrections. */
  sheetRows: ReactNode;
  /** Phone only: Community and Details one tap away. */
  phoneMore?: ReactNode;
};

export function PatientNowLayout(parts: PatientNowLayoutParts) {
  const isPhone = useIsPhone();
  const isPortrait = useIsTabletPortrait();
  if (parts.option === "B") return <NextStepLayout {...parts} isPhone={isPhone} isPortrait={isPortrait} />;
  if (parts.option === "C") return <ChecklistLayout {...parts} isPhone={isPhone} isPortrait={isPortrait} />;
  return <StatusFirstLayout {...parts} isPhone={isPhone} isPortrait={isPortrait} />;
}

type LayoutProps = PatientNowLayoutParts & { isPhone: boolean; isPortrait: boolean };

/* ---------------- A: status card first ---------------- */

function StatusFirstLayout({
  mode,
  context,
  statusCardProps,
  legal,
  why,
  change,
  calls,
  sheetRows,
  phoneMore,
  isPhone,
  isPortrait,
}: LayoutProps) {
  const card = <PatientStatusCard mode={mode} context={context} {...statusCardProps} />;
  const callCard = <PatientCallCard rows={calls} />;
  if (isPhone)
    return (
      <div className={styles.stack} data-layout="A">
        {card}
        {sheetRows}
        {legal}
        {callCard}
        {change}
        {phoneMore}
      </div>
    );
  if (isPortrait)
    return (
      <div className={styles.stack} data-layout="A">
        {card}
        <div className={styles.twoUp}>
          {legal}
          {callCard}
        </div>
        {sheetRows}
        {change}
        {why}
      </div>
    );
  return (
    <div className={styles.stack} data-layout="A">
      {card}
      <div className={styles.cols}>
        <div className={styles.col}>
          {sheetRows}
          {change}
        </div>
        <div className={styles.col} data-wf-rail="1121">
          {why}
          {legal}
          {callCard}
        </div>
      </div>
    </div>
  );
}

/* ---------------- B: next step first ---------------- */

function NextStepLayout({
  mode,
  context,
  statusCardProps,
  legal,
  why,
  change,
  calls,
  sheetRows,
  phoneMore,
  isPhone,
  isPortrait,
}: LayoutProps) {
  const status = buildPatientStatus(mode, context);
  // Outside a placement (or a checklist such as absence), the status card is already the answer.
  if (status.rows || status.cells.length === 0)
    return (
      <StatusFirstLayout
        option="A"
        mode={mode}
        context={context}
        statusCardProps={statusCardProps}
        legal={legal}
        why={why}
        change={change}
        calls={calls}
        ownerTargets={{}}
        ownerCalls={() => undefined}
        sheetRows={sheetRows}
        phoneMore={phoneMore}
        isPhone={isPhone}
        isPortrait={isPortrait}
      />
    );
  const next = status.cells.find((cell) => !cell.clear && cell.action?.kind === "button");
  const clear = status.cells.filter((cell) => cell.clear).length;
  const nextCard = (
    <section className={styles.nextCard} aria-label="Next step" data-act={status.tone === "danger" || undefined}>
      <div className={styles.nextHead}>
        <span className={styles.eyebrow}>
          <StatusGlyph tone={status.tone} size={9} />
          {status.verdict}
        </span>
        <span className={styles.meter}>
          <b className={styles.mono}>
            {clear} of {status.cells.length}
          </b>{" "}
          clear
        </span>
      </div>
      {next ? (
        <div className={styles.nextBody}>
          <p className={styles.nextTitle}>
            Next: {next.action?.label.toLowerCase()}
            {next.key === "bed" && context.acceptedUnitName ? ` at ${context.acceptedUnitName}` : ""}
          </p>
          <p className={styles.nextSub}>
            {next.label} · {next.sub} · {next.owner}
          </p>
          {isPhone ? null : (
            <div className={styles.nextAction}>{next.action ? <CellAction action={next.action} primary /> : null}</div>
          )}
        </div>
      ) : (
        <div className={styles.nextBody}>
          <p className={styles.nextTitle}>{status.meta}</p>
        </div>
      )}
      <ul className={styles.gateStrip} aria-label="Gates">
        {status.cells.map((cell) => (
          <li key={cell.key} className={styles.gate}>
            <span className={styles.gateLabel}>
              <StatusGlyph tone={cell.tone ?? "neutral"} size={9} />
              {cell.label}
            </span>
            <b className={styles.gateValue}>{cell.value}</b>
            <span className={styles.gateSub}>{cell.owner}</span>
            {cell.action && cell !== next ? (
              <span className={styles.gateAction}>
                <CellAction action={cell.action} primary={false} />
              </span>
            ) : null}
          </li>
        ))}
      </ul>
      {isPhone && next?.action ? (
        <div className={styles.phBar}>
          <CellAction action={next.action} primary />
        </div>
      ) : null}
    </section>
  );
  const strip = <PatientCallStrip rows={calls} stacked={isPhone} />;
  if (isPhone)
    return (
      <div className={styles.stack} data-layout="B">
        {nextCard}
        {strip}
        {sheetRows}
        {legal}
        {change}
        {phoneMore}
      </div>
    );
  return (
    <div className={styles.stack} data-layout="B">
      {nextCard}
      {strip}
      <div className={cx(styles.cols, isPortrait && styles.colsEven)}>
        <div className={styles.col}>
          {sheetRows}
          {change}
          {isPortrait ? null : why}
        </div>
        <div className={styles.col} data-wf-rail="1121">
          {legal}
          {isPortrait ? why : null}
        </div>
      </div>
    </div>
  );
}

/* ---------------- C: owner checklist ---------------- */

function ChecklistLayout({
  mode,
  context,
  statusCardProps,
  legal,
  why,
  change,
  calls,
  ownerTargets,
  ownerCalls,
  sheetRows,
  phoneMore,
  isPhone,
  isPortrait,
}: LayoutProps) {
  const status = buildPatientStatus(mode, context);
  if (status.rows || status.cells.length === 0)
    return (
      <StatusFirstLayout
        option="A"
        mode={mode}
        context={context}
        statusCardProps={statusCardProps}
        legal={legal}
        why={why}
        change={change}
        calls={calls}
        ownerTargets={{}}
        ownerCalls={() => undefined}
        sheetRows={sheetRows}
        phoneMore={phoneMore}
        isPhone={isPhone}
        isPortrait={isPortrait}
      />
    );
  const nextKey = status.cells.find((cell) => !cell.clear && cell.action?.kind === "button")?.key;
  const next = status.cells.find((cell) => cell.key === nextKey);
  const clear = status.cells.filter((cell) => cell.clear).length;
  // People who own no gate (the catchment team, the GP) stay on a short list under the steps; a
  // number already beside a step is not listed twice.
  const ownerNumbers = new Set(
    status.cells
      .map((cell) => ownerTargets[cell.key])
      .filter((target): target is CallTarget => target !== undefined)
      .map((target) => ownerCalls(target)?.number)
      .filter(Boolean),
  );
  const others = calls.filter((row) => !row.number || !ownerNumbers.has(row.number));
  const checklist = (
    <section className={styles.checklist} aria-label="Steps to move" data-act={status.tone === "danger" || undefined}>
      <div className={styles.nextHead}>
        <span className={styles.eyebrow}>
          <StatusGlyph tone={status.tone} size={9} />
          {status.verdict}
        </span>
        <span className={styles.meter}>
          <b className={styles.mono}>
            {clear} of {status.cells.length}
          </b>{" "}
          clear · {status.meta}
        </span>
      </div>
      <ol className={styles.steps}>
        {status.cells.map((cell, index) => (
          <ChecklistStep
            key={cell.key}
            cell={cell}
            index={index}
            current={cell.key === nextKey}
            owner={ownerTargets[cell.key] ? ownerCalls(ownerTargets[cell.key]!) : undefined}
            hideAction={isPhone && cell.key === nextKey}
          />
        ))}
      </ol>
      {isPhone && next?.action ? (
        <div className={styles.phBar}>
          <CellAction action={next.action} primary />
        </div>
      ) : null}
    </section>
  );
  const othersCard = others.length > 0 ? <PatientCallCard rows={others} title="Also involved" /> : null;
  if (isPhone)
    return (
      <div className={styles.stack} data-layout="C">
        {checklist}
        {legal}
        {sheetRows}
        {othersCard}
        {change}
        {phoneMore}
      </div>
    );
  if (isPortrait)
    return (
      <div className={styles.stack} data-layout="C">
        {checklist}
        <div className={styles.twoUp}>
          {legal}
          {othersCard ?? why}
        </div>
        {sheetRows}
        {change}
        {othersCard ? why : null}
      </div>
    );
  return (
    <div className={styles.stack} data-layout="C">
      <div className={styles.cols}>
        <div className={styles.col}>
          {checklist}
          {sheetRows}
          {change}
        </div>
        <div className={styles.col} data-wf-rail="1121">
          {legal}
          {why}
          {othersCard}
        </div>
      </div>
    </div>
  );
}

function ChecklistStep({
  cell,
  index,
  current,
  owner,
  hideAction,
}: {
  cell: StatusCell;
  index: number;
  current: boolean;
  owner: CallRow | undefined;
  hideAction: boolean;
}) {
  return (
    <li className={styles.step} data-current={current || undefined} data-clear={cell.clear || undefined}>
      <span className={styles.stepMark} aria-hidden="true">
        {cell.clear ? "✓" : index + 1}
      </span>
      <span className={styles.stepText}>
        <span className={styles.gateLabel}>
          <StatusGlyph tone={cell.tone ?? "neutral"} size={9} />
          {cell.label}
        </span>
        <b className={styles.stepValue}>{cell.value}</b>
        <span className={styles.gateSub}>{cell.sub}</span>
      </span>
      <span className={styles.stepOwner}>
        <span className={styles.ownerText}>
          <span className={styles.ownerName}>{cell.owner}</span>
          {owner?.number ? <span className={styles.mono}>{owner.number}</span> : <span>No line held</span>}
        </span>
        {owner?.number ? <CallButton row={{ ...owner, name: cell.owner }} /> : null}
      </span>
      {cell.action && !hideAction ? (
        <span className={styles.stepAction}>
          <CellAction action={cell.action} primary={current} />
        </span>
      ) : null}
    </li>
  );
}

/* ---------------- Who to call ---------------- */

function CallButton({ row }: { row: CallRow }) {
  const toast = useOptionalToast();
  if (!row.number) return null;
  const number = row.number;
  return (
    <button
      type="button"
      className={styles.call}
      aria-label={`Call ${row.name}, ${number}`}
      onClick={() => {
        void navigator.clipboard?.writeText(number).catch(() => undefined);
        toast?.push({ tone: "info", title: "Number copied", body: "Not wired in this prototype." });
      }}
    >
      <PhoneCall size={20} aria-hidden="true" />
    </button>
  );
}

export function PatientCallCard({ rows, title = "Who to call" }: { rows: CallRow[]; title?: string }) {
  return (
    <Card data-testid="ward-patient-who-to-call">
      <CardHead level={3} icon={Phone} title={title} meta="Mock numbers" />
      {rows.length > 0 ? (
        <ul className={styles.calls}>
          {rows.map((row) => (
            <li key={row.key} className={styles.callRow}>
              <span className={styles.callText}>
                <b className={styles.callName}>{row.name}</b>
                <span className={styles.callRole}>{row.role}</span>
              </span>
              <span className={styles.callNumber}>
                {row.number ? (
                  <b className={styles.mono}>{row.number}</b>
                ) : (
                  <span className={styles.callRole}>No line held</span>
                )}
                {row.hours ? <span className={styles.callRole}>{row.hours}</span> : null}
              </span>
              <CallButton row={row} />
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.empty}>No contacts recorded for this record.</p>
      )}
    </Card>
  );
}

function PatientCallStrip({ rows, stacked }: { rows: CallRow[]; stacked: boolean }) {
  if (stacked) return <PatientCallCard rows={rows} />;
  return (
    <section className={styles.callStrip} aria-label="Who to call" data-testid="ward-patient-who-to-call">
      {rows.map((row) => (
        <div key={row.key} className={styles.callTile}>
          <span className={styles.callText}>
            <b className={styles.callName}>{row.name}</b>
            <span className={styles.callRole}>{row.role}</span>
            {row.number ? (
              <b className={styles.mono}>{row.number}</b>
            ) : (
              <span className={styles.callRole}>No line held</span>
            )}
          </span>
          <CallButton row={row} />
        </div>
      ))}
    </section>
  );
}

/** A row that opens a sheet (Destination, Transport, Review and corrections). */
export function PatientSheetRow({
  icon,
  title,
  sub,
  onOpen,
  testId,
}: {
  icon: ReactNode;
  title: string;
  sub: string;
  onOpen: () => void;
  testId?: string;
}) {
  return (
    <button type="button" className={styles.sheetRow} onClick={onOpen} data-testid={testId}>
      <span className={styles.sheetIcon}>{icon}</span>
      <span className={styles.callText}>
        <b className={styles.callName}>{title}</b>
        <span className={styles.callRole}>{sub}</span>
      </span>
      <ChevronRight size={16} aria-hidden="true" className={styles.chevron} />
    </button>
  );
}

export function PatientSheetRows({ children }: { children: ReactNode }) {
  return <div className={styles.sheetRows}>{children}</div>;
}
