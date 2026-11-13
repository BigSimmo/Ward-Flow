"use client";

// The ED screen's phone-only pieces: the Board, Needs you and Lists switch, and a board row as a
// phone list row. Split out of `ed-screen.tsx` unchanged (fix list 2.5 and 9.6, 15 Oct 2026).
import { Fragment, type ReactNode } from "react";
import { splitDuration } from "@/components/ward-management/ward-clock";
import { urgencyTierLabel } from "@/components/ward-management/ward-priority";
import { Maximize2, Minimize } from "lucide-react";
import { FolderTabs, PhoneFilterFold, PhoneListRow, Segmented, StatusGlyph, folderTabClasses } from "@/components/wf";
import type { EdBoardRowModel } from "./ed-screen-board-row";
import { EdBoardChips } from "./ed-board-chips";
import { edRowReferralStatus } from "./ed-referral-status";
import type { EdScreenContext } from "./ed-screen-context";
import { edWaitTone } from "./ed-screen-model";
import { noFormWords } from "@/components/ward-management/ward-legal-status";
import { legalFormNowWords } from "@/components/ward-management/ward-legal-form-progression";
import styles from "./ed.module.css";
import foldRow from "./ed-phone-fold.module.css";

/**
 * The Board, My list and Lists switch with the board's Filter fold, as one phone row. The ED page now
 * uses `EdBoardTabs`; the redesigned ED board (`ed-board-redesign.tsx`) keeps this row.
 */
export function EdPhonePanes({ ctx }: { ctx: EdScreenContext }) {
  const { phonePane, setPhonePane, patients, needsYouItems, boardFilter } = ctx;
  return (
    <div className={`${styles.phonePanes} ${foldRow.paneRow}`}>
      <div>
        <Segmented
          label="Show"
          size="md"
          value={phonePane}
          onChange={setPhonePane}
          items={[
            { id: "board" as const, label: "Board", count: patients.length },
            { id: "needs" as const, label: "My list", count: needsYouItems.length },
            { id: "lists" as const, label: "Lists" },
          ]}
        />
      </div>
      {phonePane === "board" ? (
        <PhoneFilterFold
          count={boardFilter === "all" ? 0 : 1}
          title="Filter the board"
          description="Everyone stays on the board."
          data-testid="ward-ed-filter-fold"
        >
          <EdBoardChips ctx={ctx} className={foldRow.sheetChips} />
        </PhoneFilterFold>
      ) : null}
    </div>
  );
}

/**
 * The ED board's tabs (page tops, Josh 9 Nov 2026): Board and My list on every size, Lists too on a
 * phone, as curved folder tabs under the hero (underline tabs on a desktop). C1 (19 Oct 2026): on a
 * phone the board's filter chips fold into one Filter button at the row's end, shown on the Board
 * only, where they apply. Wider screens end the row with Enlarge (the handover view).
 */
export function EdBoardTabs({ ctx }: { ctx: EdScreenContext }) {
  const {
    phonePane,
    setPhonePane,
    patients,
    needsYouItems,
    boardFilter,
    isPhone,
    fullscreenBoard,
    setFullscreenBoard,
  } = ctx;
  const pane = !isPhone && phonePane === "lists" ? "board" : phonePane;
  return (
    <FolderTabs
      label="ED board views"
      value={pane}
      className={foldRow.pageTabs}
      testId="ward-ed-tabs"
      more={
        isPhone ? (
          pane === "board" ? (
            <PhoneFilterFold
              count={boardFilter === "all" ? 0 : 1}
              title="Filter the board"
              description="Everyone stays on the board."
              data-testid="ward-ed-filter-fold"
              className={`${folderTabClasses.more} ${foldRow.tabButton}`}
            >
              <EdBoardChips ctx={ctx} className={foldRow.sheetChips} />
            </PhoneFilterFold>
          ) : null
        ) : (
          <button
            type="button"
            className={`${folderTabClasses.more} ${foldRow.tabButton}`}
            aria-pressed={fullscreenBoard}
            onClick={() => {
              setPhonePane("board");
              setFullscreenBoard((prev) => !prev);
            }}
            data-testid="ward-ed-tabs-enlarge"
          >
            {fullscreenBoard ? (
              <Minimize size={16} strokeWidth={1.75} aria-hidden="true" />
            ) : (
              <Maximize2 size={16} strokeWidth={1.75} aria-hidden="true" />
            )}
            {fullscreenBoard ? "Exit enlarge" : "Enlarge"}
          </button>
        )
      }
    >
      <Segmented
        className={folderTabClasses.switch}
        label="Show"
        size="md"
        value={pane}
        onChange={setPhonePane}
        items={[
          { id: "board" as const, label: "Board", count: patients.length },
          { id: "needs" as const, label: "My list", count: needsYouItems.length },
          ...(isPhone ? [{ id: "lists" as const, label: "Lists" }] : []),
        ]}
      />
    </FolderTabs>
  );
}

