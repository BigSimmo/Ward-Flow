"use client";

/**
 * Help remembered by account (eight suggestions item 3, Josh, 4 Nov 2026, "Yes to all
 * recommendations"). A signed-in account keeps the desks whose tour is done, the page tips already
 * seen, whether tips are turned off and the What's new lines already read on the server (migration
 * 17), so a new phone, PC or browser does not show them all again. At sign-in the account's memory
 * is applied to this device. Only marks made while this account is signed in are sent back;
 * existing device marks may belong to someone else on a shared desk. The device keeps its own copy, so Help works the same when the server cannot be reached,
 * before migration 17 (`shared: false`) and on the demo site, which has no account and keeps device
 * memory only. Desk role ids, static Help topic ids and What's new entry ids only.
 */
import { useContext, useEffect } from "react";

import { HELP_HINTS_CHANGED_EVENT, HELP_HINTS_KEY, parseHelpHints } from "../help-content/ward-help-hints";
import { HELP_TIPS_CHANGED_EVENT, helpTipsChoice, setHelpTipsOff } from "../help-content/ward-help-tips-off";
import { SharedAccessContext } from "../shell/ward-shared-access-context";
import { markHelpAccountReady } from "./ward-help-account-ready";
import { markTourSeen, parseTourSeen, TOUR_SEEN_CHANGE_EVENT, TOUR_SEEN_STORAGE_KEY } from "./ward-help-store";
import { markWhatsNewSeen, WHATS_NEW_SEEN_EVENT, WHATS_NEW_STORAGE_KEY, whatsNewSeenIds } from "./ward-whats-new";

// The same key as `ward-tour-auto-start.tsx`, written out so this file does not load the tour.
const TOUR_AUTO_DONE_STORAGE_KEY = "ward_flow_choice_tour_auto_done";
/** Marks made close together go in one save. */
const SEND_AFTER_MS = 1_000;
/**
 * N36: marks made for an account that it has not confirmed yet, by account id, so a failed save is
 * retried after a reconnect or remount instead of being read as made before sign-in. No
 * `ward_flow_choice_` prefix, so sign-out clears it.
 */
const UNSENT_KEY = "ward_flow_help_unsent";

type Lists = { tours: string[]; tips: string[]; whatsNew: string[] };
export type AccountHelpMemory = Lists & { tipsOff: boolean | null };

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** This device's Help memory, as the account stores it. */
export function deviceHelpMemory(): Lists {
  return {
    tours: [...parseTourSeen(read(TOUR_SEEN_STORAGE_KEY) ?? "")],
    tips: parseHelpHints(read(HELP_HINTS_KEY) ?? ""),
    whatsNew: whatsNewSeenIds(read(WHATS_NEW_STORAGE_KEY)),
  };
}

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

const lists = (value?: Partial<Record<keyof Lists, unknown>> | null): Lists => ({
  tours: strings(value?.tours),
  tips: strings(value?.tips),
  whatsNew: strings(value?.whatsNew),
});

function readUnsent(): Record<string, Partial<Lists>> {
  try {
    const value: unknown = JSON.parse(read(UNSENT_KEY) ?? "{}");
    return typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as Record<string, Partial<Lists>>)
      : {};
  } catch {
    return {};
  }
}

/** Records what this account still lacks of the marks made for it on this device. */
function keepUnsent(actorId: string, missing: Partial<Lists> | null): void {
  const all = readUnsent();
  if (missing) all[actorId] = missing;
  else delete all[actorId];
  try {
    if (Object.keys(all).length > 0) window.localStorage.setItem(UNSENT_KEY, JSON.stringify(all));
    else window.localStorage.removeItem(UNSENT_KEY);
  } catch {
    // Without storage, unsaved marks are retried only during this account session.
  }
}

/** The account's reply, or null when Help is not remembered by account (before migration 17). */
export function accountHelpReply(value: unknown): AccountHelpMemory | null {
  if (typeof value !== "object" || value === null || (value as { shared?: unknown }).shared !== true) return null;
  const reply = value as Record<string, unknown>;
  return {
    tours: strings(reply.tours),
    tips: strings(reply.tips),
    whatsNew: strings(reply.whatsNew),
    tipsOff: typeof reply.tipsOff === "boolean" ? reply.tipsOff : null,
  };
}

/**
 * Takes the account's memory into this device's: each list gains what the account has seen, and the
 * account's tips choice, once it has one, stands. A device that had not offered the tour yet treats
 * an account with a seen tour as already offered, so the tour is offered once per account.
 */
