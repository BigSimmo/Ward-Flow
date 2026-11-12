"use client";

/**
 * The app bar's New menu (Josh's approved mock-up, built 7 Nov 2026): the bar's primary button reads
 * "New" with a caret, because it starts more than referrals, and opens this small menu: Triage or
 * Referral. Desktop and tablet: a menu under the button, right-aligned to it, with the arrow keys,
 * Home and End, type-ahead, Enter, Escape back to the button and a press outside to close. A phone
 * gets the kit Sheet from the bottom with the same two rows. Loaded on first use, so a phone's first
 * load does not carry it (`next-bar-controls.tsx`).
 */
import { ClipboardList, Inbox, type LucideIcon } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from "react";

import { Icon, OverlayPortal, Sheet } from "@/components/wf";

import { NEW_MENU_ID } from "./next-new-menu-id";
import styles from "./next-new-menu.module.css";

export type NewMenuKind = "triage" | "referral";

const NEW_CHOICES: readonly { kind: NewMenuKind; icon: LucideIcon; title: string; line: string }[] = [
  {
    kind: "triage",
    icon: ClipboardList,
    title: "Triage",
    line: "Mental health triage and risk assessment (SMHMR900 and SMHMR905)",
  },
  { kind: "referral", icon: Inbox, title: "Referral", line: "Refer to a ward, community team or ED" },
];

type NewMenuProps = {
  /** The button that opened it: the menu sits under it, and Escape returns focus to it. */
  trigger: HTMLElement | null;
  phone: boolean;
  /** `returnFocus` is true for Escape, false for an outside press or Tab. */
  onClose: (returnFocus: boolean) => void;
  onChoose: (kind: NewMenuKind) => void;
  /** The row that takes focus on opening: the first, or the last when the arrow up opened it. */
  initial?: number;
};

/** Where the menu sits: under the trigger, its right edge on the trigger's, kept inside the window. */
function place(panel: HTMLElement, trigger: HTMLElement | null) {
  const rect = trigger && trigger.getClientRects().length > 0 ? trigger.getBoundingClientRect() : null;
  const width = panel.offsetWidth;
  const right = rect ? Math.min(rect.right, window.innerWidth - 8) : window.innerWidth - 8;
  // Named as object keys, so the stylesheet token check sees them as declared at runtime.
  const position: Record<string, string> = {
    "--choice-top": `${rect ? rect.bottom + 6 : 64}px`,
    "--choice-left": `${Math.max(8, right - width)}px`,
  };
  for (const [name, value] of Object.entries(position)) panel.style.setProperty(name, value);
  panel.dataset.placed = "";
}

function ChoiceRows({
  onChoose,
  itemRefs,
  active,
  setActive,
  asMenu,
}: {
  onChoose: (kind: NewMenuKind) => void;
  itemRefs?: RefObject<Array<HTMLButtonElement | null>>;
  active?: number;
  setActive?: (index: number) => void;
  asMenu: boolean;
}) {
  return (
    <>
      {NEW_CHOICES.map((choice, index) => (
        <button
          key={choice.kind}
          ref={(node) => {
            if (itemRefs) itemRefs.current[index] = node;
          }}
          type="button"
          role={asMenu ? "menuitem" : undefined}
          tabIndex={asMenu ? (index === active ? 0 : -1) : undefined}
          className={styles.row}
          data-testid={`ward-new-${choice.kind}`}
          onMouseEnter={setActive ? () => setActive(index) : undefined}
          onClick={() => onChoose(choice.kind)}
        >
          <span className={styles.tile} aria-hidden="true">
            <Icon icon={choice.icon} size={16} />
          </span>
          <span className={styles.text}>
            <span className={styles.title}>{choice.title}</span>
            <span className={styles.line}>{choice.line}</span>
          </span>
        </button>
      ))}
    </>
  );
}

