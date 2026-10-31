import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  SHIFT_ROSTER_OPTIONS,
  SIGN_IN_ACTIONS,
  SIGN_IN_ROLES,
} from "@/components/ward-flow-sign-in/ward-flow-sign-in-data";
import { WardFlowSignInScreen } from "@/components/ward-flow-sign-in/ward-flow-sign-in-screen";
import { SHIFT_PATTERN } from "@/components/ward-management/ward-operational-defaults";

/**
 * The catcher for the new "Sign in and role" screen
 * (`docs/ward-flow/archive/build-contracts-2026-09-12/contract-sign-in.md`).
 *
 * Two shapes of assertion, matching the contract's own §7 recommendation:
 *   1. Ordinary DOM assertions — the screen renders, every section is present BY NAME, the role
 *      picker changes what the derived lists show, and "Go in" stays inert.
 *   2. A STATIC source scan for the one thing this screen must never grow: a credential-shaped
 *      field. A DOM query for `<input>` only proves today's render tree is clean; a source scan
 *      also refuses the string from ever being typed in, matching the shape of
 *      `eslint-rules/no-hardcoded-hex.mjs` (a grep-shaped static rule), scoped to this screen's
 *      own two files.
 */

const REPO_ROOT = path.resolve(__dirname, "..");
const SCREEN_FILES = [
  "src/components/ward-flow-sign-in/ward-flow-sign-in-screen.tsx",
  "src/components/ward-flow-sign-in/ward-flow-sign-in-data.ts",
  "src/app/ward-flow-sign-in/page.tsx",
].map((relative) => path.join(REPO_ROOT, relative));