/** One board row as a phone list row, with its person sheet after it. */
export function renderEdBoardPhoneRow(
  row: EdBoardRowModel,
  ctx: EdScreenContext,
  { personSheet, phoneBay }: { personSheet: ReactNode; phoneBay: string },
): ReactNode {
  const { movement, minutesInDepartment, medicalClearance, patientInfo, nextAction } = row;
  const { accessTarget, isBoardRowDim, isPhone, setPhoneSheetReason, setPhoneSheetFor } = ctx;
  // At or over, never strictly over: the one ED long-wait rule (ward-pressure.ts, ops-16, 13 Oct
  // 2026) is red "once the longest wait reaches the ED access target".
  const phoneOverTarget = minutesInDepartment >= accessTarget;
  const phoneWaitTone = edWaitTone(movement.urgency, minutesInDepartment, accessTarget);
  const phoneNextLabel =
    movement.edOutcome !== undefined && !movement.leftDepartmentAt
      ? "Left the department"
      : movement.closure
        ? "Withdrawn"
        : nextAction?.label;
  return (
    <Fragment key={movement.id}>
      <PhoneListRow
        as="li"
        className={
          isBoardRowDim(movement) ? `${styles.phoneBoardRow} ${styles.phoneBoardRowDim}` : styles.phoneBoardRow
        }
        data-testid={`ward-ed-patient-${movement.id}`}
        actNow={phoneOverTarget}
        leading={
          <span
            className={styles.phoneTier}
            data-urgency={movement.urgency}
            data-testid={`ward-ed-tier-${movement.id}`}
          >
            <span aria-hidden="true">T{movement.urgency}</span>
            <span className="sr-only">{urgencyTierLabel(movement.urgency)}</span>
          </span>
        }
        // Audit CS3-09: the UMRN beside the name, as on the desktop row, so two look-alike names on
        // a phone are told apart by a second identifier before a row is opened.
        name={
          <>
            <span>{patientInfo.formalName}</span>
            <span className={styles.phoneUmrn}> · {patientInfo.umrn}</span>
          </>
        }
        meta={[
          // No em-dash and no truncated destination; the form lives in the sheet. Change 2 (D-77):
          // the second line says where the referral stands, the same words as the board.
          phoneBay,
          edRowReferralStatus(row, ctx).phone,
          ...(isPhone
            ? []
            : [
                // Audit CS3-04: the desktop rule, "No form" only for a recorded Voluntary status.
                // 1.1 (K1): the one current legal position ("Form 3B", or "Form 3B ended" once recorded).
                legalFormNowWords(movement) ?? noFormWords(movement.legalStatus),
                medicalClearance === undefined
                  ? "Clearance pending"
                  : medicalClearance.cleared
                    ? "Cleared"
                    : "Not cleared",
                movement.examination ? "Reviewed" : "Not reviewed",
              ]),
        ]
          .filter(Boolean)
          .join(" · ")}
        value={
          <>
            {phoneWaitTone ? <StatusGlyph tone={phoneWaitTone} size={8} /> : null} {splitDuration(minutesInDepartment)}
            {phoneOverTarget ? <span className="sr-only"> · at or over the access target</span> : null}
          </>
        }
        time={isPhone ? phoneNextLabel : undefined}
        action={
          !isPhone && nextAction && !movement.closure
            ? { label: nextAction.label, disabledReason: nextAction.blocked, onAction: nextAction.run }
            : undefined
        }
        onSelect={() => {
          setPhoneSheetReason(undefined);
          setPhoneSheetFor(movement.id);
        }}
      />
      {personSheet}
    </Fragment>
  );
}
