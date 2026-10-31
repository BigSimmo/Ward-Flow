"use client";

import {
  Children,
  cloneElement,
  Fragment,
  isValidElement,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
  type ButtonHTMLAttributes,
  type MouseEvent,
  type RefObject,
} from "react";
import { ChevronDown, Pencil, X, MoreHorizontal } from "lucide-react";
import { Sheet, useIsPhone } from "@/components/wf";
import styles from "./ed-board-controls.module.css";
import { EdConfirmedStep, EdUnavailableNote } from "./ed-screen-row-menu";

type AnchorProps = {
  open: boolean;
  onClose: () => void;
  onOutside?: () => void;
  anchor: RefObject<HTMLButtonElement | null>;
  label: string;
  children: ReactNode;
  width?: number;
  menu?: boolean;
  listbox?: boolean;
  testId?: string;
};

function EdPopover({
  open,
  onClose,
  onOutside,
  anchor,
  label,
  children,
  width = 310,
  menu = false,
  listbox = false,
  testId,
}: AnchorProps) {
  const panel = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = panel.current;
    if (!open || !element) return;
    function position() {
      if (!element || !anchor.current) return;
      const rect = anchor.current.getBoundingClientRect();
      // CRIT-03: keep below the app header and let a long menu use the whole screen, so its last
      // actions are not hidden behind a 520 px cap.
      const header = document.querySelector('[data-testid="ward-bar"]')?.getBoundingClientRect().bottom ?? 0;
      const floor = Math.max(12, header + 8);
      const available = Math.max(window.innerHeight - floor - 12, 160);
      element.style.width = `${Math.min(width, window.innerWidth - 24)}px`;
      element.style.maxHeight = `${available}px`;
      const height = Math.min(element.scrollHeight, available);
      const top =
        rect.bottom + 6 + height <= window.innerHeight - 12
          ? rect.bottom + 6
          : rect.top - 6 - height >= floor
            ? rect.top - height - 6
            : window.innerHeight - height - 12;
      element.style.top = `${Math.max(floor, Math.min(top, window.innerHeight - height - 12))}px`;
      element.style.left = `${Math.max(12, Math.min(rect.left, window.innerWidth - element.offsetWidth - 12))}px`;
    }
    if (typeof element.showPopover === "function") element.showPopover();
    else element.style.display = "block";
    position();
    // Redesign (pop-ed-actions): a menu opens on the row's next step, its one filled item.
    (
      (menu ? element.querySelector<HTMLElement>('[data-next-step]:not([aria-disabled="true"])') : null) ??
      element.querySelector<HTMLElement>(listbox ? '[aria-selected="true"], button' : menu ? "button" : "input, button")
    )?.focus({ preventScroll: true });
    let frame = 0;
    const schedule = () => {
      if (!frame) {
        frame = window.requestAnimationFrame(() => {
          frame = 0;
          position();
        });
      }
    };
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(schedule);
    observer?.observe(element);
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, { passive: true, capture: true });
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
      if (frame) window.cancelAnimationFrame(frame);
      if (typeof element.hidePopover === "function") element.hidePopover();
      else element.style.display = "none";
    };
  }, [open, anchor, width, menu, listbox]);

  useEffect(() => {
    if (!open) return;
    function outside(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !panel.current?.contains(event.target) &&
        !anchor.current?.contains(event.target)
      )
        (onOutside ?? onClose)();
    }
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open, onClose, onOutside, anchor]);

  return (
    <div
      ref={panel}
      popover="manual"
      hidden={!open}
      className={styles.popover}
      role={menu ? "menu" : listbox ? "listbox" : undefined}
      aria-label={label}
      data-testid={testId}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          onClose();
          anchor.current?.focus();
        }
        if ((menu || listbox) && ["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
          event.preventDefault();
          // A folded "Not available yet" list is skipped until it is opened.
          const options = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")].filter(
            (option) => !option.closest("[hidden]:not([popover])"),
          );
          const current = options.indexOf(document.activeElement as HTMLButtonElement);
          const index =
            event.key === "Home"
              ? 0
              : event.key === "End"
                ? options.length - 1
                : (current + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length;
          options[index]?.focus();
        }
        if (event.key === "Tab" && (menu || listbox)) {
          onClose();
          anchor.current?.focus();
        }
      }}
    >
      {children}
    </div>
  );
}

