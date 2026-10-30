"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import { Sheet, buttonClass, cx, useIsPhone } from "@/components/wf";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import type { Movement } from "@/components/ward-management/ward-model";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { edById } from "@/components/ward-management/ward-sites";

import { ED_ACTION_GROUPS, edActionItems, type EdActionItem } from "./ed-actions-items";
import styles from "./pop-ed-actions.module.css";

/** The department the ED board mock-up draws (`ed-board-page.tsx`). */
const ED_ID = "peel-ed";

const ROW_PREFIX = "ward-ed-patient-";

/** The three record items at the top of today's menu; each opens the person's sheet. */
const RECORD_ITEMS = ["View patient record", "Edit presentation", "Edit plan"] as const;

/**
 * Press the board's own control for a step, so the step runs exactly as it does today. On wider
 * screens the row menu's controls are always on the page (hidden while the menu is shut). On a
 * phone they live in the person's sheet, so the row is opened first.
 */
function pressReal(movementId: string, find: () => HTMLElement | null) {
  const now = find();
  if (now) {
    now.click();
    return;
  }
  const row = document.querySelector(`[data-testid="${ROW_PREFIX}${movementId}"]`);
  row?.querySelector<HTMLElement>("button, a, [role='button']")?.click();
  let tries = 0;
  const timer = window.setInterval(() => {
    tries += 1;
    const found = find();
    if (found || tries > 20) window.clearInterval(timer);
    found?.click();
  }, 100);
}

const byTestId = (testId: string) => () => document.querySelector<HTMLElement>(`[data-testid="${testId}"]`);

function byText(movementId: string, text: string) {
  return () =>
    [
      ...document.querySelectorAll<HTMLButtonElement>(
        `[data-testid="ward-ed-actions-menu-${movementId}"] button, [data-testid="ward-ed-phone-actions-${movementId}"] button`,
      ),
    ].find((button) => button.textContent?.trim() === text) ?? null;
}

/**
 * The actions menu on an ED board row, redesigned (review note, pop-ed-actions): only the actions
 * that can be taken now, in the menu's three groups, with the row's next step as the one filled
 * button. Greyed actions fold into "Not available yet (n)", each with its reason and its one fix.
 * Opened on a person on this board who has some of each. Every item presses the board's own control.
 */
