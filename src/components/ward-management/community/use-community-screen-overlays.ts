/*
 * The community team screen's overlay hooks: the shared modal contract for its drawer and dialogs,
 * and the transport booking and cancelling state with its two dialogs' focus handling.
 *
 * Split out of `community-screen.tsx` (fix list 2.5 and 9.6, 15 Oct 2026) as a pure refactor:
 * the markup, text, class names and behaviour are unchanged. Comments moved with the code, so
 * "this file" or "this screen" in them still means the community team screen as a whole.
 */

import { useWardModalFocus } from "@/components/ward-management/ward-modal-focus";
import { useRef, useState } from "react";
import { useModalFocus } from "@/components/wf";
import type { CancelTransportReason } from "@/components/ward-management/ward-change-reasons";
import type { Instant } from "@/components/ward-management/ward-clock";
import type { WardRaise } from "@/components/ward-management/ward-flow-raise";
import { cancelTransportBlockedReason } from "@/components/ward-management/community/community-blocked-reasons";
import { cadNumberProblem } from "@/components/ward-management/ward-cad-number";
import { instantFromEstimatedTimeInputs } from "@/components/ward-management/ward-transport-checks";
import {
  BLANK_TRANSPORT_DRAFT,
  type TransportDraftState,
  type DrawerType,
  type ModalType,
} from "./community-screen-helpers";

export function useCommunityScreenOverlayFocus({
  activeDrawer,
  setActiveDrawer,
  activeModalType,
  setActiveModalType,
  activeModal,
  setActiveModal,
}: {
  activeDrawer: DrawerType;
  setActiveDrawer: (drawer: DrawerType) => void;
  activeModalType: ModalType;
  setActiveModalType: (modal: ModalType) => void;
  activeModal: unknown;
  setActiveModal: (modal: null) => void;
}) {
  // Every overlay here follows the shared modal contract (`useModalFocus`): the page behind is inert
  // and held still, focus moves inside, Tab wraps, Escape closes only the top layer (handled first,
  // before this screen's own Escape, which would otherwise clear every overlay at once), and focus
  // returns to the opener. Hook order is stacking order when two open together: drawer, then dialogs.
  const drawerPanelRef = useRef<HTMLDivElement | null>(null);
  const { rootRef: drawerScrimRef } = useModalFocus({
    open: activeDrawer !== null,
    onClose: () => setActiveDrawer(null),
    panelRef: drawerPanelRef,
    focusOnOpen: "immediate",
    keyPhase: "capture",
  });
  const noteModalRef = useRef<HTMLDivElement | null>(null);
  const { rootRef: noteModalOverlayRef } = useModalFocus({
    open: activeModalType !== null,
    onClose: () => setActiveModalType(null),
    panelRef: noteModalRef,
    focusOnOpen: "immediate",
    keyPhase: "capture",
  });
  const referralModalRef = useRef<HTMLDivElement | null>(null);
  const { rootRef: referralModalBackdropRef } = useModalFocus({
    open: activeModal !== null,
    onClose: () => setActiveModal(null),
    panelRef: referralModalRef,
    focusOnOpen: "immediate",
    keyPhase: "capture",
  });

  return {
    drawerPanelRef,
    drawerScrimRef,
    noteModalRef,
    noteModalOverlayRef,
    referralModalRef,
    referralModalBackdropRef,
  };
}

/** Transport booking and cancelling, for a bed this team's person holds. Called straight after the
 *  overlay focus hook above, so the two transport dialogs stack above the drawer and dialogs. */
export function useCommunityScreenTransport({
  raise,
  now,
  teamId,
}: {
  raise: WardRaise;
  now: Instant;
  teamId: string;
}) {
  const [transportBookFor, setTransportBookFor] = useState<string | undefined>(undefined);
  const [transportDraft, setTransportDraft] = useState<TransportDraftState>(BLANK_TRANSPORT_DRAFT);
  const [transportCancelFor, setTransportCancelFor] = useState<string | undefined>(undefined);
  const [cancelTransportReason, setCancelTransportReason] = useState<CancelTransportReason | undefined>(undefined);
  const cancelTransportBlocked = cancelTransportBlockedReason(cancelTransportReason);

  function openTransportBook(movementId: string) {
    setTransportCancelFor(undefined);
    setCancelTransportReason(undefined);
    setTransportDraft(BLANK_TRANSPORT_DRAFT);
    setTransportBookFor(movementId);
  }

  function closeTransportBook() {
    setTransportBookFor(undefined);
    setTransportDraft(BLANK_TRANSPORT_DRAFT);
  }

  function openTransportCancel(movementId: string) {
    setTransportBookFor(undefined);
    setTransportDraft(BLANK_TRANSPORT_DRAFT);
    setCancelTransportReason(undefined);
    setTransportCancelFor(movementId);
  }

  function closeTransportCancel() {
    setTransportCancelFor(undefined);
    setCancelTransportReason(undefined);
  }

  const transportBookDialogRef = useRef<HTMLDivElement | null>(null);
  const transportCancelDialogRef = useRef<HTMLDivElement | null>(null);
  useWardModalFocus(transportBookFor !== undefined, transportBookDialogRef, closeTransportBook);
  useWardModalFocus(transportCancelFor !== undefined, transportCancelDialogRef, closeTransportCancel);

  function submitBookTransport(movementId: string) {
    const { provider, escortRequired, cadNumber, transportLegalStatus, estimatedTime, estimatedDay } = transportDraft;
    const estimatedAt = instantFromEstimatedTimeInputs(estimatedTime, estimatedDay, now);
    if (
      provider === undefined ||
      escortRequired === undefined ||
      cadNumberProblem(cadNumber) !== undefined ||
      transportLegalStatus === undefined ||
      estimatedAt === undefined
    ) {
      return;
    }
    raise("BOOK_TRANSPORT", {
      movementId,
      actingPlaceId: teamId,
      provider,
      escortRequired,
      cadNumber: cadNumber.trim(),
      transportLegalStatus,
      estimatedAt,
    });
    closeTransportBook();
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        document.querySelector<HTMLElement>(`[data-testid="ward-community-cancel-transport-${movementId}"]`)?.focus();
      });
    }
  }

  function submitCancelTransport(movementId: string) {
    if (cancelTransportReason === undefined) return;
    raise("CANCEL_TRANSPORT", {
      movementId,
      actingPlaceId: teamId,
      reason: cancelTransportReason,
    });
    closeTransportCancel();
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        document.querySelector<HTMLElement>(`[data-testid="ward-community-book-transport-${movementId}"]`)?.focus();
      });
    }
  }

  return {
    transportBookFor,
    setTransportBookFor,
    transportDraft,
    setTransportDraft,
    transportCancelFor,
    setTransportCancelFor,
    cancelTransportReason,
    setCancelTransportReason,
    cancelTransportBlocked,
    openTransportBook,
    closeTransportBook,
    openTransportCancel,
    closeTransportCancel,
    transportBookDialogRef,
    transportCancelDialogRef,
    submitBookTransport,
    submitCancelTransport,
  };
}
