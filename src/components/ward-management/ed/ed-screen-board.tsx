"use client";

// "ED psychiatry": the department's board, with its filters, search and sort, as a table on wider
// screens and a list on a phone. Split out of `ed-screen.tsx` unchanged (fix list 2.5 and 9.6,
// 15 Oct 2026).
import type { ReactNode } from "react";
import { PortraitRail, SearchField, Segmented } from "@/components/wf";
import { EdBoardChips } from "./ed-board-chips";
import { EdNeedsYou } from "./ed-needs-you";
import { renderEdBoardRow } from "./ed-screen-board-row";
import type { EdScreenContext } from "./ed-screen-context";
import styles from "./ed.module.css";
import { TierKey } from "../tier-key";
import { formatInstantWithDay, splitDuration } from "@/components/ward-management/ward-clock";
import { patientIdentityLine } from "@/components/ward-management/ward-patient-resolver";

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
    sentForBed,
    now,
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
        {/* D-91: the kit's one page search field. Search highlights like the chips, so the "of … match"
            line beside it stays the count; the placeholder names what is searched, with no "…". */}
        <SearchField
          className={styles.patientSearch}
          label="Find a patient or UMRN"
          placeholder="Name or UMRN"
          value={patientQuery}
          onValueChange={setPatientQuery}
        />
        {boardTable ? (
          // Final round (31 Oct 2026): the kit's Segmented sort, as the other redesigned pages' sorts
          // (Patients, Transport), in place of a browser-default select. Same three orders.
          <span className={styles.patientSort}>
            <span aria-hidden="true">Sort</span>
            <Segmented<string>
              label="Sort patients"
              size="sm"
              value={patientSort}
              onChange={setPatientSort}
              items={[
                { id: "current", label: "Current order" },
                { id: "longest", label: "Longest in ED" },
                { id: "name", label: "Patient name" },
              ]}
            />
          </span>
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
      {sentForBed.length > 0 ? (
        // WT-04 (walk-through, 26 Oct 2026): a bed request shows from Send, before any journey.
        <div className={styles.sentForBed} data-testid="ed-sent-for-bed">
          <h3 className={styles.sentForBedHeading}>
            Asked for a ward bed, no journey yet <b>{sentForBed.length}</b>
          </h3>
          <ul aria-label="Asked for a ward bed, no journey yet">
            {sentForBed.map((sent) => (
              <li key={sent.id}>
                <span className={styles.sentForBedName}>{patientIdentityLine(sent.person)}</span>
                <span>{sent.wards.map((ward) => `${ward.name}, ${ward.state}`).join(" · ")}</span>
                <span className={styles.sentForBedClock}>
                  Sent {formatInstantWithDay(sent.sentAt, now)} · {splitDuration(sent.waitedMinutes)} since sent
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
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
                  // Item 4: the name follows the Sort choice, so it never claims an order the rows lack.
                  aria-label={`Emergency department board, ${
                    patientSort === "longest"
                      ? "longest in ED first"
                      : patientSort === "name"
                        ? "A to Z by patient name"
                        : "in current order"
                  }`}
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
