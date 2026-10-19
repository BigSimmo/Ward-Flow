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
      const control = invalid
        ? Array.from(
            panel.querySelectorAll<HTMLElement>(
              'input[aria-invalid="true"], select[aria-invalid="true"], textarea[aria-invalid="true"]',
            ),
          ).find((element) => !element.matches(":disabled") && !element.closest("[hidden], [inert]"))
        : null;
      (control ?? panel.querySelector<HTMLElement>("h3[tabindex]"))?.focus({ preventScroll: true });
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
