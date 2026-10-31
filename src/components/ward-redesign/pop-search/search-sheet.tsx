"use client";

/**
 * MOCK-UP (D-91, "Phone search opens full height, like Help"): on a phone the header search opens
 * as a full-height sheet, drawn exactly as Help's drawer is (the same `Sheet`, placement, header,
 * body and foot), with the search field pinned at the top and the results scrolling under it.
 * Computers keep today's popover under the header box (`global-search.tsx`).
 *
 * The fork owns the state, the keyboard and the rows; this only frames them.
 */
import type { ReactNode, RefObject } from "react";
import { Search } from "lucide-react";

import { Sheet } from "@/components/wf/sheet";
import barStyles from "@/components/ward-management/shell/ward-bar.module.css";

import local from "@/components/ward-redesign/pop-search/search.module.css";

export function SearchSheet({
  open,
  onClose,
  initialFocusRef,
  field,
  chips,
  footerLink,
  children,
}: {
  open: boolean;
  onClose: () => void;
  /** The pinned field's input, focused as the sheet opens. */
  initialFocusRef: RefObject<HTMLInputElement | null>;
  /** The pinned field (`parts/search-field.tsx`). */
  field: ReactNode;
  /** The kind chips, pinned with the field once something is typed. */
  chips: ReactNode;
  /** "Full patient search", in the foot. */
  footerLink: ReactNode;
  /** The result groups. */
  children: ReactNode;
}) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Search"
      testId="ward-global-search-sheet"
      initialFocusRef={initialFocusRef}
      headerLeading={
        <span className={barStyles.drawerTile} aria-hidden="true">
          <Search aria-hidden="true" className={barStyles.drawerHeadingIcon} strokeWidth={1.75} />
        </span>
      }
      placement="right"
      desktopBackdropClassName={barStyles.drawerBackdrop}
      contentClassName={`${barStyles.drawerSheet} ${barStyles.drawerSheetWide}`}
      headerClassName={barStyles.drawerHeader}
      titleClassName={barStyles.drawerTitle}
      closeButtonClassName={barStyles.drawerClose}
      bodyClassName={`${barStyles.drawerBody} ${local.sheetBody}`}
      footer={
        <div className={barStyles.drawerFoot}>
          <span>Nothing typed here is saved</span>
          {footerLink}
        </div>
      }
      footerClassName={barStyles.drawerFooter}
    >
      <div className={local.sheetDock}>
        {field}
        {chips}
      </div>
      {children}
    </Sheet>
  );
}
