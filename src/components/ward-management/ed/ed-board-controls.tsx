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
  type ReactNode,
  type ButtonHTMLAttributes,
  type RefObject,
} from "react";
import { ChevronDown, Pencil, X } from "lucide-react";
import styles from "./ed-board-controls.module.css";

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

export function EdPopover({
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
      const available = Math.max(window.innerHeight - 24, 160);
      element.style.width = `${Math.min(width, window.innerWidth - 24)}px`;
      element.style.maxHeight = `${Math.min(520, available)}px`;
      const height = Math.min(element.scrollHeight, 520, available);
      const top = rect.bottom + height + 8 < window.innerHeight ? rect.bottom + 6 : Math.max(12, rect.top - height - 6);
      element.style.top = `${Math.min(top, Math.max(12, window.innerHeight - height - 12))}px`;
      element.style.left = `${Math.max(12, Math.min(rect.left, window.innerWidth - element.offsetWidth - 12))}px`;
    }
    if (typeof element.showPopover === "function") element.showPopover();
    else element.style.display = "block";
    position();
    element
      .querySelector<HTMLElement>(listbox ? '[aria-selected="true"], button' : menu ? "button" : "input, button")
      ?.focus({ preventScroll: true });
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(position);
    observer?.observe(element);
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
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
          const options = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
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
      <dialog
        ref={dialog}
        className={styles.dialog}
        aria-labelledby={`${id}-title`}
        onCancel={() => trigger.current?.focus()}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
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

export function EdActionsMenu({
  patientName,
  children,
  testId,
  triggerTestId,
  onViewRecord,
  onEditPresentation,
  onEditPlan,
}: {
  patientName: string;
  children: ReactNode;
  testId: string;
  triggerTestId: string;
  onViewRecord: () => void;
  onEditPresentation: () => void;
  onEditPlan: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>();
  const anchor = useRef<HTMLButtonElement>(null);
  const groups: { name: string; items: ReactNode[] }[] = [
    { name: "Review & disposition", items: [] },
    { name: "Transfer & handover", items: [] },
    { name: "Legal & referral", items: [] },
  ];
  const other: ReactNode[] = [];
  for (const child of flatten(children)) {
    if (
      isValidElement<ButtonHTMLAttributes<HTMLButtonElement> & { "data-testid"?: string }>(child) &&
      child.type === "button"
    ) {
      const key = child.props["data-testid"] ?? "";
      groups[/examine|outcome/.test(key) ? 0 : /handover|transport|arrival-plan/.test(key) ? 1 : 2].items.push(
        cloneElement(child, { role: "menuitem" }),
      );
    } else other.push(child);
  }
  function close() {
    setOpen(false);
    setReason(undefined);
  }
  return (
    <>
      <button
        ref={anchor}
        type="button"
        className={styles.actionsTrigger}
        data-testid={triggerTestId}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Actions for ${patientName}`}
        onClick={() => {
          if (open) close();
          else setOpen(true);
        }}
      >
        Actions
        <ChevronDown aria-hidden="true" />
      </button>
      <EdPopover
        open={open}
        onClose={close}
        anchor={anchor}
        label={`Actions for ${patientName}`}
        width={330}
        menu
        testId={testId}
      >
        <header className={styles.popoverHeading}>
          <b>Patient actions</b>
          <span>{patientName}</span>
        </header>
        <div
          className={styles.actionItems}
          onFocus={(event) =>
            setReason(
              event.target instanceof HTMLButtonElement && event.target.getAttribute("aria-disabled") === "true"
                ? event.target.title
                : undefined,
            )
          }
          onClick={(event) => {
            const button = event.target instanceof Element ? event.target.closest("button") : null;
            if (button && button.getAttribute("aria-disabled") !== "true") {
              close();
              anchor.current?.focus();
            }
          }}
        >
          <button type="button" role="menuitem" onClick={onViewRecord}>
            View patient record
          </button>
          <button type="button" role="menuitem" onClick={onEditPresentation}>
            Edit presentation
          </button>
          <button type="button" role="menuitem" onClick={onEditPlan}>
            Edit plan
          </button>
          {groups.map(
            (group) =>
              group.items.length > 0 && (
                <section key={group.name} className={styles.menuGroup}>
                  <h3>{group.name}</h3>
                  {group.items}
                </section>
              ),
          )}
          {other}
        </div>
        {reason && <p className={styles.reason}>{reason}</p>}
      </EdPopover>
    </>
  );
}