/** Strips `/* block *\/` and `// line` comments so a credential term can be discussed in prose
 *  (as this very file's own header, and the screen's own header comment, both do) without being
 *  mistaken for a live field. Simple enough not to be fooled by a string containing "//" — none
 *  of this screen's copy does. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

describe("Ward Flow sign-in screen — static credential-field guard", () => {
  it("contains no <input> element of any kind, in any of its source files", () => {
    for (const file of SCREEN_FILES) {
      const code = stripComments(readFileSync(file, "utf8"));
      expect(code, `${file} contains an <input>`).not.toMatch(/<input\b/i);
    }
  });

  // ⚠️ Deliberately narrower than the contract's own §7 suggestion ("no string matching
  // /password|passphrase|PIN\b/i outside of a comment"). This screen's own rendered copy quotes
  // the drawing's disclosure verbatim — "This screen holds no password field..." — as visible UI
  // text, not a comment, precisely BECAUSE the honesty rule requires disclosing the absence
  // rather than staying silent about it. A guard banning the bare word from non-comment code
  // would fail on that correct disclosure, so this instead guards the CODE SHAPES a credential
  // field would actually need: an attribute or prop literally naming a password/passphrase/PIN
  // field or type, never the English word appearing in prose.
  it("never wires a password/passphrase/PIN-named attribute, prop, or input type", () => {
    const credentialAttribute = /\b(type|name|id|autocomplete)\s*[:=]\s*["'{`]?\s*(password|passphrase|pin)\b/i;
    for (const file of SCREEN_FILES) {
      const code = stripComments(readFileSync(file, "utf8"));
      expect(code, `${file} wires a credential-shaped attribute`).not.toMatch(credentialAttribute);
    }
  });
});

describe("Ward Flow sign-in screen — static no-storage guard", () => {
  // Redesign (Josh, 31 Oct 2026): "Open as <role>" signs nobody in and stores nothing. A source scan
  // refuses every browser store and network call in the screen's own files, so the button cannot
  // quietly grow a role save. The appearance switch writes the app's theme through `useTheme()`,
  // which lives outside these files and is not the button.
  it("names no browser storage, cookie, session or network call in its source files", () => {
    const storeOrNetwork =
      /\b(localStorage|sessionStorage|indexedDB|document\.cookie|cookieStore|fetch\s*\(|sendBeacon)/;
    for (const file of SCREEN_FILES) {
      const code = stripComments(readFileSync(file, "utf8"));
      expect(code, `${file} names a store or network call`).not.toMatch(storeOrNetwork);
    }
  });
});

describe("Ward Flow sign-in screen renders", () => {
  it("shows every named section, the role picker, and stays inert when 'Go in' is pressed", () => {
    render(<WardFlowSignInScreen />);

    expect(screen.getByRole("heading", { level: 1, name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Who you are, and what you may do" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Your role/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^What the bed coordinator can do/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^What the bed coordinator cannot do/ })).toBeInTheDocument();
    // v6 (7 Oct 2026): the universal limits and the read-first list sit on the "Limits and safety"
    // tab; the Actions tab is shown again before the role checks. Both panels stay mounted and only
    // `hidden` changes, so each tab's aria-controls always names an element that exists (#113
    // review: the inactive tab used to point at a missing panel).
    for (const tab of screen.getAllByRole("tab")) {
      const panelId = tab.getAttribute("aria-controls");
      expect(panelId, "every tab names its panel").toBeTruthy();
      const panel = document.getElementById(String(panelId));
      expect(panel, `${String(panelId)} is mounted`).not.toBeNull();
      expect(panel?.hidden).toBe(tab.getAttribute("aria-selected") !== "true");
    }
    fireEvent.click(screen.getByRole("tab", { name: /^Limits and safety/ }));
    expect(screen.getByRole("heading", { name: "Read this before you go in" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Refused to every role/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /^Actions/ }));
    expect(screen.getByRole("heading", { name: "Go in" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Appearance" })).toBeInTheDocument();

    // The two disclosure claims the contract names as load-bearing: no real authentication is
    // implied, and the role governs nothing this build actually enforces.
    expect(
      screen.getByText(/This screen holds no password field, because a drawing of a tool must never/),
    ).toBeInTheDocument();
    expect(screen.getByText(/It does not sign anyone in or grant permissions/)).toBeInTheDocument();
    expect(screen.getByText(/The live product's permissions are set outside Ward Flow/)).toBeInTheDocument();

    // The role group carries all seven roles, each an aria-pressed toggle button.
    const roleGroup = screen.getByRole("group", { name: /^Your role/ });
    const roleButtons = within(roleGroup).getAllByRole("button");
    expect(roleButtons).toHaveLength(SIGN_IN_ROLES.length);
    expect(roleButtons[0]).toHaveAttribute("aria-pressed", "true");

    // Bed coordinator (the default) reaches 10 of 13 actions per the drawing's own data; every
    // other role is refused at least one, and the "cannot" list names who the screens index
    // gives it to. Not selected via a CSS-module class name, which is hashed under Vite/Vitest —
    // the role button's own accessible text is what a reader (and a screen reader) actually sees.
    expect(within(roleButtons[0]).getByText(`10 of ${SIGN_IN_ACTIONS.length}`)).toBeInTheDocument();

    // Choosing a different role changes both derived lists and the headings that name the role.
    fireEvent.click(screen.getByRole("button", { name: /Duty consultant/ }));
    expect(screen.getByRole("heading", { name: /^What the duty consultant can do/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^What the duty consultant cannot do/ })).toBeInTheDocument();
    expect(screen.getByText("Triage a referral")).toBeInTheDocument();

    // Reconciliation stays green: the two lists for the chosen role add to the full action count.
    const checkLine = document.querySelector("[data-ok]");
    expect(checkLine).toHaveAttribute("data-ok", "true");
    expect(checkLine?.textContent).toMatch(/access is not enforced/);

    // Redesign (Josh, 31 Oct 2026): the one control that ends the choices is the "Open as" link. The
    // old Preview button stays gone, and nothing credential-shaped is left behind.
    expect(screen.queryByRole("button", { name: /^Preview as/ })).toBeNull();
    expect(screen.getByRole("link", { name: "Open as Duty consultant" })).toHaveAttribute(
      "href",
      "/ward-flow/referrals",
    );
    expect(document.querySelectorAll("input")).toHaveLength(0);
  });

  it("keeps today's first role, catchment and shift chosen on load", () => {
    // Today's screen already opens with the bed coordinator, Statewide and the day shift chosen; the
    // redesign keeps that behaviour rather than adding or removing a pre-selection.
    render(<WardFlowSignInScreen />);
    const roles = within(screen.getByRole("group", { name: /^Your role/ })).getAllByRole("button");
    expect(roles[0]).toHaveAttribute("aria-pressed", "true");
    expect(roles.slice(1).every((button) => button.getAttribute("aria-pressed") === "false")).toBe(true);
    expect(screen.getByText("Statewide · Day shift")).toBeInTheDocument();
  });

  it("has no not-wired Preview button even in a development build, so nothing says Not wired", () => {
    // Unfinished features cleanup (23 Oct 2026): the development-only preview was removed.
    vi.stubEnv("NEXT_PUBLIC_WARD_ENVIRONMENT", "development");
    try {
      render(<WardFlowSignInScreen />);
      expect(screen.queryByRole("button", { name: /^Preview as/ })).toBeNull();
      fireEvent.keyDown(window, { key: "Enter" });
      expect(document.body).not.toHaveTextContent(/Not wired in this prototype/);
      expect(screen.getByText(/access is not enforced/)).toBeInTheDocument();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("never renders a claim that a role is enforced, only what the design system's screens index names it for", () => {
    render(<WardFlowSignInScreen />);
    // The screen must attribute reach to the screens index, not to the running application.
    expect(
      screen.getByText(/is read from the screens index of the Ward Flow design system, which is a drawing of a tool/),
    ).toBeInTheDocument();
  });
});

describe("Ward Flow sign-in screen — skip link target", () => {
  it("is the page's main landmark, which the root layout's 'Skip to main content' link points at", () => {
    const { container } = render(<WardFlowSignInScreen />);
    expect(container.querySelector("main#main-content")).not.toBeNull();
  });
});

describe("Ward Flow sign-in screen — Open as only opens a screen", () => {
  it("opens a real Ward Flow route for every role, and number keys still pick the role", () => {
    render(<WardFlowSignInScreen />);
    const roles = within(screen.getByRole("group", { name: /^Your role/ })).getAllByRole("button");
    // The boxed role numbers are gone, but the keys still work while the list has focus.
    expect(document.querySelectorAll("kbd")).toHaveLength(0);
    roles[0]!.focus();
    fireEvent.keyDown(roles[0]!, { key: "3" });
    expect(roles[2]).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("link", { name: "Open as ED liaison" })).toHaveAttribute("href", "/ward-flow/ed");

    for (const [index, role] of SIGN_IN_ROLES.entries()) {
      fireEvent.click(roles[index]!);
      const link = screen.getByTestId("ward-sign-in-open-as");
      expect(link).toHaveAccessibleName(`Open as ${role.name}`);
      const href = link.getAttribute("href") ?? "";
      // A plain address: no query or fragment carries the chosen role, catchment or shift on.
      expect(href, role.name).toMatch(/^\/ward-flow(\/[a-z-]+)*$/);
      const pageFile = path.join(REPO_ROOT, "src", "app", ...href.split("/").filter(Boolean), "page.tsx");
      expect(existsSync(pageFile), `${role.name} opens ${href}, which has no page`).toBe(true);
    }
  });

  it("writes no storage, cookie or session when pressed", () => {
    render(<WardFlowSignInScreen />);
    fireEvent.click(screen.getByRole("button", { name: /Governance lead/ }));
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const removeItem = vi.spyOn(Storage.prototype, "removeItem");
    const clear = vi.spyOn(Storage.prototype, "clear");
    const cookieBefore = document.cookie;
    const cookieSetter = vi.fn();
    const cookieDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, "cookie");
    Object.defineProperty(document, "cookie", {
      configurable: true,
      get: () => cookieBefore,
      set: cookieSetter,
    });
    try {
      const link = screen.getByRole("link", { name: "Open as Governance lead" });
      expect(link).toHaveAttribute("href", "/ward-flow/governance");
      fireEvent.click(link);
      expect(setItem).not.toHaveBeenCalled();
      expect(removeItem).not.toHaveBeenCalled();
      expect(clear).not.toHaveBeenCalled();
      expect(cookieSetter).not.toHaveBeenCalled();
      // Nothing on the page changes either: the same role is still the only one chosen.
      expect(screen.getByRole("button", { name: /Governance lead/ })).toHaveAttribute("aria-pressed", "true");
    } finally {
      delete (document as unknown as Record<string, unknown>).cookie;
      if (cookieDescriptor) Object.defineProperty(Document.prototype, "cookie", cookieDescriptor);
      vi.restoreAllMocks();
    }
  });
});

describe("Ward Flow sign-in screen — shifts are the app's one shift pattern", () => {
  const clock = (minute: number) =>
    `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;

  it("names Day, Evening and Night with the hours SHIFT_PATTERN holds", () => {
    expect(SHIFT_ROSTER_OPTIONS.map((option) => option.word)).toEqual(
      SHIFT_PATTERN.map((shift) => shift.name.replace(/ Shift$/, "")),
    );
    for (const [index, shift] of SHIFT_PATTERN.entries()) {
      expect(SHIFT_ROSTER_OPTIONS[index]!.hours).toBe(`${clock(shift.startMinute)} to ${clock(shift.endMinute)}`);
    }
  });

  it("shows the shift words on the shift switch", () => {
    render(<WardFlowSignInScreen />);
    const shiftSwitch = screen.getByRole("radiogroup", { name: "Shift" });
    expect(
      within(shiftSwitch)
        .getAllByRole("radio")
        .map((option) => option.textContent),
    ).toEqual(["Day", "Evening", "Night"]);
  });
});
