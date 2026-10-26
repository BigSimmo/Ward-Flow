"use client";

/**
 * Stacked-overlay coordination for `Sheet`: open-sheet stack, body scroll lock,
 * background inerting, and the open-focus settle controller.
 *
 * Split out of `sheet.tsx` so the focus rules can be unit-tested directly
 * instead of only through a rendered Sheet, and so the stack is unambiguously a
 * single module-level singleton shared by every Sheet instance.
 *
 * Every open Sheet registers a window keydown listener and locks body scroll.
 * Without coordination two open Sheets (e.g. an image lightbox or table dialog
 * opened over the mobile Evidence sheet) both react to a single Escape —
 * closing both — and their independent per-instance scroll-lock save/restore is
 * order-dependent (an out-of-order close unlocks the page behind a still-open
 * sheet or leaks `overflow:hidden`). The stack lets only the top-most Sheet
 * handle Escape/Tab, and its length doubles as a scroll-lock ref count so body
 * scroll stays locked until the last Sheet closes and the original overflow is
 * restored exactly once.
 */

/** Marks an element this module deactivated behind the top-most sheet. */
export const SHEET_INERT_MARKER = "data-sheet-inert";
/** Opt-in marker for a portaled surface that is logically inside a sheet. */
export const SHEET_PORTAL_ATTRIBUTE = "data-sheet-portal";
/** Opt-out marker for background elements that must stay interactive. */
export const SHEET_INERT_SKIP_ATTRIBUTE = "data-sheet-inert-skip";

/**
 * How long a newly opened sheet keeps listening for the conditions that steal
 * its initial focus: a sibling sheet finishing teardown, `focus=1` hydration
 * reclaiming the composer, or a `data-sheet-autofocus` child arriving behind a
 * slow dynamic import (the DocumentDrawer Find field). Listening is idle, so
 * the window matches the widest case rather than the common one; it ends on the
 * first user interaction, when this sheet stops being top-most, or here.
 */
export const SHEET_FOCUS_SETTLE_MS = 10_000;

/**
 * Fallback re-attempt schedule, in milliseconds after the first attempt. Covers
 * focus changes that emit neither a `focusin`, a panel mutation, nor a stack
 * change. Backoff converges in the common case (target present next frame)
 * without the fixed 50ms polling this replaced.
 */
const FALLBACK_ATTEMPT_DELAYS_MS = [16, 32, 64, 128, 256];

/**
 * Ceiling on reclaims that do not stick. A component that re-focuses itself
 * from its own focus handler would otherwise trade `focus()` calls with this
 * controller synchronously until the stack blows; giving up leaves focus where
 * that surface put it. A reclaim that holds resets the count, so defending the
 * panel repeatedly over the settle window is unaffected.
 */
const MAX_CONSECUTIVE_RECLAIMS = 12;

/**
 * Elements that must keep working behind a modal: stylesheets and scripts carry
 * no focus, live regions must keep announcing (route changes, status), and the
 * Next.js dev overlay/route announcer would otherwise be unreachable.
 */
const NEVER_INERT_TAGS = new Set(["SCRIPT", "STYLE", "LINK", "TEMPLATE", "NOSCRIPT", "NEXT-ROUTE-ANNOUNCER"]);

type SheetEntry = { id: string; root: HTMLElement | null };

const openSheets: SheetEntry[] = [];
const inertedElements = new Set<HTMLElement>();
const stackListeners = new Set<() => void>();
let bodyScrollLockPreviousOverflow = "";
// The root element is locked as well as <body>, and it is the half that
// actually does the work on phones. `globals.css` sets `html { overflow-x:
// clip }`, and a root whose overflow is not `visible` stops <body>'s overflow
// from propagating to the viewport — so `body { overflow: hidden }` alone left
// the document freely scrollable behind an open sheet. Measured on a 390x844
// phone with the safety-findings sheet open: the page behind still had 272px of
// range and one wheel/touch gesture over the sheet ran it to the bottom instead
// of scrolling the sheet. Locking `overflow-y` on the root keeps the scroll
// offset (an element made `overflow: hidden` retains its scrollTop), so nothing
// jumps when the sheet closes.
let rootScrollLockPreviousOverflowY = "";
const pageScrollLocks = new Map<HTMLElement, { overflowY: string; scrollTop: number; locked: boolean }>();
let pageScrollLockFrame = 0;

