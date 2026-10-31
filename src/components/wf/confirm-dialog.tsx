"use client";

import { useEffect, useState } from "react";

import type { Dialog } from "./dialog";

/**
 * The kit's styled confirm (#1118 handover: "Three window.confirm boxes remain ... They need a styled
 * confirm dialog"). One host is mounted with the toasts on every Ward Flow page; code outside React
 * (the unsaved-changes guard) asks through `requestConfirm`.
 *
 * - The question is the caller's words, shown word for word as the description. The title is short.
 * - Focus starts on the safe choice ("Keep editing"); Escape and a press outside keep. No close cross.
 * - Nothing is pre-selected and nothing happens until a choice is pressed.
 * - With no host mounted (a test, or a page outside the app frame) it falls back to the browser's
 *   own confirm box, so a guard never silently lets a change go.
 * - Phone size trim (31 Oct 2026): the dialog's code is fetched just after the page starts, not in
 *   the first download. If that fetch fails (offline), a question uses the browser's box instead.
 */
export type ConfirmRequest = {
  /** Short title, for example "Leave this page?". */
  title: string;
  /** The caller's question, shown word for word. */
  message: string;
  /** The choice that lets the change go, for example "Leave without saving" or "Discard". */
  confirmLabel: string;
  /** The safe choice. "Keep editing" by default. */
  cancelLabel?: string;
};

type Pending = ConfirmRequest & { resolve: (confirmed: boolean) => void };

let showRequest: ((request: Pending) => void) | null = null;
let openRequest: Pending | null = null;

/** True when a styled confirm host is mounted, so a caller may ask without blocking. */
export function hasConfirmHost(): boolean {
  return showRequest !== null;
}

/**
 * Asks the person. Resolves true only for the confirm choice. While one question is open, a second
 * one resolves false at once (the person is already deciding). With no host, uses the browser box.
 */
export function requestConfirm(request: ConfirmRequest): Promise<boolean> {
  if (!showRequest) {
    return Promise.resolve(typeof window !== "undefined" ? window.confirm(request.message) : false);
  }
  if (openRequest) return Promise.resolve(false);
  const show = showRequest;
  return new Promise<boolean>((resolve) => {
    const pending: Pending = { ...request, resolve };
    openRequest = pending;
    show(pending);
  });
}

/** Answers the open question. Module state is changed only here, outside the component, so the
 *  React Compiler's memoised handlers never read a stale copy of it (seen in the browser, 31 Oct). */
function settle(current: Pending | null, confirmed: boolean) {
  if (openRequest === current) openRequest = null;
  current?.resolve(confirmed);
}

/** An unmounted host cannot be answered: keep the change rather than lose it. */
function abandonOpenRequest() {
  const current = openRequest;
  openRequest = null;
  current?.resolve(false);
}

type DialogPart = typeof Dialog;

function loadDialog(): Promise<DialogPart> {
  return import("./dialog").then((module) => module.Dialog);
}

/** The dialog code could not be fetched: ask in the browser's box so the question is still answered. */
function answerInBrowserBox(current: Pending) {
  settle(current, typeof window !== "undefined" ? window.confirm(current.message) : false);
}

export function ConfirmHost() {
  const [request, setRequest] = useState<Pending | null>(null);
  const [LoadedDialog, setLoadedDialog] = useState<DialogPart | null>(null);

  useEffect(() => {
    showRequest = setRequest;
    return () => {
      if (showRequest === setRequest) showRequest = null;
      abandonOpenRequest();
    };
  }, []);

  // Fetches the dialog once the page has started. A question asked before it arrives waits for it.
  useEffect(() => {
    if (LoadedDialog) return;
    let live = true;
    loadDialog().then(
      (part) => {
        if (live) setLoadedDialog(() => part);
      },
      () => {
        if (!live || !request) return;
        setRequest(null);
        answerInBrowserBox(request);
      },
    );
    return () => {
      live = false;
    };
  }, [LoadedDialog, request]);

  // The question shown is the one answered: it comes from this host's state.
  const answer = (confirmed: boolean) => {
    setRequest(null);
    settle(request, confirmed);
  };

  if (!LoadedDialog) return null;
  return (
    <LoadedDialog
      open={request !== null}
      onClose={() => answer(false)}
      title={request?.title ?? ""}
      description={request?.message}
      size="sm"
      role="alertdialog"
      // Escape and a press outside keep the work. No close cross: it would be a second "keep" answer.
      closable={false}
      secondary={[{ label: request?.cancelLabel ?? "Keep editing", onAction: () => answer(false), autoFocus: true }]}
      primary={{ label: request?.confirmLabel ?? "", onAction: () => answer(true), tone: "danger" }}
      data-testid="wf-confirm-dialog"
    />
  );
}
