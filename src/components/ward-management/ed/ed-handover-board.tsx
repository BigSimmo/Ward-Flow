"use client";

// ED handover table (Josh, 1 Nov 2026), built from the approved mock-up in
// `ward-redesign/ed-board/ed-handover-board.tsx`. The desktop board as the department's
// handover table, in the pattern of the rebuilt Waiting page: a card head with the title, count,
// search and order; the filter chips and tier key under it; quiet capital column heads; rows grouped
// by time in the department; and an Enlarge button that gives the table the whole screen.
import { ChevronDown, Minimize2 } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Button, PortraitRail, SearchField, StatusGlyph, FullScreenFrame, FullScreenMarkSlot } from "@/components/wf";
import { hasOpenSheet } from "@/components/wf/sheet-focus";
import { EdBoardChips } from "./ed-board-chips";
import { EdNeedsYou } from "./ed-needs-you";
import type { EdScreenContext } from "./ed-screen-context";
import styles from "./ed.module.css";
import { recordedEdDeparture } from "@/components/ward-management/ward-ed-presence";
import { formatSheetMoment, splitDuration } from "@/components/ward-management/ward-clock";
import { ED_SEVERE_PRESSURE_WAIT_MINUTES } from "@/components/ward-management/ward-operational-defaults";
import { movementUmrn } from "@/components/ward-management/ward-patient-resolver";
import { edStageLabel } from "./ed-referral-status";
import { ListExportButton } from "../ward-list-export-button";
import { renderEdBoardRow } from "./ed-screen-board-row";
import { TierBarsKey } from "./ed-handover-cells";
import handover from "./ed-handover.module.css";
import { EdCrewsWaitingLine } from "@/components/ward-management/ed-crews-waiting-line";
import { useClockZoneLabel } from "@/components/ward-management/use-clock-zone-label";

const COLUMNS = ["Patient", "In ED", "Bay", "Presentation", "Form", "Checks", "Referral", "Next"] as const;

type Band = {
  id: string;
  title: string;
  note?: string;
  tone?: "danger" | "warning";
  test: (minutes: number) => boolean;
};