function syncPageScrollLocks() {
  for (const scroller of document.querySelectorAll<HTMLElement>("[data-wf-scroller]")) {
    if (!pageScrollLocks.has(scroller))
      pageScrollLocks.set(scroller, {
        overflowY: scroller.style.overflowY,
        scrollTop: scroller.scrollTop,
        locked: false,
      });
    const previous = pageScrollLocks.get(scroller)!;
    // Read the CSS for the current width without our lock overriding it. A phone
    // column must stay visible/clip; a desktop column must remain locked.
    scroller.style.overflowY = previous.overflowY;
    if (/^(auto|scroll)$/.test(window.getComputedStyle(scroller).overflowY)) {
      scroller.style.overflowY = "hidden";
      if (previous.locked) previous.scrollTop = scroller.scrollTop;
      else scroller.scrollTop = previous.scrollTop;
      previous.locked = true;
    } else previous.locked = false;
  }
}

function schedulePageScrollLocks() {
  if (!pageScrollLockFrame)
    pageScrollLockFrame = window.requestAnimationFrame(() => {
      pageScrollLockFrame = 0;
      syncPageScrollLocks();
    });
}

export function isTopmostSheet(id: string) {
  return openSheets[openSheets.length - 1]?.id === id;
}

export function hasOpenSheet() {
  return openSheets.length > 0;
}

/** The active overlay's root, including a late-mounted portal; subscribe with subscribeToSheetStack. */
export function topSheetRoot(): HTMLElement | null {
  return openSheets[openSheets.length - 1]?.root ?? null;
}

/**
 * The open sheets, bottom first, as handles that stay the same while each one is open, and every
 * inline form held open. The shared board notes what it held when each one opened (audit CS-19).
 */
export function openSheetHandles(): readonly object[] {
  dropDetachedForms();
  return [...openSheets, ...openForms.keys()];
}

/**
 * The handles a command asked for now is checked against: every open sheet, and each held form
 * the command may come from (audit CS3-01). A form that names its place on the page
 * (`data-held-form`, usually the patient's row) is left out only when the control just used sits
 * in marked places and none of them is this form's, so a save on another patient's row is not
 * refused for this form's sake. A control in no marked place, an unknown control or one in a popup
 * keeps every named form in: the safe side, never a form silently dropped. A page `<form>` held
 * because the person used it counts only for a control inside that form.
 */
export function commandSheetHandles(): readonly object[] {
  dropDetachedForms();
  // No held form, or no page to look at (a server or test runtime): every hold counts, as before.
  if (openForms.size === 0 || typeof document === "undefined") return [...openSheets, ...openForms.keys()];
  const origin = commandOrigin?.isConnected ? commandOrigin : null;
  const inSheet = origin !== null && openSheets.some((sheet) => sheet.root?.contains(origin));
  const places = new Set<string>();
  for (let place = origin?.closest("[data-held-form]"); place; place = place.parentElement?.closest("[data-held-form]"))
    places.add(place.getAttribute("data-held-form") ?? "");
  const forms = [...openForms].filter(([, scope]) => {
    if (scope instanceof Element) return origin !== null && scope.contains(origin);
    return scope === undefined || inSheet || places.size === 0 || places.has(scope);
  });
  return [...openSheets, ...forms.map(([handle]) => handle)];
}

/** Each held form and its place: a `data-held-form` name, a page `<form>`, or nowhere in particular. */
const openForms = new Map<object, string | Element | undefined>();
/** The page `<form>` elements held because the person used them, with their handles. */
const usedForms = new Map<Element, object>();