export function PopEdActions({ page }: { page: ReactNode }) {
  const { movements, patients, referrals } = useWardFlowSelect("movements", "patients", "referrals");
  const isPhone = useIsPhone();
  const [boardIds, setBoardIds] = useState<string[]>();
  const [open, setOpen] = useState(true);

  // Read who is on the board once it has drawn, so the menu opens on a row the page shows.
  useEffect(() => {
    let tries = 0;
    const timer = window.setInterval(() => {
      tries += 1;
      const ids = [...document.querySelectorAll<HTMLElement>(`[data-testid^="${ROW_PREFIX}"]`)].map((row) =>
        (row.dataset.testid ?? "").slice(ROW_PREFIX.length),
      );
      if (ids.length > 0 || tries > 60) {
        window.clearInterval(timer);
        setBoardIds(ids);
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, []);

  const department = edById(ED_ID);
  const itemsFor = (movement: Movement) => {
    const patient = resolveSubjectPatient(movement, { patients, referrals, movements });
    return {
      patient,
      items: edActionItems({
        movement,
        who: patient.formalName,
        patientId: patient.patient?.id,
        referrals,
        department,
      }),
    };
  };
  // The person with the most to show: some actions open and some greyed, near the top of the board.
  // Picked from who the board draws; once the menu closes it no longer matters.
  const targetId = useMemo(() => {
    if (!boardIds) return undefined;
    const blockedCount = (movement: Movement) =>
      edActionItems({
        movement,
        who: "",
        patientId: resolveSubjectPatient(movement, { patients, referrals, movements }).patient?.id,
        referrals,
        department: edById(ED_ID),
      }).filter((item) => item.blocked).length;
    const scored = boardIds
      .map((id) => movements.find((movement) => movement.id === id))
      .filter((movement): movement is Movement => movement !== undefined && !movement.closure)
      .map((movement, index) => {
        // Near the top of the board, so the menu opens beside its own row on a laptop screen.
        const blocked = blockedCount(movement);
        return { id: movement.id, score: (blocked >= 1 && blocked <= 4 ? 0 : 20) + (index < 3 ? 0 : 10) + blocked };
      })
      .sort((a, b) => a.score - b.score);
    return scored[0]?.id;
  }, [boardIds, movements, patients, referrals]);

  const target = targetId ? movements.find((movement) => movement.id === targetId) : undefined;
  if (!target || !open) return <>{page}</>;
  const { patient, items } = itemsFor(target);
  const close = () => setOpen(false);
  const run = (find: () => HTMLElement | null) => {
    close();
    pressReal(target.id, find);
  };

  return (
    <>
      {page}
      {isPhone ? (
        <Sheet
          open
          onClose={close}
          // Surname first (D-83).
          title="Patient actions"
          description={`${patient.formalName} · ${patient.umrn}`}
          testId={`ward-ed-actions-menu-redesign-${target.id}`}
        >
          <div className={styles.sheetBody}>
            <ActionList movementId={target.id} items={items} run={run} menu={false} />
          </div>
        </Sheet>
      ) : (
        <AnchoredMenu movementId={target.id} label={`Actions for ${patient.formalName}`} onClose={close}>
          <header className={styles.head}>
            <b>Patient actions</b>
            <span>
              {patient.formalName} · <span className={styles.mono}>{patient.umrn}</span>
            </span>
          </header>
          <ActionList movementId={target.id} items={items} run={run} menu />
        </AnchoredMenu>
      )}
    </>
  );
}

function ActionList({
  movementId,
  items,
  run,
  menu,
}: {
  movementId: string;
  /** Inside the desktop menu each control is a menu item; in the phone sheet they are plain buttons. */
  menu: boolean;
  items: EdActionItem[];
  run: (find: () => HTMLElement | null) => void;
}) {
  const available = items.filter((item) => !item.blocked);
  const blocked = items.filter((item) => item.blocked);
  return (
    <>
      {/* Redesign: the record items take a heading like every other group. */}
      <div role="group" aria-label="Patient record" className={cx(styles.group, styles.firstGroup)}>
        <span aria-hidden="true" className={styles.groupLabel}>
          Patient record
        </span>
        {RECORD_ITEMS.map((label) => (
          <button
            key={label}
            type="button"
            role={menu ? "menuitem" : undefined}
            className={styles.item}
            onClick={() => run(byText(movementId, label))}
          >
            {label}
          </button>
        ))}
      </div>
      {ED_ACTION_GROUPS.map((name, index) => {
        const inGroup = available.filter((item) => item.group === index);
        if (inGroup.length === 0) return null;
        return (
          <div key={name} role="group" aria-label={name} className={styles.group}>
            <span aria-hidden="true" className={styles.groupLabel}>
              {name}
            </span>
            {inGroup.map((item) => (
              <button
                key={item.key}
                type="button"
                role={menu ? "menuitem" : undefined}
                data-real-testid={item.testId}
                className={item.primary ? cx(buttonClass({ variant: "pri", size: "md" }), styles.primary) : styles.item}
                onClick={() => run(byTestId(item.testId))}
              >
                {item.label}
              </button>
            ))}
          </div>
        );
      })}
      {blocked.length > 0 ? (
        <details className={styles.fold}>
          <summary className={styles.foldSummary}>
            Not available yet ({blocked.length})
            <ChevronDown size={16} aria-hidden="true" className={styles.chevron} />
          </summary>
          <ul className={styles.blockedList}>
            {blocked.map((item) => (
              <li key={item.key} className={styles.blocked} title={item.blocked}>
                <span className={styles.blockedName}>{item.label}</span>
                <span className={styles.because}>{item.because}</span>
                {item.why ? (
                  <span className={styles.why}>
                    {item.why}
                    {item.next ? (
                      <>
                        {" "}
                        Next: <b>{item.next}</b>
                      </>
                    ) : null}
                  </span>
                ) : null}
                <span className="sr-only">{item.blocked}</span>
                {item.fix ? (
                  <button
                    type="button"
                    role={menu ? "menuitem" : undefined}
                    className={styles.fix}
                    onClick={() => run(byTestId(item.fix!.testId))}
                  >
                    {item.fix.label}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </>
  );
}

/** A menu panel beside the row's own Actions button, as today's menu opens. */
function AnchoredMenu({
  movementId,
  label,
  onClose,
  children,
}: {
  movementId: string;
  label: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);
  useLayoutEffect(() => {
    const element = panel.current;
    const trigger = document.querySelector<HTMLElement>(`[data-testid="ward-ed-unfold-${movementId}"]`);
    if (!element) return;
    trigger?.scrollIntoView({ block: "center" });
    const position = () => {
      const rect = trigger?.getBoundingClientRect();
      const header = document.querySelector('[data-testid="ward-bar"]')?.getBoundingClientRect().bottom ?? 0;
      const floor = Math.max(12, header + 8);
      const available = Math.max(window.innerHeight - floor - 12, 160);
      element.style.maxHeight = `${available}px`;
      const height = Math.min(element.scrollHeight, available);
      const below = rect ? rect.bottom + 6 : floor;
      const top =
        below + height <= window.innerHeight - 12
          ? below
          : rect && rect.top - 6 - height >= floor
            ? rect.top - height - 6
            : window.innerHeight - height - 12;
      element.style.top = `${Math.max(floor, top)}px`;
      const right = rect ? rect.right : window.innerWidth - 24;
      element.style.left = `${Math.max(12, Math.min(right - element.offsetWidth, window.innerWidth - element.offsetWidth - 12))}px`;
    };
    position();
    element.querySelector<HTMLElement>("button")?.focus({ preventScroll: true });
    const observer = new ResizeObserver(position);
    observer.observe(element);
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, { passive: true, capture: true });
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !element.contains(event.target)) closeRef.current();
    };
    document.addEventListener("pointerdown", outside);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
      document.removeEventListener("pointerdown", outside);
    };
  }, [movementId]);
  return (
    <div
      ref={panel}
      role="menu"
      tabIndex={-1}
      aria-label={label}
      className={styles.panel}
      data-testid={`ward-ed-actions-menu-redesign-${movementId}`}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onClose();
        }
        if (["ArrowDown", "ArrowUp"].includes(event.key)) {
          event.preventDefault();
          const options = [...event.currentTarget.querySelectorAll<HTMLElement>("button, summary")];
          const current = options.indexOf(document.activeElement as HTMLElement);
          const next = (current + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length;
          options[next]?.focus();
        }
      }}
    >
      {children}
    </div>
  );
}
