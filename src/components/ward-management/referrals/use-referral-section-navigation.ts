import { useEffect, useRef, type RefObject } from "react";
import { canRestoreFocusTo } from "@/components/wf/sheet-focus";
import type { DrawerSection } from "./ward-referral-drawer-model";

/** Section navigation owns focus; ordinary field edits never move it. */
export function useReferralSectionNavigation({
  sectionId,
  bodyRef,
  isPhone,
  setActiveSection,
  setPreviewOpen,
  setConfirmationOpen,
  setIsSearchOpen,
  setPhoneStepOpen,
  setFlowError,
  sendPending,
  sentReferralId,
}: {
  sectionId: string;
  bodyRef: RefObject<HTMLDivElement | null>;
  isPhone: boolean;
  setActiveSection: (section: DrawerSection) => void;
  setPreviewOpen: (open: boolean) => void;
  setConfirmationOpen: (open: boolean) => void;
  setIsSearchOpen: (open: boolean) => void;
  setPhoneStepOpen: (open: boolean) => void;
  setFlowError: (error: string | null) => void;
  sendPending: boolean;
  sentReferralId: string | null;
}) {
  const sectionFocusFrame = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (sectionFocusFrame.current !== null) cancelAnimationFrame(sectionFocusFrame.current);
    },
    [],
  );

  function activateSection(section: DrawerSection, invalid = false) {
    setActiveSection(section);
    setPreviewOpen(false);
    setConfirmationOpen(false);
    setIsSearchOpen(false);
    if (isPhone) setPhoneStepOpen(true);
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
    if (sectionFocusFrame.current !== null) cancelAnimationFrame(sectionFocusFrame.current);
    // A modal opened before this frame keeps focus rather than giving it back to the drawer.
    sectionFocusFrame.current = requestAnimationFrame(() => {
      sectionFocusFrame.current = null;
      const panel = document.getElementById(`${sectionId}-${section}`);
      if (!panel?.isConnected || panel.closest("[hidden], [inert]") || !canRestoreFocusTo(panel)) return;
      // A refused step leads with its error summary, so the count is read before the fields.
      const summary = invalid ? panel.querySelector<HTMLElement>("[data-error-summary] [tabindex='-1']") : null;
      const control =
        invalid && !summary
          ? Array.from(
              panel.querySelectorAll<HTMLElement>(
                'input[aria-invalid="true"], select[aria-invalid="true"], textarea[aria-invalid="true"], button[data-referral-invalid]',
              ),
            ).find((element) => !element.matches(":disabled") && !element.closest("[hidden], [inert]"))
          : null;
      (summary ?? control ?? panel.querySelector<HTMLElement>("h3[tabindex]"))?.focus({ preventScroll: true });
      // Audit 7 RC-N2: the body was scrolled to the top, so a field lower in the step sat under the
      // phone sheet's pinned footer or off screen. Centre the field the error points to.
      control?.scrollIntoView?.({ block: "center" });
    });
  }

  function selectSection(id: DrawerSection) {
    if (sendPending || sentReferralId) return;
    setPreviewOpen(false);
    setConfirmationOpen(false);

    setFlowError(null);
    setActiveSection(id);
    setIsSearchOpen(false);
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
  }

  function phCloseSheet() {
    setPhoneStepOpen(false);
    setPreviewOpen(false);
    setConfirmationOpen(false);
    setFlowError(null);
  }
  function phOpenStep(id: DrawerSection) {
    selectSection(id);
    setPhoneStepOpen(true);
  }

  return { activateSection, selectSection, phCloseSheet, phOpenStep };
}
