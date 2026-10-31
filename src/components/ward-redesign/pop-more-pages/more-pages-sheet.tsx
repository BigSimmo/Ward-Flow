"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { ArrowLeftRight, ChevronRight, LayoutGrid, Settings } from "lucide-react";

import { Dot } from "@/components/wf";
import { Sheet } from "@/components/wf/sheet";
import { OperatorSwitcherModal } from "@/components/ward-management/settings/operator-switcher-modal-lazy";
import { useShellPersonaRole } from "@/components/ward-management/settings/persona-sync";
import { useWardNavCounts } from "@/components/ward-management/use-ward-nav-counts";
import { minuteOfDay } from "@/components/ward-management/ward-clock";
import { useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { wardNavCountLabel } from "@/components/ward-management/ward-nav-counts";
import { requestToolsTool } from "@/components/ward-management/tools/ward-tools-open";
import { durMinutes } from "@/components/wf";
import { ACCESS_ADMIN_PERSONA, DESK_PERSONAS } from "@/components/ward-management/shell/ward-desk-personas";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { useAccessNavFilter, useCanOpenHref } from "@/components/ward-management/shell/ward-access";
import { useWardFeatureFlagCheck } from "@/components/ward-management/shell/ward-feature-flag-store";
import { handoverHref, settingsHref } from "@/components/ward-management/shell/ward-facade";
import { announceToWardShell } from "@/components/ward-management/shell/ward-live-region";
import { shiftAtMinute } from "@/components/ward-management/ward-board-time-features";
import {
  isActiveRailEntry,
  isRoleMenuAction,
  railEntries,
  roleMenu,
  type RailEntry,
  type RoleMenuAction,
} from "@/components/ward-management/shell/ward-rail-entries";

import styles from "./pop-more-pages.module.css";

/** Minutes from one minute of the day to another, wrapping midnight (as `ward-rail.tsx`). */
function minutesFrom(from: number, to: number): number {
  return (((to - from) % 1440) + 1440) % 1440;
}

/** Minutes left in the shift, worked out as the rail's `computeShiftProgress` does. */
function shiftMinutesLeft(minute: number): number {
  const shift = shiftAtMinute(minute);
  return minutesFrom(shift.startMinute, shift.endMinute) - minutesFrom(shift.startMinute, minute);
}

/** Handover's menu id, as `ward-rail.tsx` names it. */
const HANDOVER_MENU_ID = "handover";
/** New referral's menu id (`ward-rail-entries.ts`). */
const NEW_REFERRAL_ID = "referral-intake";

/**
 * Mock-up of the rail's "More pages" sheet (the `Sheet` at the foot of `shell/ward-rail.tsx`). Same
 * pages, groups, counts and links, worked out the same way (`roleMenu(...).more`, the role access
 * filter, `useWardNavCounts`). Design changes: a wider sheet with the groups side by side so every
 * page shows without scrolling, each page's count and what it counts on one row, the handover
 * countdown as one line under the title, and a single-row foot.
 */
export function MorePagesSheetMock({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname() ?? "";
  const now = useWardFlowClock();
  const { counts, shellRole: role } = useWardNavCounts();
  const flagOn = useWardFeatureFlagCheck();
  const accessNav = useAccessNavFilter();
  const canOpen = useCanOpenHref();
  const personaRole = useShellPersonaRole();
  const persona = useEffectiveWardAccess().role === "admin" ? ACCESS_ADMIN_PERSONA : DESK_PERSONAS[personaRole];
  const firstLinkRef = useRef<HTMLAnchorElement & HTMLButtonElement>(null);
  const [deskOpen, setDeskOpen] = useState(false);

  const entries = accessNav(railEntries(flagOn));
  const menu = roleMenu(entries, role);
  const handoverLinks = canOpen(handoverHref());
  const groups = menu.more
    .map((group) => ({
      label: group.label,
      // Mock-up: New referral is an action (the header, Create and Tools start it), not a page to list.
      entries: group.entries.filter(
        (item) => item.id !== NEW_REFERRAL_ID && (!handoverLinks || item.id !== HANDOVER_MENU_ID),
      ),
    }))
    .filter((group) => group.entries.length > 0);
  const firstId = groups[0]?.entries[0]?.id;
  const left = shiftMinutesLeft(minuteOfDay(now));
  // The rail calls handover due inside the last 15 minutes of the shift.
  const handoverText = left <= 15 ? null : durMinutes(left);

  function pageRow(entry: RailEntry) {
    const Icon = entry.icon;
    const active = isActiveRailEntry(pathname, entry);
    const count = counts[entry.id as keyof typeof counts];
    return (
      <li key={entry.id}>
        <Link
          ref={entry.id === firstId ? firstLinkRef : undefined}
          href={entry.href}
          className={styles.row}
          aria-current={active ? "page" : undefined}
          aria-label={wardNavCountLabel(entry.label, count)}
          data-testid="ward-rail-link"
          onClick={() => {
            announceToWardShell(active ? `${entry.label}. This is the screen you are on.` : `${entry.label}.`);
            onClose();
          }}
        >
          <Icon aria-hidden="true" className={styles.icon} strokeWidth={1.75} />
          <span className={styles.text}>
            <span className={styles.label}>{entry.label}</span>
            {/* Mock-up: the noun's first clause keeps every row to two lines ("releases held up");
                the whole noun stays in the row's spoken label and its tooltip. */}
            {count ? (
              <span className={styles.noun} title={count.noun}>
                {count.noun.split(",")[0]}
              </span>
            ) : null}
          </span>
          {count ? (
            <span className={styles.count} data-tone={count.urgent ? "warning" : undefined}>
              {count.urgent ? <Dot tone="warning" /> : null}
              {count.value}
            </span>
          ) : null}
          <ChevronRight aria-hidden="true" className={styles.chevron} />
        </Link>
      </li>
    );
  }

  function actionRow(action: RoleMenuAction) {
    const Icon = action.icon;
    return (
      <li key={action.id}>
        <button
          ref={action.id === firstId ? firstLinkRef : undefined}
          type="button"
          className={styles.row}
          aria-haspopup="dialog"
          data-testid="ward-rail-bed-finder"
          onClick={(event) => {
            onClose();
            requestToolsTool("bed-finder", event.currentTarget);
            announceToWardShell(`${action.label}.`);
          }}
        >
          <Icon aria-hidden="true" className={styles.icon} strokeWidth={1.75} />
          <span className={styles.text}>
            <span className={styles.label}>{action.label}</span>
          </span>
          <ChevronRight aria-hidden="true" className={styles.chevron} />
        </button>
      </li>
    );
  }

  return (
    <>
      <Sheet
        id="ward-rail-more-pages-mock"
        testId="ward-rail-more-pages"
        open={open}
        onClose={onClose}
        title="More pages"
        placement="left"
        contentStyle={{ maxWidth: "min(38rem, calc(100vw - 1rem))" }}
        initialFocusRef={firstLinkRef}
        headerLeading={
          <span className={styles.mark} aria-hidden="true">
            <LayoutGrid strokeWidth={1.75} aria-hidden="true" />
          </span>
        }
        headerBottom={
          // Mock-up: the top bar's clock stays in view beside the sheet, so only the handover countdown is here.
          <p className={styles.context}>
            {handoverLinks ? (
              <Link href={handoverHref()} onClick={onClose}>
                Handover {handoverText === null ? "due now" : `in ${handoverText}`}
              </Link>
            ) : (
              <>Handover {handoverText === null ? "due now" : `in ${handoverText}`}</>
            )}
          </p>
        }
        contentClassName={styles.sheet}
        bodyClassName={styles.body}
        footerClassName={styles.foot}
        footer={
          <>
            <button
              type="button"
              className={styles.person}
              data-testid="ward-rail-sheet-persona-trigger"
              aria-haspopup="dialog"
              aria-label={`${persona.name}, ${persona.role}. Go to a desk.`}
              onClick={() => {
                onClose();
                setDeskOpen(true);
              }}
            >
              <span className={styles.avatar} aria-hidden="true">
                {persona.initials}
              </span>
              <span className={styles.personText}>
                <strong>{persona.name}</strong>
                <span>{persona.role}</span>
              </span>
              <ArrowLeftRight aria-hidden="true" className={styles.chevron} strokeWidth={1.75} />
            </button>
            <Link
              href={settingsHref()}
              className={styles.footLink}
              data-testid="ward-rail-sheet-settings-link"
              onClick={onClose}
            >
              <Settings aria-hidden="true" strokeWidth={1.75} />
              Settings
            </Link>
            <span className={styles.footNote}>Synthetic prototype</span>
          </>
        }
      >
        <div className={styles.groups}>
          {groups.map((group) => (
            <section key={group.label} aria-label={group.label} className={styles.group}>
              <p className={styles.eyebrow}>{group.label}</p>
              <ul className={styles.list}>
                {group.entries.map((item) => (isRoleMenuAction(item) ? actionRow(item) : pageRow(item)))}
              </ul>
            </section>
          ))}
        </div>
      </Sheet>
      {deskOpen ? <OperatorSwitcherModal isOpen onClose={() => setDeskOpen(false)} /> : null}
    </>
  );
}