export function applyAccountHelpMemory(account: AccountHelpMemory): void {
  for (const role of parseTourSeen(account.tours.join(","))) markTourSeen(role);
  if (account.tours.length > 0) {
    try {
      const done = parseTourSeen(read(TOUR_AUTO_DONE_STORAGE_KEY) ?? "");
      if (done.length === 0) window.localStorage.setItem(TOUR_AUTO_DONE_STORAGE_KEY, account.tours.join(","));
    } catch {
      // Unreadable storage already counts as offered.
    }
  }
  const tips = parseHelpHints([...parseHelpHints(read(HELP_HINTS_KEY) ?? ""), ...account.tips].join(","));
  try {
    window.localStorage.setItem(HELP_HINTS_KEY, tips.join(","));
  } catch {
    // Without storage the tips' own mark fails closed and shows nothing.
  }
  markWhatsNewSeen(account.whatsNew, true);
  if (account.tipsOff !== null && account.tipsOff !== helpTipsChoice()) setHelpTipsOff(account.tipsOff, true);
}

/** What the account lacks from this device, or null when it already holds everything. */
export function missingFromAccount(device: Lists, account: Lists): Partial<Lists> | null {
  const body: Partial<Lists> = {};
  for (const key of ["tours", "tips", "whatsNew"] as const) {
    const held = new Set(account[key]);
    const missing = device[key].filter((item) => !held.has(item));
    if (missing.length > 0) body[key] = missing;
  }
  return Object.keys(body).length > 0 ? body : null;
}

const fromAccount = (event: Event) => (event as CustomEvent<{ fromAccount?: boolean }>).detail?.fromAccount === true;

/**
 * Mounted by the Help host. Draws nothing. Does nothing on the demo site, where there is no account.
 */
export function WardHelpAccountMemory() {
  const shared = useContext(SharedAccessContext);
  const call = shared?.api.preferences;
  const actorId = shared?.actorId ?? null;
  useEffect(() => {
    if (!call || !actorId) return;
    let live = true;
    // Existing marks have no account provenance; never import them into a signed-in account. Marks
    // this account made here whose save has not succeeded are its own, so they stay to be sent.
    const beforeSignIn = lists(missingFromAccount(deviceHelpMemory(), lists(readUnsent()[actorId])));
    // What the account is known to hold, so a save sends only what is new to it.
    let account: AccountHelpMemory | null = null;
    let applying = false;
    let tipsChanged = false;
    let timer: number | undefined;
    // N36: stored when the mark is made, so a teardown before the debounced save cannot lose it.
    const recordUnsent = () => {
      const missing = missingFromAccount(
        lists(missingFromAccount(deviceHelpMemory(), beforeSignIn)),
        account ?? lists(),
      );
      keepUnsent(actorId, missing);
      return missing;
    };
    const send = () => {
      timer = undefined;
      if (!live) return;
      const missing = recordUnsent();
      if (!account) return;
      const body: Record<string, unknown> = { ...missing };
      if (tipsChanged) {
        const choice = helpTipsChoice();
        if (choice !== null && choice !== account.tipsOff) body.tipsOff = choice;
        tipsChanged = false;
      }
      if (Object.keys(body).length === 0) return;
      // #1426: a tips choice whose save fails goes again with the next save.
      const tipsSent = "tipsOff" in body;
      call(body).then(
        (reply) => {
          const held = accountHelpReply(reply);
          if (!held) return;
          keepUnsent(actorId, missingFromAccount(lists(readUnsent()[actorId]), held));
          if (live) account = held;
        },
        () => {
          // The device keeps its copy; another mark during this account session retries the save.
          if (tipsSent) tipsChanged = true;
        },
      );
    };
    const later = (event: Event) => {
      if (applying || fromAccount(event)) return;
      if (event.type === HELP_TIPS_CHANGED_EVENT) tipsChanged = true;
      recordUnsent();
      if (timer === undefined) timer = window.setTimeout(send, SEND_AFTER_MS);
    };
    const events = [TOUR_SEEN_CHANGE_EVENT, HELP_HINTS_CHANGED_EVENT, HELP_TIPS_CHANGED_EVENT, WHATS_NEW_SEEN_EVENT];
    for (const name of events) window.addEventListener(name, later);
    call().then(
      (reply) => {
        const held = accountHelpReply(reply);
        if (!live) return;
        if (held) {
          applying = true;
          try {
            applyAccountHelpMemory(held);
          } finally {
            applying = false;
          }
          account = held;
        }
        markHelpAccountReady(actorId);
        if (held) send();
      },
      () => {
        // Not reachable: this device's memory stands.
        if (live) markHelpAccountReady(actorId);
      },
    );
    return () => {
      live = false;
      window.clearTimeout(timer);
      for (const name of events) window.removeEventListener(name, later);
    };
  }, [call, actorId]);
  return null;
}