/**
 * Holds an inline edit form open as if it were a popup, so the shared board checks a save from it
 * against what the form opened on (Audit 4 A4-01: the Placement panel's urgency and legal status
 * forms overwrote a colleague's change unseen). `scope` names the form's place on the page: the
 * element (often the patient's row) marked `data-held-form={scope}`, see `commandSheetHandles`.
 * Returns the release, safe to call more than once.
 */
export function holdOpenForm(scope?: string): () => void {
  const handle = {};
  openForms.set(handle, scope);
  notifyStackListeners();
  return () => {
    if (openForms.delete(handle)) notifyStackListeners();
  };
}

/**
 * Audit CS3-01, the safety net under the named holds: a `<form>` on the page (outside every popup)
 * is held from the moment the person first presses or focuses something in it, so a save sent from
 * inside it is checked against the board as it was then. Sending it lets the form go, as does it
 * leaving the page, so the next use starts from the board the person is looking at.
 */
function holdUsedForm(target: EventTarget | null) {
  const form = target instanceof Element ? target.closest("form") : null;
  if (!form || usedForms.has(form) || openSheets.some((sheet) => sheet.root?.contains(form))) return;
  const handle = {};
  usedForms.set(form, handle);
  openForms.set(handle, form);
  notifyStackListeners();
}

function releaseUsedForm(form: Element) {
  const handle = usedForms.get(form);
  if (!handle) return;
  usedForms.delete(form);
  if (openForms.delete(handle)) notifyStackListeners();
}

/** Forgets forms that have left the page. Nothing to tell: a form going is never a new hold. */
function dropDetachedForms() {
  for (const [form, handle] of usedForms)
    if (!form.isConnected) {
      usedForms.delete(form);
      openForms.delete(handle);
    }
}

/**
 * Whether a closing sheet may still return focus to `target`.
 *
 * With nothing open, always. With a sheet still open, only when the target
 * lives inside it — that is a stacked sheet handing focus back down to the
 * sheet below. A target out in the (now inert) page background belongs to a
 * sheet that was replaced rather than stacked on, and restoring it would drag
 * focus out of the sheet that took over.
 */
/*
 * Safari (macOS and iPhone) does not focus a button when it is clicked or tapped, so a sheet or
 * dialog opened that way saw <body> as the focused element and returned focus to nowhere on close.
 * The last control pressed stands in for the opener in that case.
 */
const PRESSABLE = 'button, a[href], summary, [role="button"], [tabindex]:not([tabindex="-1"])';
let lastPressedControl: HTMLElement | null = null;

/*
 * Audit CS3-01: the control the person last pressed, clicked, typed in or sent a form with, which
 * is where a command asked for now comes from. Focus alone never moves it: Safari leaves focus on
 * an earlier field when a button is pressed, so the focused element can sit in another form.
 */
let commandOrigin: Element | null = null;

function noteCommandOrigin(event: Event) {
  const submitter = "submitter" in event ? (event as SubmitEvent).submitter : null;
  commandOrigin = submitter ?? (event.target instanceof Element ? event.target : null);
}

if (typeof document !== "undefined") {
  document.addEventListener(
    "pointerdown",
    (event) => {
      lastPressedControl = event.target instanceof Element ? event.target.closest<HTMLElement>(PRESSABLE) : null;
      noteCommandOrigin(event);
      holdUsedForm(event.target);
    },
    true,
  );
  // Capturing, so each is noted before the page's own handler asks for a save.
  for (const type of ["click", "keydown", "submit"]) document.addEventListener(type, noteCommandOrigin, true);
  document.addEventListener("focusin", (event) => holdUsedForm(event.target), true);
  // Bubbling, so the form's own submit handler has already asked for its save.
  document.addEventListener("submit", (event) => {
    if (event.target instanceof Element) releaseUsedForm(event.target);
  });
}

