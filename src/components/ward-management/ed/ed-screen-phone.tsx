"use client";

// The ED screen's phone-only pieces: the Board, Needs you and Lists switch, and a board row as a
// phone list row. Split out of `ed-screen.tsx` unchanged (fix list 2.5 and 9.6, 15 Oct 2026).
import { Fragment, type ReactNode } from "react";
import { splitDuration } from "@/components/ward-management/ward-clock";
import { urgencyTierLabel } from "@/components/ward-management/ward-priority";
import { PhoneFilterFold, PhoneListRow, Segmented, StatusGlyph } from "@/components/wf";
import type { EdBoardRowModel } from "./ed-screen-board-row";
import { EdBoardChips } from "./ed-board-chips";
import type { EdScreenContext } from "./ed-screen-context";
import { edWaitTone } from "./ed-screen-model";
import styles from "./ed.module.css";
import foldRow from "./ed-phone-fold.module.css";

/**
 * Phone: Board, Needs you and Lists are one tap apart (v10 ED page, phone). C1 (19 Oct 2026): the
 * board's filter chips fold into one Filter button at the end of this pinned row, so the first
 * person sits higher. It shows on the Board only, where the filters apply.
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
            { id: "needs" as const, label: "Needs you", count: needsYouItems.length },
            { id: "lists" as const, label: "Lists" },
          ]}
        />
      </div>
      {phonePane === "board" ? (
        <PhoneFilterFold
          count={boardFilter === "all" ? 0 : 1}
          title="Filter the board"
          description="A filter highlights the people it names. Everyone stays on the board."
          data-testid="ward-ed-filter-fold"
        >
          <EdBoardChips ctx={ctx} className={foldRow.sheetChips} />
        </PhoneFilterFold>
      ) : null}
    </div>
  );
}

/** One board row as a phone list row, with its person sheet after it. */
export function renderEdBoardPhoneRow(
  row: EdBoardRowModel,
  ctx: EdScreenContext,
  { personSheet, phoneBay }: { personSheet: ReactNode; phoneBay: string },
): ReactNode {
  const { movement, minutesInDepartment, medicalClearance, patientInfo, acceptedUnit, referredTo, nextAction } = row;
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
        name={patientInfo.formalName}
        meta={[
          // No em-dash and no truncated destination; the form lives in the sheet.
          phoneBay,
          acceptedUnit ? `to ${acceptedUnit.name.split(" — ")[0]}` : (referredTo ?? "In department"),
          ...(isPhone
            ? []
            : [
                movement.legalForm ? `Form ${movement.legalForm.code}` : "No form",
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
