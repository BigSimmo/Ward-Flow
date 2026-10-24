"use client";

// "ED psychiatry": the department's board, with its filters, search and sort, as a table on wider
// screens and a list on a phone. Split out of `ed-screen.tsx` unchanged (fix list 2.5 and 9.6,
// 15 Oct 2026).
import type { ReactNode } from "react";
import { PortraitRail } from "@/components/wf";
import { EdBoardChips } from "./ed-board-chips";
import { EdNeedsYou } from "./ed-needs-you";
import { renderEdBoardRow } from "./ed-screen-board-row";
import type { EdScreenContext } from "./ed-screen-context";
import styles from "./ed.module.css";
import { TierKey } from "../tier-key";

export function EdBoardSection({ ctx }: { ctx: EdScreenContext }) {
  const {
    boardTable,
    isPhone,
    isTabletPortrait,
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
    hasBoardDrafts,
    boardMatchCount,
  } = ctx;
  return (
    <section
      aria-label="This department's patients"
      data-pane="board"
      className={`${styles.panel} ${styles.full} ${styles.listSection}${!boardTable && fullscreenBoard ? ` ${styles.fullscreenBoard}` : ""}`}
      data-handover-view={boardTable && fullscreenBoard ? "true" : undefined}
    >
      <div className={styles.ph}>
        <h2>ED psychiatry</h2>
        <div className={styles.phActions}>
          <button
            type="button"
            className={styles.fullscreenToggleBtn}
            onClick={() => setFullscreenBoard((prev) => !prev)}
            aria-label={
              boardTable
                ? fullscreenBoard
                  ? "Exit handover view"
                  : "Handover view, full width"
                : fullscreenBoard
                  ? "Exit larger screen mode"
                  : "Larger screen mode"
            }
            title={fullscreenBoard ? "Exit larger screen mode (Esc)" : "Expand board to larger screen mode"}
          >
            <svg
              className={styles.expandIcon}
              viewBox="0 0 24 24"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              {fullscreenBoard ? (
                <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
              ) : (
                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
              )}
            </svg>
            <span>
              {boardTable
                ? fullscreenBoard
                  ? "Exit handover view"
                  : "Handover view"
                : fullscreenBoard
                  ? "Exit larger screen"
                  : "Larger screen mode"}
            </span>
          </button>
          {boardTable && needsRailSlides ? (
            <PortraitRail
              title="My list"
              summary={String(needsYouItems.length)}
              open={needsRailOpen}
              onOpenChange={setNeedsRailOpen}
            >
              <EdNeedsYou items={needsYouItems} framed={false} />
            </PortraitRail>
          ) : null}
          <span className={styles.count}>
            <b>{patients.length}</b> {patients.length === 1 ? "person" : "people"}
          </span>
        </div>
      </div>
      {/* C1 (phone simplification, 19 Oct 2026): on a phone the chips fold into the Filter button
          beside Board, Needs you and Lists (ed-screen-phone.tsx). */}
      {isPhone ? null : <EdBoardChips ctx={ctx} />}
      <div className={styles.boardTools}>
        <label className={styles.patientSearch}>
          <span aria-hidden="true">⌕</span>
          <input
            type="search"
            aria-label="Find a patient or UMRN"
            placeholder="Find a patient or UMRN…"
            value={patientQuery}
            onChange={(event) => setPatientQuery(event.target.value)}
          />
        </label>
        {boardTable ? (
          <label className={styles.patientSort}>
            Sort{" "}
            <select value={patientSort} onChange={(event) => setPatientSort(event.target.value)}>
              <option value="current">Current order</option>
              <option value="longest">Longest in ED</option>
              <option value="name">Patient name</option>
            </select>
          </label>
        ) : null}
        <span className={styles.draftNote} role="status">
          {/* Overall review (20 Oct 2026): says something only when there is something unsaved;
              "Draft fields · This screen only" meant nothing to a clinician. */}
          {hasBoardDrafts ? "Unsaved changes · This screen only" : null}
        </span>
        <span className={styles.boardResult} role="status">
          <span className={styles.boardHint}>Filters highlight, everyone stays</span> <b>{boardMatchCount}</b> of{" "}
          {patients.length} match<span className="sr-only"> · Synthetic data</span>
        </span>
      </div>
      {patients.length === 0 ? (
        <p className={styles.placeholder}>
          Nobody is on this department&apos;s psychiatry list. Absence here means none is recorded, not that the
          department is empty.
        </p>
      ) : (
        (() => {
          /** A2: the open person sheet renders after the table, never inside a table row. */
          let a2Sheet: ReactNode = null;
          const renderBoardRow = (movement: (typeof visiblePatients)[number]) =>
            renderEdBoardRow(movement, ctx, (sheet) => {
              a2Sheet = sheet;
            });
          if (boardTable) {
            const a2Rows = visiblePatients.map(renderBoardRow);
            const columns = isTabletPortrait
              ? ["T", "Patient", "In ED", "Referral", "Next"]
              : ["T", "Patient", "In ED", "Bay", "Form", "Cleared", "Review", "Referral", "Next"];
            return (
              <>
                {boardMatchCount === 0 ? (
                  <p className={styles.noPatientMatches}>
                    No one matches this search and filter. Everyone stays below, dimmed.
                  </p>
                ) : null}
                <TierKey />
                <table
                  className={styles.a2Table}
                  data-columns={isTabletPortrait ? "priority" : "all"}
                  aria-label="Emergency department board, longest wait first"
                >
                  <colgroup>
                    {columns.map((column) => (
                      <col key={column} data-col={column} />
                    ))}
                  </colgroup>
                  <thead>
                    <tr>
                      {columns.map((column) => (
                        <th key={column} scope="col">
                          {column === "T" ? <abbr title="Tier">T</abbr> : column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>{a2Rows}</tbody>
                </table>
                {a2Sheet}
              </>
            );
          }
          return (
            <>
              {boardMatchCount === 0 ? (
                <p className={styles.noPatientMatches}>
                  No one matches this search and filter. Everyone stays below, dimmed.
                </p>
              ) : null}
              <TierKey />
              <ul className={styles.phoneBoardList} aria-label="Emergency department board">
                {visiblePatients.map(renderBoardRow)}
              </ul>
            </>
          );
        })()
      )}
    </section>
  );
}