/** The element focus should go back to when an overlay opening now closes. */
export function overlayOpener(): HTMLElement | null {
  const active = document.activeElement;
  if (active instanceof HTMLElement && active !== document.body) return active;
  return lastPressedControl?.isConnected ? lastPressedControl : null;
}

export function canRestoreFocusTo(target: HTMLElement | null) {
  if (target == null) return false;
  const topRoot = openSheets[openSheets.length - 1]?.root ?? null;
  if (topRoot == null) return true;
  return topRoot.contains(target);
}

/**
 * Notifies on every push/pop so the top-most sheet can re-take focus the moment
 * a sibling sheet finishes tearing down, instead of polling for it.
 */
export function subscribeToSheetStack(listener: () => void) {
  stackListeners.add(listener);
  return () => {
    stackListeners.delete(listener);
  };
}

function notifyStackListeners() {
  for (const listener of Array.from(stackListeners)) listener();
}

let pageScrollLockCount = 0;

/**
 * Holds the page still behind an overlay: html, body and every Ward work column
 * (`[data-wf-scroller]`, which is the page's scroller on phone and desktop). Counted, so stacked
 * overlays and a modal that does not join the sheet stack can each hold it. Returns the release,
 * which is safe to call more than once. On phone this is what stops a swipe inside a popup from
 * moving the page behind it (Josh, 12 Oct 2026): iOS Safari ignores `overflow: hidden` on the
 * document for touch scrolling, but honours it on the work column, which now owns the scroll.
 */
export function lockPageScroll(): () => void {
  if (pageScrollLockCount === 0) {
    bodyScrollLockPreviousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    rootScrollLockPreviousOverflowY = document.documentElement.style.overflowY;
    document.documentElement.style.overflowY = "hidden";
    // Ward Flow scrolls inside the work column. Locking html/body alone
    // left that column movable behind a sheet. Keep its offset and exact inline style.
    syncPageScrollLocks();
    window.addEventListener("resize", schedulePageScrollLocks, { passive: true });
  }
  pageScrollLockCount += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    pageScrollLockCount = Math.max(0, pageScrollLockCount - 1);
    if (pageScrollLockCount > 0) return;
    window.removeEventListener("resize", schedulePageScrollLocks);
    if (pageScrollLockFrame) window.cancelAnimationFrame(pageScrollLockFrame);
    pageScrollLockFrame = 0;
    document.body.style.overflow = bodyScrollLockPreviousOverflow;
    document.documentElement.style.overflowY = rootScrollLockPreviousOverflowY;
    for (const [scroller, previous] of pageScrollLocks) scroller.style.overflowY = previous.overflowY;
    pageScrollLocks.clear();
  };
}

let releaseSheetPageScroll: (() => void) | null = null;

export function pushSheet(id: string, root: HTMLElement | null = null) {
  if (openSheets.length === 0 && !releaseSheetPageScroll) releaseSheetPageScroll = lockPageScroll();
  openSheets.push({ id, root });
  syncBackgroundInert();
  notifyStackListeners();
}

/** Updates a delayed portal ref after the sheet registered with a null root. */
export function updateSheetRoot(id: string, root: HTMLElement | null) {
  let entry: SheetEntry | undefined;
  for (let index = openSheets.length - 1; index >= 0; index -= 1) {
    if (openSheets[index].id === id) {
      entry = openSheets[index];
      break;
    }
  }
  if (!entry || entry.root === root) return;
  entry.root = root;
  syncBackgroundInert();
  notifyStackListeners();
}

export function popSheet(id: string) {
  for (let index = openSheets.length - 1; index >= 0; index -= 1) {
    if (openSheets[index].id === id) {
      openSheets.splice(index, 1);
      break;
    }
  }
  if (openSheets.length === 0 && releaseSheetPageScroll) {
    releaseSheetPageScroll();
    releaseSheetPageScroll = null;
  }
  syncBackgroundInert();
  notifyStackListeners();
}

