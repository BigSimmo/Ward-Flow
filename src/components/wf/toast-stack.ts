/**
 * Toast stacking. With three or more notices that close themselves, the older ones fold behind
 * the newest and a "+N more" control opens them out. A warning or danger notice never folds: it
 * keeps its own row so a refusal is always in view. Nothing here hides a card from assistive
 * technology; a folded card is only drawn behind the newest.
 */

/** How many self-closing notices it takes before the older ones fold behind the newest. */
export const TOAST_STACK_FROM = 3;

/** Cards this far behind the newest are drawn fully transparent. */
const TOAST_STACK_VISIBLE_DEPTH = 3;

type StackableToast = { id: string; tone: string; leaving?: boolean };

export type ToastStackSlot = {
  /** Grid row, from 1. Folded cards share the newest folded card's row. */
  row: number;
  /** 0 for a card in full view; 1, 2… for cards folded behind the newest. */
  depth: number;
  /** Folded far enough back that it is drawn fully transparent. */
  faded: boolean;
};

export type ToastStackLayout = {
  /** Whether the stack is folded at all. */
  folded: boolean;
  /** How many cards sit behind the newest folded one, for the "+N more" control. */
  hiddenCount: number;
  /** One slot per toast, keyed by id. Empty when not folded. */
  slots: Map<string, ToastStackSlot>;
};

/** A warning or danger notice stays in full view. */
export function toastStaysInView(toast: { tone: string }) {
  return toast.tone === "warning" || toast.tone === "danger";
}

/**
 * Lays the visible toasts (oldest first, as rendered) into grid rows. A card on its way out keeps
 * its place but does not count toward folding.
 */
export function toastStackLayout(toasts: readonly StackableToast[], expanded: boolean): ToastStackLayout {
  const foldable = toasts.filter((toast) => !toast.leaving && !toastStaysInView(toast));
  if (expanded || foldable.length < TOAST_STACK_FROM) return { folded: false, hiddenCount: 0, slots: new Map() };

  const newestIndex = toasts.indexOf(foldable.at(-1)!);
  const slots = new Map<string, ToastStackSlot>();
  let row = 0;
  const place = (toast: StackableToast) => slots.set(toast.id, { row: ++row, depth: 0, faded: false });
  // In-view cards older than the newest folded one, then the stack, then newer in-view cards.
  toasts.forEach((toast, index) => {
    if (toastStaysInView(toast) && index < newestIndex) place(toast);
  });
  const stack = ++row;
  toasts.forEach((toast, index) => {
    if (toastStaysInView(toast) && index > newestIndex) place(toast);
  });
  const behind = foldable.slice().reverse();
  for (const toast of toasts) {
    if (toastStaysInView(toast)) continue;
    // A leaving copy sits just behind the newest while it plays out.
    const depth = toast.leaving ? 1 : behind.indexOf(toast);
    slots.set(toast.id, { row: stack, depth, faded: depth >= TOAST_STACK_VISIBLE_DEPTH });
  }
  return { folded: true, hiddenCount: foldable.length - 1, slots };
}