/** Desktop: a menu with arrow keys, Home and End; Escape closes and returns focus; an outside press closes. */
function ChoiceMenu({ trigger, onClose, onChoose, initial = 0 }: Omit<NewMenuProps, "phone">) {
  const headingId = useId();
  const panel = useRef<HTMLDivElement>(null);
  // The overlay host can arrive a render after this component mounts (the first menu on a page with
  // no overlay root yet), so placing and the first focus wait for the panel itself to mount.
  const [panelNode, setPanelNode] = useState<HTMLDivElement | null>(null);
  const setPanel = useCallback((node: HTMLDivElement | null) => {
    panel.current = node;
    setPanelNode(node);
  }, []);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [active, setActive] = useState(Math.min(Math.max(initial, 0), NEW_CHOICES.length - 1));

  useLayoutEffect(() => {
    const node = panelNode;
    if (!node) return;
    const fit = () => place(node, trigger);
    fit();
    window.addEventListener("resize", fit);
    window.addEventListener("scroll", fit, true);
    return () => {
      window.removeEventListener("resize", fit);
      window.removeEventListener("scroll", fit, true);
    };
  }, [panelNode, trigger]);

  useEffect(() => {
    if (!panelNode) return;
    // The panel can still be hidden for a frame while it is placed (seen with reduced motion), and a
    // hidden row cannot take focus, so try again on the next few frames until focus lands.
    let frame = 0;
    let tries = 0;
    const focusActive = () => {
      const item = itemRefs.current[active];
      item?.focus({ preventScroll: true });
      if (item && document.activeElement !== item && tries++ < 10) frame = window.requestAnimationFrame(focusActive);
    };
    focusActive();
    return () => window.cancelAnimationFrame(frame);
  }, [active, panelNode]);

  useEffect(() => {
    const onDown = (event: PointerEvent) => {
      const target = event.target as Node;
      // A press on the trigger toggles it closed through the shell, so it is left to that.
      if (panel.current?.contains(target) || trigger?.contains(target)) return;
      onClose(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [onClose, trigger]);

  const count = NEW_CHOICES.length;
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((current) => (current + 1) % count);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((current) => (current - 1 + count) % count);
    } else if (event.key === "Home") {
      event.preventDefault();
      setActive(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActive(count - 1);
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose(true);
    } else if (event.key === "Tab") {
      // Park focus on New before the portalled menu unmounts, so the browser's Tab step carries on
      // from the trigger rather than dropping to the page (as the kit menu does).
      trigger?.focus({ preventScroll: true });
      onClose(false);
    } else if (event.key.length === 1 && /\S/.test(event.key)) {
      // Type-ahead stays in the menu so page shortcuts do not fire too.
      event.stopPropagation();
      const index = NEW_CHOICES.findIndex((choice) => choice.title.toLowerCase().startsWith(event.key.toLowerCase()));
      if (index >= 0) setActive(index);
    }
  };

  return (
    <OverlayPortal layer="popover" name="ward-bar-new">
      {/* eslint-disable-next-line jsx-a11y/interactive-supports-focus -- roving tab stop: arrow keys bubble up from the focused item */}
      <div
        ref={setPanel}
        id={NEW_MENU_ID}
        role="menu"
        aria-labelledby={headingId}
        className={styles.panel}
        // The popover layer passes presses through; the menu itself takes them.
        style={{ pointerEvents: "auto" }}
        onKeyDown={onKeyDown}
        data-testid="ward-bar-new-menu"
      >
        <div id={headingId} role="presentation" className={styles.heading}>
          New
        </div>
        <ChoiceRows onChoose={onChoose} itemRefs={itemRefs} active={active} setActive={setActive} asMenu />
      </div>
    </OverlayPortal>
  );
}

/** The menu: under the button on desktop and tablet, the kit Sheet on a phone. */
export function NewMenu({ trigger, phone, onClose, onChoose, initial }: NewMenuProps) {
  const triggerRef = useRef<HTMLElement | null>(trigger);
  useEffect(() => {
    triggerRef.current = trigger;
  }, [trigger]);
  if (!phone) return <ChoiceMenu trigger={trigger} onClose={onClose} onChoose={onChoose} initial={initial} />;
  return (
    <Sheet
      open
      onClose={() => onClose(true)}
      title="New"
      description="Start a triage or a referral"
      mobileBreakpoint="phone"
      returnFocusRef={triggerRef}
      testId="ward-new-sheet"
      bodyClassName={styles.sheetBody}
    >
      <div className={styles.sheetRows}>
        <ChoiceRows onChoose={onChoose} asMenu={false} />
      </div>
    </Sheet>
  );
}
