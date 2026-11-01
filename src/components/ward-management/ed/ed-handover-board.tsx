"use client";

// ED handover table (Josh, 1 Nov 2026), built from the approved mock-up in
// `ward-redesign/ed-board/ed-handover-board.tsx`. The desktop board as the department's
// handover table, in the pattern of the rebuilt Waiting page: a card head with the title, count,
// search and order; the filter chips and tier key under it; quiet capital column heads; rows grouped
// by time in the department; and an Enlarge button that gives the table the whole screen.
import { ChevronDown, Maximize2, Minimize2 } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Button, PortraitRail, SearchField, Segmented, StatusGlyph } from "@/components/wf";
import { EdBoardChips } from "./ed-board-chips";
import { EdNeedsYou } from "./ed-needs-you";
import type { EdScreenContext } from "./ed-screen-context";
import styles from "./ed.module.css";
import { recordedEdDeparture } from "@/components/ward-management/ward-ed-presence";
import { splitDuration } from "@/components/ward-management/ward-clock";
import { renderEdBoardRow } from "./ed-screen-board-row";
import { TierBarsKey } from "./ed-handover-cells";
import handover from "./ed-handover.module.css";

const COLUMNS = ["Patient", "In ED", "Bay", "Presentation", "Form", "Checks", "Referral", "Next"] as const;

type Band = {
  id: string;
  title: string;
  note?: string;
  tone?: "danger" | "warning";
  test: (minutes: number) => boolean;
};

export function EdHandoverBoard({ ctx }: { ctx: EdScreenContext }) {
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
      title: `8 to ${Math.round(accessTarget / 60)} hours`,
      tone: "warning",
      test: (m) => m >= 480 && m < accessTarget,
    },
    { id: "under", title: "Under 8 hours", test: (minutes) => minutes < 480 },
  ];

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
  const orderWords =
    patientSort === "longest"
      ? "Longest in ED first"
      : patientSort === "name"
        ? "A to Z by surname"
        : "In current order";

  return (
    <section
      aria-label="This department's patients"
      data-pane="board"
      className={`${styles.panel} ${styles.full} ${styles.listSection} ${handover.handover}`}
      data-enlarged={fullscreenBoard ? "true" : undefined}
    >
      <div className={handover.handoverHead}>
        <div className={handover.handoverTitle}>
          <h2>
            ED handover{" "}
            <span className={handover.handoverCount}>
              {filtered ? `${boardMatchCount} of ${patients.length}` : patients.length}
            </span>
          </h2>
          <p>{orderWords}</p>
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
          <Segmented<string>
            label="Sort patients"
            size="sm"
            value={patientSort}
            onChange={setPatientSort}
            items={[
              { id: "longest", label: "Longest in ED" },
              { id: "name", label: "Name" },
              { id: "current", label: "Current order" },
            ]}
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
          <Button
            variant={fullscreenBoard ? "pri" : "sec"}
            size="md"
            icon={fullscreenBoard ? Minimize2 : Maximize2}
            aria-pressed={fullscreenBoard}
            onClick={() => setFullscreenBoard((previous) => !previous)}
            title={fullscreenBoard ? "Back to the page (Esc)" : "Show the table on the whole screen"}
          >
            {fullscreenBoard ? "Exit full screen" : "Enlarge"}
          </Button>
        </div>
      </div>
      <div className={handover.handoverFilters}>
        <EdBoardChips ctx={ctx} />
      </div>
      <div className={handover.handoverKey}>
        <TierBarsKey />
        {filtered ? <span>Filters highlight; everyone stays on the table</span> : null}
      </div>
      {patients.length === 0 ? (
        <p className={styles.placeholder}>Nobody recorded on this department&apos;s psychiatry list.</p>
      ) : (
        <>
          {boardMatchCount === 0 ? (
            <p className={styles.noPatientMatches}>No one matches. Everyone stays below, dimmed.</p>
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
                  {COLUMNS.map((column) => (
                    <th key={column} scope="col">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>{body}</tbody>
            </table>
          </div>
          {sheet}
        </>
      )}
    </section>
  );
}