export function EdHandoverBoard({ ctx }: { ctx: EdScreenContext }) {
  const zone = useClockZoneLabel();
  const {
    needsRailSlides,
    needsYouItems,
    needsRailOpen,
    setNeedsRailOpen,
    fullscreenBoard,
    setFullscreenBoard,
    patients,
    visiblePatients,
    patientQuery,
    setPatientQuery,
    patientSort,
    setPatientSort,
    boardMatchCount,
    accessTarget,
    now,
  } = ctx;
  const [folded, setFolded] = useState<Record<string, boolean>>({});

  // The enlarged table covers the page; Escape gives the page back.
  useEffect(() => {
    if (!fullscreenBoard) return;
    const onKey = (event: KeyboardEvent) => {
      // An Escape a sheet on top (the person sheet) takes is not the board's: one Escape, one layer.
      if (event.defaultPrevented || hasOpenSheet()) return;
      if (event.key === "Escape" && !document.querySelector("[role=alertdialog],[role=menu]"))
        setFullscreenBoard(false);
    };
    document.addEventListener("keydown", onKey);
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [fullscreenBoard, setFullscreenBoard]);

  const minutesOf = (movement: (typeof visiblePatients)[number]) =>
    Math.max(Math.min(now, recordedEdDeparture(movement) ?? now) - movement.openedAt, 0);
  const bands: Band[] = [
    {
      id: "over",
      title: `Over ${Math.round(accessTarget / 60)} hours`,
      note: "past the access target",
      tone: "danger",
      test: (minutes) => minutes >= accessTarget,
    },
    {
      id: "eight",
      title: `${ED_SEVERE_PRESSURE_WAIT_MINUTES / 60} to ${Math.round(accessTarget / 60)} hours`,
      tone: "warning",
      test: (m) => m >= ED_SEVERE_PRESSURE_WAIT_MINUTES && m < accessTarget,
    },
    {
      id: "under",
      title: `Under ${ED_SEVERE_PRESSURE_WAIT_MINUTES / 60} hours`,
      test: (minutes) => minutes < ED_SEVERE_PRESSURE_WAIT_MINUTES,
    },
  ];

  // Export (feature 44): everyone on the table (filters only highlight), never names; the builder
  // loads on the click.
  const exportList = async () => {
    const lookup = { patients: ctx.registryPatients, referrals: ctx.referrals, movements: ctx.movements };
    (await import("./ed-export")).downloadEdList(
      visiblePatients,
      {
        department: ctx.department.name,
        umrnOf: (movement) => movementUmrn(movement, lookup),
        // B3 (D-21): no ED bay is recorded, so the Bay column says so rather than inventing one.
        bayOf: () => "Not recorded",
        stageOf: (movement) => edStageLabel(movement.stage),
        minutesOf,
        at: (instant) => formatSheetMoment(instant, ctx.dayZero),
      },
      {
        asAt: formatSheetMoment(now, ctx.dayZero, { includeYearAndZone: true, zone }),
        scope: `${ctx.department.name} psychiatry list; everyone on the table, regardless of search or highlights`,
      },
    );
  };

  /** A2: the open person sheet renders after the table, never inside a table row. */
  let sheet: ReactNode = null;
  const renderRow = (movement: (typeof visiblePatients)[number]) =>
    renderEdBoardRow(movement, ctx, (next) => {
      sheet = next;
    });

  const body: ReactNode[] = [];
  if (patientSort === "longest") {
    for (const band of bands) {
      const list = visiblePatients.filter((movement) => band.test(minutesOf(movement)));
      if (list.length === 0) continue;
      const open = !folded[band.id];
      body.push(
        <tr key={`band-${band.id}`} className={handover.bandRow} data-open={open || undefined}>
          <td colSpan={COLUMNS.length}>
            <button
              type="button"
              className={handover.bandButton}
              aria-expanded={open}
              onClick={() => setFolded((current) => ({ ...current, [band.id]: open }))}
            >
              <ChevronDown size={14} aria-hidden="true" className={open ? undefined : handover.bandFolded} />
              {band.tone ? <StatusGlyph tone={band.tone} size={9} /> : null}
              <span className={handover.bandTitle}>{band.title}</span>
              <span className={handover.bandCount}>{list.length}</span>
              {band.note ? <span className={handover.bandNote}>{band.note}</span> : null}
              <span className={handover.bandLongest}>
                Longest <b>{splitDuration(minutesOf(list[0]))}</b>
              </span>
            </button>
          </td>
        </tr>,
      );
      if (open) body.push(...list.map(renderRow));
    }
  } else {
    body.push(...visiblePatients.map(renderRow));
  }

  const filtered = boardMatchCount !== patients.length;
  const ORDER_NAME: Record<string, string> = {
    longest: "longest in ED first",
    name: "A to Z by surname",
    current: "in current order",
  };

  return (
    // D-192 (shared design parts item 7, F-39): enlarged, the table covers the page footer, so the
    // frame draws the synthetic-data mark (on the filter row, under Exit full screen).
    <FullScreenFrame
      as="section"
      enlarged={fullscreenBoard}
      aria-label="This department's patients"
      data-pane="board"
      className={`${styles.panel} ${styles.full} ${styles.listSection} ${handover.handover}`}
      data-enlarged={fullscreenBoard ? "true" : undefined}
    >
      {/* UX review (D-270, pattern E): one row for the title, search and Export; one row of
          filters. Sort moves to the column heads, the key behind "?", Enlarge stays on the tab row. */}
      <div className={handover.handoverHead}>
        <div className={handover.handoverTitle}>
          {/* UX review 20 Nov 2026 (Josh "yes"): "On the board", since the page is already the ED's
              and "handover" is the print's word. */}
          <h2>
            On the board{" "}
            <span className={handover.handoverCount}>
              {filtered ? `${boardMatchCount} of ${patients.length}` : patients.length}
            </span>
          </h2>
          <EdCrewsWaitingLine movements={patients} now={now} />
        </div>
        <div className={handover.handoverTools}>
          {/* D-91: the one page search field. */}
          <SearchField
            className={handover.handoverSearch}
            label="Find a patient or UMRN"
            placeholder="Name or UMRN"
            value={patientQuery}
            onValueChange={setPatientQuery}
          />
          {needsRailSlides && !fullscreenBoard ? (
            <PortraitRail
              title="My list"
              summary={String(needsYouItems.length)}
              open={needsRailOpen}
              onOpenChange={setNeedsRailOpen}
            >
              <EdNeedsYou items={needsYouItems} framed={false} />
            </PortraitRail>
          ) : null}
          <ListExportButton load={exportList} disabled={patients.length === 0} testId="ed-handover-export" />
          {/* Enlarge sits on the tab row; enlarged, the tab row is covered, so the way back sits here. */}
          {fullscreenBoard ? (
            <Button
              variant="pri"
              size="md"
              icon={Minimize2}
              aria-pressed
              onClick={() => setFullscreenBoard(false)}
              title="Back to the page (Esc)"
            >
              Exit full screen
            </Button>
          ) : null}
          <details className={handover.keyToggle}>
            <summary aria-label="What the bars mean" title="What the bars mean">
              ?
            </summary>
            <div className={handover.keyPopover}>
              <TierBarsKey />
            </div>
          </details>
        </div>
      </div>
      <div className={handover.handoverFilters}>
        <EdBoardChips ctx={ctx} />
        {filtered ? <span className={handover.filterNote}>Filters highlight; everyone stays on the table</span> : null}
        <FullScreenMarkSlot />
      </div>
      {patients.length === 0 ? (
        <p className={styles.placeholder}>Nobody recorded on this department&apos;s psychiatry list.</p>
      ) : (
        <>
          {boardMatchCount === 0 ? (
            <p className={styles.noPatientMatches}>Nobody matches. Everyone stays below, dimmed.</p>
          ) : null}
          <div className={handover.handoverScroll}>
            <table
              className={`${styles.a2Table} ${handover.handoverTable}`}
              data-columns="handover"
              aria-label={`Emergency department handover, ${ORDER_NAME[patientSort]}`}
            >
              <colgroup>
                {COLUMNS.map((column) => (
                  <col key={column} data-col={column} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  {COLUMNS.map((column) => {
                    const sortId = column === "Patient" ? "name" : column === "In ED" ? "longest" : null;
                    if (!sortId) {
                      return (
                        <th key={column} scope="col">
                          {column}
                        </th>
                      );
                    }
                    const active = patientSort === sortId;
                    return (
                      <th
                        key={column}
                        scope="col"
                        aria-sort={active ? (sortId === "name" ? "ascending" : "descending") : "none"}
                      >
                        <button
                          type="button"
                          className={handover.sortHead}
                          data-active={active ? "true" : undefined}
                          onClick={() => setPatientSort(active ? "current" : sortId)}
                        >
                          {column}
                          <ChevronDown size={12} strokeWidth={2} aria-hidden="true" />
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>{body}</tbody>
            </table>
          </div>
          {sheet}
        </>
      )}
    </FullScreenFrame>
  );
}