function canInert(element: Element): element is HTMLElement {
  if (!(element instanceof HTMLElement)) return false;
  if (NEVER_INERT_TAGS.has(element.tagName) || element.tagName.startsWith("NEXTJS-")) return false;
  if (element.hasAttribute(SHEET_INERT_SKIP_ATTRIBUTE)) return false;
  if (element.hasAttribute("aria-live")) return false;
  // Never clobber an `inert` another owner set: on release we could not tell
  // whether removing it was ours to do.
  return !element.hasAttribute("inert") || inertedElements.has(element);
}

/**
 * Inerts a background element whole, unless it holds an opt-out somewhere inside. `inert` is
 * inherited, so an opted-out control nested in an inerted container would still be dead; such a
 * container is instead walked, and every part of it except the opt-out (and the path down to it)
 * is inerted. A sheet that deliberately sits below the phone header uses this to keep the
 * header's Menu and Search live (Josh, 13 Oct 2026).
 */
function pushBackgroundAround(element: Element, background: HTMLElement[]) {
  if (
    element instanceof HTMLElement &&
    !element.hasAttribute(SHEET_INERT_SKIP_ATTRIBUTE) &&
    (!element.hasAttribute("inert") || inertedElements.has(element)) &&
    element.querySelector(`[${SHEET_INERT_SKIP_ATTRIBUTE}]`) !== null
  ) {
    for (const child of Array.from(element.children)) pushBackgroundAround(child, background);
    return;
  }
  if (canInert(element)) background.push(element);
}

/**
 * Everything outside the sheet's own subtree: walking to `document.body` and
 * taking the siblings at each level covers both portaled sheets (a direct body
 * child) and inline sheets nested deep in the page tree.
 */
function collectBackgroundElements(root: HTMLElement) {
  const background: HTMLElement[] = [];
  let node: HTMLElement = root;
  while (node !== document.body) {
    const parent: HTMLElement | null = node.parentElement;
    if (parent == null) break;
    for (const sibling of Array.from(parent.children)) {
      if (sibling === node) continue;
      pushBackgroundAround(sibling, background);
      // OverlayPortal carries a meaningful layer/name on a display:contents
      // wrapper. Inert that logical wrapper and its direct surface so both the
      // platform containment and the Sheet's historical backdrop contract stay
      // observable for stacked modals.
      if (sibling instanceof HTMLElement && sibling.hasAttribute("data-overlay-layer")) {
        for (const surface of Array.from(sibling.children)) {
          if (canInert(surface)) background.push(surface);
        }
      }
    }
    node = parent;
  }
  return background;
}

/**
 * Containment beats reclamation: while a sheet is open the rest of the page is
 * `inert`, so the browser itself refuses to move focus there. Only elements
 * present when the sheet opened are marked — a popover portaled out of the
 * sheet after it opened stays interactive.
 */
function syncBackgroundInert() {
  if (typeof document === "undefined") return;
  const topRoot = openSheets[openSheets.length - 1]?.root ?? null;
  const next =
    topRoot?.isConnected && document.body.contains(topRoot)
      ? new Set(collectBackgroundElements(topRoot))
      : new Set<HTMLElement>();

  for (const element of Array.from(inertedElements)) {
    if (next.has(element)) continue;
    element.removeAttribute("inert");
    element.removeAttribute(SHEET_INERT_MARKER);
    inertedElements.delete(element);
  }
  for (const element of next) {
    if (inertedElements.has(element)) continue;
    element.setAttribute("inert", "");
    element.setAttribute(SHEET_INERT_MARKER, "true");
    inertedElements.add(element);
  }
}

/**
 * A sheet may only take focus back from nothing (body) or from background it
 * deactivated itself. Anything else — a control inside the panel, a popover
 * portaled out of the sheet, a surface that legitimately opened on top — keeps
 * the focus the user or the app gave it.
 */
