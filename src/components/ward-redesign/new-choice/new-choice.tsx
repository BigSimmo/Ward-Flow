"use client";

/**
 * Mock-up (7 Nov 2026): the app bar's New referral button starts more than referrals, so it opens a
 * small chooser first: Triage or Referral. Desktop: a menu under the button, right-aligned to it.
 * Phone: the kit Sheet from the bottom with the same two rows. Not built into the app (D-91): the
 * viewer's shell opens it in place of the referral slide-out. Proposal once built: the bar button
 * reads "New" with a caret.
 */
import { ClipboardList, Inbox, type LucideIcon } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type RefObject } from "react";

import { Icon, OverlayPortal, Sheet } from "@/components/wf";

import styles from "./new-choice.module.css";

export type NewChoiceKind = "triage" | "referral";

const NEW_CHOICES: readonly { kind: NewChoiceKind; icon: LucideIcon; title: string; line: string }[] = [
  {
    kind: "triage",
    icon: ClipboardList,
    title: "Triage",
    line: "Mental health triage and risk assessment (SMHMR900 and SMHMR905)",
  },
  { kind: "referral", icon: Inbox, title: "Referral", line: "Refer to a ward, community team or ED" },
];

type NewChoiceProps = {
  /** The button that opened it: the menu sits under it, and Escape returns focus to it. */
  trigger: HTMLElement | null;
  phone: boolean;
  /** `returnFocus` is true for Escape, false for an outside press or Tab. */
  onClose: (returnFocus: boolean) => void;
  onChoose: (kind: NewChoiceKind) => void;
};

/** Where the menu sits: under the trigger, its right edge on the trigger's, kept inside the window. */
function place(panel: HTMLElement, trigger: HTMLElement | null) {
  const rect = trigger && trigger.getClientRects().length > 0 ? trigger.getBoundingClientRect() : null;
  const width = panel.offsetWidth;
  const right = rect ? Math.min(rect.right, window.innerWidth - 8) : window.innerWidth - 8;
  panel.style.setProperty("--choice-top", `${rect ? rect.bottom + 6 : 64}px`);
  panel.style.setProperty("--choice-left", `${Math.max(8, right - width)}px`);
  panel.dataset.placed = "";
}

function ChoiceRows({
  onChoose,
  itemRefs,
  active,
  setActive,
  asMenu,
}: {
  onChoose: (kind: NewChoiceKind) => void;
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
          data-testid={`new-choice-${choice.kind}`}
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
function ChoiceMenu({ trigger, onClose, onChoose }: Omit<NewChoiceProps, "phone">) {
  const headingId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [active, setActive] = useState(0);

  useLayoutEffect(() => {
    const node = panel.current;
    if (!node) return;
    const fit = () => place(node, trigger);
    fit();
    window.addEventListener("resize", fit);
    window.addEventListener("scroll", fit, true);
    return () => {
      window.removeEventListener("resize", fit);
      window.removeEventListener("scroll", fit, true);
    };
  }, [trigger]);

  useEffect(() => {
    itemRefs.current[active]?.focus({ preventScroll: true });
  }, [active]);

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
      onClose(false);
    } else if (event.key.length === 1 && /\S/.test(event.key)) {
      // Type-ahead stays in the menu so page shortcuts do not fire too.
      event.stopPropagation();
      const index = NEW_CHOICES.findIndex((choice) => choice.title.toLowerCase().startsWith(event.key.toLowerCase()));
      if (index >= 0) setActive(index);
    }
  };

  return (
    <OverlayPortal layer="popover" name="new-choice">
      {/* eslint-disable-next-line jsx-a11y/interactive-supports-focus -- roving tab stop: arrow keys bubble up from the focused item */}
      <div
        ref={panel}
        id="new-choice-menu"
        role="menu"
        aria-labelledby={headingId}
        className={styles.panel}
        onKeyDown={onKeyDown}
        data-testid="new-choice-menu"
      >
        <div id={headingId} role="presentation" className={styles.heading}>
          New
        </div>
        <ChoiceRows onChoose={onChoose} itemRefs={itemRefs} active={active} setActive={setActive} asMenu />
      </div>
    </OverlayPortal>
  );
}

/** The chooser: a menu under the button on desktop, the kit Sheet on a phone. */
export function NewChoice({ trigger, phone, onClose, onChoose }: NewChoiceProps) {
  const triggerRef = useRef<HTMLElement | null>(trigger);
  useEffect(() => {
    triggerRef.current = trigger;
  }, [trigger]);
  if (!phone) return <ChoiceMenu trigger={trigger} onClose={onClose} onChoose={onChoose} />;
  return (
    <Sheet
      open
      onClose={() => onClose(true)}
      title="New"
      description="Start a triage or a referral"
      mobileBreakpoint="phone"
      returnFocusRef={triggerRef}
      testId="new-choice-sheet"
      bodyClassName={styles.sheetBody}
    >
      <div className={styles.sheetRows}>
        <ChoiceRows onChoose={onChoose} asMenu={false} />
      </div>
    </Sheet>
  );
}