export function EdReviewStatus({
  patientName,
  value,
  options,
  className,
  tone,
  onChange,
}: {
  patientName: string;
  value: string;
  options: readonly string[];
  className: string;
  tone: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        ref={anchor}
        type="button"
        className={className}
        data-tone={tone}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Review status ${value} for ${patientName}. Change status.`}
        onClick={() => setOpen((current) => !current)}
      >
        {value}
        <ChevronDown className={styles.reviewCaret} aria-hidden="true" />
      </button>
      <EdPopover
        open={open}
        onClose={() => setOpen(false)}
        anchor={anchor}
        label={`Review potential status for ${patientName}`}
        listbox
      >
        {options.map((option) => (
          <button
            type="button"
            key={option}
            className={styles.planOption}
            role="option"
            aria-selected={option === value}
            onClick={() => {
              onChange(option);
              setOpen(false);
              anchor.current?.focus();
            }}
          >
            {option}
          </button>
        ))}
      </EdPopover>
    </>
  );
}

const PLAN_OPTIONS = [
  "Psychiatry review",
  "Social work review",
  "Contact guardian",
  "Collateral history",
  "Medication review",
  "Discharge planning",
  "Community follow-up",
];

export function EdPlanPicker({
  patientName,
  labels,
  onChange,
  triggerId,
}: {
  patientName: string;
  labels: string[];
  onChange: (labels: string[]) => void;
  triggerId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(-1);
  const anchor = useRef<HTMLButtonElement>(null);
  const id = useId();
  const trimmed = query.trim().replace(/\s+/g, " ");
  const choices = PLAN_OPTIONS.filter((option) => option.toLowerCase().includes(trimmed.toLowerCase()));
  if (trimmed && ![...PLAN_OPTIONS, ...labels].some((label) => label.toLowerCase() === trimmed.toLowerCase()))
    choices.push(trimmed);
  function close() {
    setOpen(false);
    setQuery("");
    setActive(-1);
  }
  function add(label: string) {
    if (!labels.some((existing) => existing.toLowerCase() === label.toLowerCase())) onChange([...labels, label]);
    close();
    anchor.current?.focus();
  }
  return (
    <>
      <div className={styles.labels}>
        {labels.map((label) => (
          <span className={styles.label} key={label}>
            <span>{label}</span>
            <button
              type="button"
              aria-label={`Remove ${label} from plan for ${patientName}`}
              onClick={() => onChange(labels.filter((existing) => existing !== label))}
            >
              <X aria-hidden="true" />
            </button>
          </span>
        ))}
      </div>
      <button
        ref={anchor}
        id={triggerId}
        type="button"
        className={styles.planTrigger}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`Edit plan for ${patientName}`}
        onClick={() => {
          if (open && trimmed) add(trimmed);
          else if (open) close();
          else setOpen(true);
        }}
      >
        {labels.length ? "Add a plan" : "Choose or type a plan"}
        <ChevronDown aria-hidden="true" />
      </button>
      <EdPopover
        open={open}
        onClose={close}
        onOutside={() => {
          if (trimmed) add(trimmed);
          else close();
        }}
        anchor={anchor}
        label={`Plan for ${patientName}`}
      >
        <header className={styles.popoverHeading}>
          <b>Plan</b>
          <span>{patientName}</span>
        </header>
        <input
          className={styles.planInput}
          role="combobox"
          aria-label="Choose or type a plan"
          aria-expanded="true"
          aria-controls={`${id}-options`}
          aria-autocomplete="list"
          aria-activedescendant={choices[active] ? `${id}-option-${active}` : undefined}
          maxLength={80}
          value={query}
          placeholder="Choose or type a label…"
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(-1);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              setActive((index) =>
                choices.length
                  ? index < 0
                    ? event.key === "ArrowDown"
                      ? 0
                      : choices.length - 1
                    : (index + (event.key === "ArrowDown" ? 1 : -1) + choices.length) % choices.length
                  : -1,
              );
            }
            if (event.key === "Tab" && trimmed) add(trimmed);
            if (event.key === "Enter") {
              event.preventDefault();
              if (active >= 0 && choices[active]) add(choices[active]);
              else if (trimmed)
                add(choices.find((option) => option.toLowerCase() === trimmed.toLowerCase()) ?? trimmed);
              else if (choices[0]) add(choices[0]);
            }
          }}
        />
        <div id={`${id}-options`} role="listbox" aria-label="Plan labels">
          {choices.map((option, index) => (
            <button
              type="button"
              id={`${id}-option-${index}`}
              key={option}
              className={styles.planOption}
              role="option"
              aria-selected={labels.some((label) => label.toLowerCase() === option.toLowerCase())}
              data-active={index === active ? "true" : undefined}
              onClick={() => add(option)}
            >
              {!PLAN_OPTIONS.includes(option) ? `Create “${option}”` : option}
            </button>
          ))}
        </div>
        <p className={styles.planGuidance}>Enter adds a label · Changes on this screen only</p>
      </EdPopover>
    </>
  );
}

export function EdPresentation({
  patientName,
  value,
  onChange,
  testId,
  kind,
}: {
  patientName: string;
  testId?: string;
  kind?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [draft, setDraft] = useState(value);
  const id = useId();
  function close() {
    dialog.current?.close();
    trigger.current?.focus();
  }
  return (
    <>
      <button
        ref={trigger}
        id={testId}
        type="button"
        className={styles.presentation}
        data-testid={testId}
        data-kind={kind}
        aria-haspopup="dialog"
        aria-label={`Edit presentation for ${patientName}`}
        onClick={() => {
          setDraft(value);
          dialog.current?.showModal();
          dialog.current?.querySelector("textarea")?.focus();
        }}
      >
        {value || "Add presentation…"}
        <Pencil className={styles.editIcon} aria-hidden="true" />
      </button>
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- light dismiss outside the native dialog, and Escape closes it from the keyboard */}
      <dialog
        ref={dialog}
        className={styles.dialog}
        aria-labelledby={`${id}-title`}
        onCancel={(event) => {
          // Typed text is never thrown away by Escape: only Cancel or Close discards it.
          if (draft !== value) {
            event.preventDefault();
            return;
          }
          trigger.current?.focus();
        }}
        onClick={(event) => {
          // A click outside closes only an unchanged draft, so typed text is not lost by a stray tap.
          if (event.target === event.currentTarget && draft === value) {
            const rect = event.currentTarget.getBoundingClientRect();
            if (
              event.clientX < rect.left ||
              event.clientX > rect.right ||
              event.clientY < rect.top ||
              event.clientY > rect.bottom
            )
              close();
          }
        }}
      >
        <header>
          <div>
            <h2 id={`${id}-title`}>Presentation</h2>
            <p>{patientName}</p>
          </div>
          <button type="button" aria-label="Close presentation" onClick={close}>
            <X aria-hidden="true" />
          </button>
        </header>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onChange(draft.trim());
            close();
          }}
        >
          <label htmlFor={`${id}-text`}>Brief presentation</label>
          <textarea
            id={`${id}-text`}
            maxLength={1200}
            spellCheck={false}
            data-gramm="false"
            data-gramm_editor="false"
            data-enable-grammarly="false"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <footer>
            <span>Changes on this screen only</span>
            <button type="button" onClick={close}>
              Cancel
            </button>
            <button type="submit">Apply</button>
          </footer>
        </form>
      </dialog>
    </>
  );
}

function flatten(children: ReactNode): ReactNode[] {
  return Children.toArray(children).flatMap((child) =>
    isValidElement<{ children?: ReactNode }>(child) && child.type === Fragment
      ? flatten(child.props.children)
      : [child],
  );
}

/** The menu's three groups. Redesign (Josh, 31 Oct 2026): "and" in plain words, not "&". */
export const ED_ACTION_GROUPS = ["Review and disposition", "Transfer and handover", "Legal and referral"] as const;

type ItemProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  "data-testid"?: string;
  testId?: string;
  menuItem?: boolean;
  expanded?: boolean;
};

/**
 * Sorts the row's items for the menu: the actions open now into their group, and each greyed
 * action, with the note under it, into "Not available yet" (redesign, pop-ed-actions, Josh
 * 31 Oct 2026). Anything else (a screen-reader sentence) keeps its place at the end.
 */
function sortEdMenuItems(children: ReactNode, menu: boolean) {
  const groups = ED_ACTION_GROUPS.map((name) => ({ name, items: [] as ReactNode[] }));
  const blocked: { key: string; item: ReactNode; note?: ReactNode }[] = [];
  const other: ReactNode[] = [];
  let last: { group: number } | { blocked: (typeof blocked)[number] } | undefined;
  for (const child of flatten(children)) {
    if (isValidElement<ItemProps>(child) && child.type === EdUnavailableNote) {
      // The greyed item's note: its reason, why, who acts next and its one fix, all shown at once.
      const note = cloneElement(child as ReactElement<ItemProps>, { menuItem: menu, expanded: true });
      if (last && "blocked" in last) last.blocked.note = note;
      else if (last) groups[last.group].items.push(note);
      else other.push(note);
      continue;
    }
    if (isValidElement<ItemProps>(child) && (child.type === "button" || child.type === EdConfirmedStep)) {
      // A confirmed step (Audit 1 CS-07) is a menu item too; it carries its test id as a prop.
      const key = (child.type === EdConfirmedStep ? child.props.testId : child.props["data-testid"]) ?? "";
      const item =
        child.type === EdConfirmedStep
          ? cloneElement(child as ReactElement<ItemProps>, { menuItem: menu })
          : cloneElement(child, { role: menu ? "menuitem" : undefined });
      if (child.type === "button" && child.props["aria-disabled"] === "true") {
        const entry = { key, item };
        blocked.push(entry);
        last = { blocked: entry };
        continue;
      }
      const group = /examine|outcome/.test(key) ? 0 : /handover|transport|arrival-plan/.test(key) ? 1 : 2;
      groups[group].items.push(item);
      last = { group };
    } else other.push(child);
  }
  return { groups, blocked, other };
}

/** The menu's body: the record items, the actions open now in their groups, then the greyed ones folded. */
function EdActionList({
  children,
  menu,
  testId,
  onViewRecord,
  onEditPresentation,
  onEditPlan,
}: {
  children: ReactNode;
  menu: boolean;
  testId: string;
  onViewRecord: () => void;
  onEditPresentation: () => void;
  onEditPlan: () => void;
}) {
  const [foldOpen, setFoldOpen] = useState(false);
  const foldId = useId();
  const { groups, blocked, other } = sortEdMenuItems(children, menu);
  const role = menu ? "menuitem" : undefined;
  return (
    <>
      {/* Redesign: the record items take a heading like every other group. Design audit DA-05: a
          menu may hold only menu items or groups, so each group is a labelled group. */}
      <div role="group" aria-label="Patient record" className={styles.menuGroup} data-first-group="">
        <span aria-hidden="true" className={styles.menuGroupLabel}>
          Patient record
        </span>
        <button type="button" role={role} onClick={onViewRecord}>
          View patient record
        </button>
        <button type="button" role={role} onClick={onEditPresentation}>
          Edit presentation
        </button>
        <button type="button" role={role} onClick={onEditPlan}>
          Edit plan
        </button>
      </div>
      {groups.map(
        (group) =>
          group.items.length > 0 && (
            <div key={group.name} role="group" aria-label={group.name} className={styles.menuGroup}>
              <span aria-hidden="true" className={styles.menuGroupLabel}>
                {group.name}
              </span>
              {group.items}
            </div>
          ),
      )}
      {blocked.length > 0 ? (
        // Redesign: greyed actions fold away, each with its reason, why, who acts next and its fix.
        <div className={styles.fold} data-testid={`${testId}-not-available`}>
          <button
            type="button"
            role={role}
            className={styles.foldToggle}
            aria-expanded={foldOpen}
            aria-controls={foldId}
            data-menu-keep-open=""
            onClick={() => setFoldOpen((open) => !open)}
          >
            Not available yet ({blocked.length})
            <ChevronDown aria-hidden="true" className={styles.foldChevron} />
          </button>
          <div id={foldId} role="group" aria-label="Not available yet" hidden={!foldOpen}>
            {blocked.map((entry) => (
              <div key={entry.key} className={styles.blockedItem}>
                {entry.item}
                {entry.note}
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {other}
    </>
  );
}

export function EdActionsMenu({
  patientName,
  formalName,
  umrn,
  children,
  testId,
  triggerTestId,
  onViewRecord,
  onEditPresentation,
  onEditPlan,
  compact = false,
}: {
  patientName: string;
  /** The name surname first (D-83), for the menu's header. Falls back to `patientName`. */
  formalName?: string;
  /** Shown beside the name in the menu's header. */
  umrn?: string;
  children: ReactNode;
  testId: string;
  triggerTestId: string;
  onViewRecord: () => void;
  onEditPresentation: () => void;
  onEditPlan: () => void;
  /** A small icon trigger beside a board row's one Next button. */
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>();
  const anchor = useRef<HTMLButtonElement>(null);
  const isPhone = useIsPhone();
  const who = formalName ?? patientName;
  function close() {
    setOpen(false);
    setReason(undefined);
  }
  const list = (menu: boolean) => (
    <EdActionList
      menu={menu}
      testId={testId}
      onViewRecord={onViewRecord}
      onEditPresentation={onEditPresentation}
      onEditPlan={onEditPlan}
    >
      {children}
    </EdActionList>
  );
  // Pressing an action that is open now closes the menu; a greyed item and the fold's own toggle do not.
  const closeOnAction = (event: MouseEvent<HTMLElement>) => {
    const button = event.target instanceof Element ? event.target.closest("button") : null;
    if (button && button.getAttribute("aria-disabled") !== "true" && !button.hasAttribute("data-menu-keep-open")) {
      close();
      anchor.current?.focus();
    }
  };
  return (
    <>
      <button
        ref={anchor}
        type="button"
        className={styles.actionsTrigger}
        data-testid={triggerTestId}
        aria-expanded={open}
        aria-haspopup={isPhone ? "dialog" : "menu"}
        aria-label={`Actions for ${patientName}`}
        data-compact={compact ? "true" : undefined}
        title={compact ? "More actions" : undefined}
        onClick={() => {
          if (open) close();
          else setOpen(true);
        }}
      >
        {compact ? (
          <MoreHorizontal aria-hidden="true" />
        ) : (
          <>
            Actions
            <ChevronDown aria-hidden="true" />
          </>
        )}
      </button>
      {isPhone ? (
        // Redesign: on a phone the same list is a bottom sheet, at the kit's row size.
        <Sheet
          open={open}
          onClose={close}
          title="Patient actions"
          description={umrn ? `${who} · ${umrn}` : who}
          testId={testId}
          mobileBreakpoint="phone"
          returnFocusRef={anchor}
        >
          {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- closes the sheet after an action, and the buttons take the keys */}
          <div className={styles.actionItems} data-sheet="" onClick={closeOnAction}>
            {list(false)}
          </div>
        </Sheet>
      ) : (
        <EdPopover
          open={open}
          onClose={close}
          anchor={anchor}
          label={`Actions for ${patientName}`}
          width={340}
          menu
          testId={testId}
        >
          <header className={styles.actionsHeading}>
            <b>Patient actions</b>
            <span>
              {who}
              {umrn ? (
                <>
                  {" "}
                  · <span className={styles.mono}>{umrn}</span>
                </>
              ) : null}
            </span>
          </header>
          {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- reads the focused button's disabled reason, and the buttons take the keys */}
          <div
            className={styles.actionItems}
            onFocus={(event) =>
              setReason(
                event.target instanceof HTMLButtonElement &&
                  event.target.getAttribute("aria-disabled") === "true" &&
                  // The blocker mock-up (26 Oct 2026): a note that shows its own reason needs no copy below.
                  !event.target.nextElementSibling?.hasAttribute("data-unavailable-detail")
                  ? event.target.title
                  : undefined,
              )
            }
            onClick={closeOnAction}
          >
            {list(true)}
          </div>
          {reason && <p className={styles.reason}>{reason}</p>}
        </EdPopover>
      )}
    </>
  );
}