export function shouldReclaimFocus(panel: HTMLElement | null, active: Element | null) {
  if (active == null || active === document.body) return true;
  if (panel?.contains(active)) return false;
  if (active.closest(`[${SHEET_PORTAL_ATTRIBUTE}]`)) return false;
  return active.closest(`[${SHEET_INERT_MARKER}="true"]`) != null;
}

export type SheetFocusController = { cancel: () => void };

/**
 * Drives a newly opened sheet's initial focus from events rather than a poll:
 * a panel `MutationObserver` catches a late-mounted autofocus child, `focusin`
 * catches focus landing elsewhere, and the stack subscription catches a sibling
 * sheet's teardown. A short backoff chain covers anything none of those emit.
 * The window closes on success, on the first user interaction, when this sheet
 * is no longer top-most, or at `settleMs`.
 */
export function startSheetOpenFocus({
  sheetId,
  getPanel,
  resolveTarget,
  settleMs = SHEET_FOCUS_SETTLE_MS,
}: {
  sheetId: string;
  getPanel: () => HTMLElement | null;
  resolveTarget: () => HTMLElement | null;
  settleMs?: number;
}): SheetFocusController {
  let settled = false;
  // The element this controller last focused. Focus sitting there is still the
  // sheet's own opening focus, so it may be upgraded when a better target (a
  // late-mounted autofocus child) appears — unlike focus the user moved.
  let lastAppliedTarget: HTMLElement | null = null;
  let reclaims = 0;
  const timers: number[] = [];
  const teardowns: Array<() => void> = [];

  function finish() {
    if (settled) return;
    settled = true;
    for (const timer of timers) window.clearTimeout(timer);
    timers.length = 0;
    for (const teardown of teardowns.splice(0)) teardown();
  }

  function attempt() {
    if (settled) return;
    if (!isTopmostSheet(sheetId)) {
      finish();
      return;
    }
    const target = resolveTarget();
    // No target yet: the autofocus child may still be mounting, so stay armed
    // rather than burning attempts against a node that does not exist.
    if (!target?.isConnected) return;
    const active = document.activeElement;
    if (active === target) return;
    if (active !== lastAppliedTarget && !shouldReclaimFocus(getPanel(), active)) return;
    reclaims += 1;
    if (reclaims > MAX_CONSECUTIVE_RECLAIMS) {
      finish();
      return;
    }
    target.focus({ preventScroll: true });
    if (document.activeElement === target) {
      lastAppliedTarget = target;
      // The reclaim held, so this was ordinary defence rather than a fight.
      // Only focus that is taken straight back accumulates against the budget.
      reclaims = 0;
    }
  }

  const frame = window.requestAnimationFrame(() => {
    if (settled) return;
    attempt();
    if (settled) return;
    // Stay armed after a successful first focus: the resolved target can still
    // improve (a deferred autofocus input mounting into the panel).

    const panel = getPanel();
    if (panel != null && typeof MutationObserver === "function") {
      const observer = new MutationObserver(attempt);
      observer.observe(panel, { childList: true, subtree: true });
      teardowns.push(() => observer.disconnect());
    }

    document.addEventListener("focusin", attempt);
    teardowns.push(() => document.removeEventListener("focusin", attempt));

    teardowns.push(subscribeToSheetStack(attempt));

    // A deliberate interaction outranks the sheet's opening focus.
    document.addEventListener("pointerdown", finish, true);
    document.addEventListener("keydown", finish, true);
    teardowns.push(() => {
      document.removeEventListener("pointerdown", finish, true);
      document.removeEventListener("keydown", finish, true);
    });

    for (const delay of FALLBACK_ATTEMPT_DELAYS_MS) {
      timers.push(window.setTimeout(attempt, delay));
    }
    timers.push(window.setTimeout(finish, settleMs));
  });

  teardowns.push(() => window.cancelAnimationFrame(frame));

  return {
    cancel: finish,
  };
}
