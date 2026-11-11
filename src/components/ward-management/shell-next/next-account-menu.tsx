"use client";

import { useContext, type RefObject } from "react";
import { ChevronsUpDown, CircleHelp, DoorOpen, LogOut, Repeat, Settings } from "lucide-react";
import { useRouter } from "next/navigation";

import { Menu, type MenuItem } from "@/components/wf";
import { useWardHelpRow } from "@/components/ward-management/help/ward-help-link";
import { leaveDemo, useCanLeaveDemo } from "@/components/ward-management/front-door/leave-demo";
import { SharedSessionContext } from "@/components/ward-management/shell/ward-shared-session-context";
import { settingsHref } from "@/components/ward-management/shell/ward-facade";
import rail from "@/components/ward-management/shell/ward-rail.module.css";
import parts from "@/components/ward-management/shell-next/next-rail.module.css";

/* ── Account menu (DK1, Josh, 3 Nov 2026) ───────────────────────────────────────────────────── */

/**
 * The rail's person (and the iPad sheet's) opens an account menu: who is signed in, Settings, Help,
 * then Switch desk for an account with more than one membership, or in the local demo "Try another
 * desk (demo)", which opens the desk drawer the person used to open. Sign out ends it, signed in only.
 * It replaced "Go to a desk" on the person, which listed every desk and no longer fits signing in.
 */
export function RailAccountMenu({
  persona,
  place,
  viewing,
  variant,
  onTryAnotherDesk,
  onLeave,
  triggerRef,
}: {
  persona: { name: string; initials: string; role: string };
  /** The desk's place ("Perth Central Desk"), when it belongs to this person. */
  place?: string | null;
  /** "Viewing … as …", when a desk page opened by its link belongs to another desk. */
  viewing?: string | null;
  /** `rail` is the rail's own card; `sheet` the iPad More pages foot. */
  variant: "rail" | "sheet";
  onTryAnotherDesk: () => void;
  /** Closes the sheet that holds the menu before an item acts. */
  onLeave?: () => void;
  triggerRef?: RefObject<HTMLButtonElement | null>;
}) {
  const session = useContext(SharedSessionContext);
  const router = useRouter();
  const help = useWardHelpRow();
  const canLeaveDemo = useCanLeaveDemo();
  const act = (run: () => void) => () => {
    onLeave?.();
    run();
  };
  const roleLine = place ? `${persona.role} · ${place}` : persona.role;
  const items: MenuItem[] = [
    {
      kind: "heading",
      id: "who",
      label: (
        <span className={parts.accountHead}>
          <span className={parts.accountName}>{persona.name}</span>
          <span className={parts.accountRole}>{roleLine}</span>
          {session?.accountEmail ? <span className={parts.accountRole}>{session.accountEmail}</span> : null}
        </span>
      ),
    },
    { id: "settings", label: "Settings", icon: Settings, onSelect: act(() => router.push(settingsHref())) },
    { id: "help", label: "Help", icon: CircleHelp, meta: help.isNew ? "New" : undefined, onSelect: act(help.open) },
  ];
  if (session?.switchRole) {
    items.push({ id: "switch-desk", label: "Switch desk", icon: Repeat, onSelect: act(session.switchRole) });
  } else if (!session) {
    items.push({ id: "try-desk", label: "Try another desk (demo)", icon: Repeat, onSelect: act(onTryAnotherDesk) });
  }
  if (session) {
    items.push(
      { kind: "separator", id: "sep" },
      { id: "sign-out", label: "Sign out", icon: LogOut, onSelect: act(() => session.signOut()) },
    );
  } else if (canLeaveDemo) {
    // Live audit item 22: the public demo's way out (`front-door/leave-demo.ts`).
    items.push(
      { kind: "separator", id: "sep" },
      { id: "leave-demo", label: "Leave the demo", icon: DoorOpen, onSelect: act(() => void leaveDemo()) },
    );
  }
  const sheet = variant === "sheet";
  return (
    <Menu
      label="Account"
      items={items}
      className={parts.accountAnchor}
      trigger={({ ref, ...props }) => (
        <button
          type="button"
          {...props}
          ref={(node) => {
            ref.current = node;
            if (triggerRef) triggerRef.current = node;
          }}
          data-testid={sheet ? "ward-rail-sheet-persona-trigger" : "ward-rail-persona-trigger"}
          className={
            sheet
              ? `${rail.moreFootPerson} ${rail.moreFootPersonBtn}`
              : `${rail.userProfileCard} ${rail.userProfileCardBtn}`
          }
          aria-label={`${persona.name}, ${persona.role}.${viewing ? ` ${viewing}.` : ""} Account menu`}
          title={`${persona.name} · ${persona.role}`}
        >
          {/* CB-3 (axe 4.14 label-content-name-mismatch): the initials are drawn from the attribute,
              so the visible words the name must contain are the name and role alone. */}
          <span className={rail.userAvatar} aria-hidden="true" data-initials={persona.initials} />
          <span className={rail.userMeta}>
            <span className={rail.userName}>{persona.name}</span> <span className={rail.userRole}>{persona.role}</span>
          </span>
          <ChevronsUpDown aria-hidden="true" className={rail.userChevron} strokeWidth={1.75} />
        </button>
      )}
    />
  );
}
