import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Audit finding 11 (Josh, 31 Oct 2026): Help and the shortcuts sheet offer each login only the tasks,
 * keys and links its role can actually use, read from the same tables the app enforces
 * (`ROLE_SCREENS`, `EVENT_ROLE`). Synthetic data only.
 */

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/settings",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/components/ward-management/help/ward-tour-facts", () => ({
  useTourFacts: () => ({ facts: {}, home: "/ward-flow/settings", deskHome: "/ward-flow/settings" }),
}));

const login = vi.hoisted(() => ({ role: "coordinator" as string }));
vi.mock("@/components/ward-management/help/ward-help-store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/ward-management/help/ward-help-store")>()),
  useTourRole: () => login.role,
}));

import { deskMayAct, deskOpens, EVERY_LOGIN } from "@/components/ward-management/help/ward-help-access";
import { shortcutsForDesk } from "@/components/ward-management/help/ward-help-content";
import { howToHref } from "@/components/ward-management/help/ward-help-href";
import { searchHelp } from "@/components/ward-management/help/ward-help-search-index";
import type { WardTourRole } from "@/components/ward-management/help/ward-help-store";
import { WardHelpSheet } from "@/components/ward-management/help/ward-help-sheet";
import { tasksForDesk } from "@/components/ward-management/help/ward-help-task-list";
import { WardShortcutsSheet } from "@/components/ward-management/help/ward-shortcuts-sheet";
import { ROLE_SCREENS, screenForPath } from "@/components/ward-management/ward-role-access";

afterEach(() => {
  login.role = "coordinator";
});

const ids = (role: WardTourRole) => tasksForDesk(role).map((howTo) => howTo.id);

describe("Help offers each login only what it can use", () => {
  it("lists no task whose screen the login cannot open or whose action it may not record", () => {
    for (const role of EVERY_LOGIN) {
      for (const howTo of tasksForDesk(role)) {
        if (howTo.go) expect(howToHref(howTo.go, role, "/ward-flow"), `${role} ${howTo.id}`).toBeDefined();
        if (howTo.needs) expect(deskOpens(role, howTo.needs), `${role} ${howTo.id}`).toBe(true);
        if (howTo.acts) expect(deskMayAct(role, howTo.acts), `${role} ${howTo.id}`).toBe(true);
      }
    }
  });

  it("keeps each thin desk's list to its own jobs", () => {
    expect(ids("officer")).toContain("transport-job");
    expect(ids("officer")).not.toContain("search-patient");
    expect(ids("officer")).not.toContain("downtime");
    expect(ids("officer")).toContain("downtime-paper");
    for (const role of ["executive", "admin"] as const) {
      expect(ids(role)).not.toContain("alerts");
      expect(ids(role)).not.toContain("notifications");
      expect(ids(role)).not.toContain("rules");
    }
    expect(ids("executive")).toContain("statistics");
    expect(ids("admin")).toContain("give-access");
    // D-80: a site bed manager reads Handover but signs no sheet.
    expect(ids("bed_manager")).not.toContain("sign-off-handover");
    expect(ids("bed_manager")).toContain("print-handover");
    expect(ids("community")).not.toContain("downtime");
    expect(ids("coordinator")).toContain("rules");
  });

  it("does not show a login a Help task or link for a screen it cannot open", () => {
    for (const role of ["officer", "executive", "admin", "community", "ed"] as const) {
      login.role = role;
      const { unmount } = render(<WardHelpSheet view="tasks" showMeOn onView={vi.fn()} onClose={vi.fn()} />);
      const listed = screen
        .getAllByTestId(/^ward-help-task-answer-/)
        .map((row) => row.dataset.testid?.replace("ward-help-task-answer-", ""));
      expect(listed.toSorted(), role).toEqual(ids(role).toSorted());
      for (const anchor of screen.getByTestId("ward-help-sheet").querySelectorAll<HTMLAnchorElement>("a[href]")) {
        const target = screenForPath((anchor.getAttribute("href") ?? "").split("#")[0])?.screen;
        if (target) expect(ROLE_SCREENS[role][target], `${role} ${anchor.getAttribute("href")}`).toBeDefined();
      }
      unmount();
    }
  });

  it("names the desk with Help's labels", () => {
    login.role = "community";
    render(<WardHelpSheet view="tasks" onView={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByTestId("ward-help-context").textContent).toMatch(/^Community team/);
  });
});

describe("keys each login can use", () => {
  it("leaves out New referral for a desk that cannot refer, and Alerts and Activity where they are unavailable", () => {
    const keys = (role: WardTourRole) => shortcutsForDesk(role).map((item) => item.keys);
    expect(keys("coordinator")).toEqual(expect.arrayContaining(["Shift+R", "Shift+T", "Shift+A"]));
    expect(keys("officer")).not.toContain("Shift+R");
    expect(keys("officer")).toContain("Shift+T");
    expect(keys("bed_manager")).not.toContain("Shift+R");
    for (const role of ["executive", "admin"] as const) {
      expect(keys(role)).not.toEqual(expect.arrayContaining(["Shift+R"]));
      expect(keys(role)).not.toContain("Shift+T");
      expect(keys(role)).not.toContain("Shift+A");
      expect(keys(role)).toContain("?");
    }
  });

  it("draws only those keys in the shortcuts sheet", () => {
    login.role = "officer";
    render(<WardShortcutsSheet onClose={vi.fn()} />);
    const list = screen.getByTestId("ward-shortcuts-list");
    expect(within(list).queryByText("Shift+R")).toBeNull();
    expect(within(list).getByText("Shift+T")).toBeTruthy();
  });

  it("does not offer a key the login cannot use in Help search", () => {
    const found = (role: WardTourRole) => {
      const answer = searchHelp("Shift+R new referral shortcut", role);
      return answer.kind === "results" ? answer.results.filter((result) => result.group === "Shortcuts") : [];
    };
    expect(found("coordinator").map((result) => result.title)).toContain("Shift+R");
    expect(found("officer").map((result) => result.title)).not.toContain("Shift+R");
  });
});
