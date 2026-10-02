import { readFileSync } from "node:fs";
import path from "node:path";

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SIGN_IN_ACTIONS, SIGN_IN_ROLES } from "@/components/ward-flow-sign-in/ward-flow-sign-in-data";
import { WardFlowSignInScreen } from "@/components/ward-flow-sign-in/ward-flow-sign-in-screen";

/**
 * The catcher for the new "Sign in and role" screen
 * (`docs/ward-flow/build-contracts-2026-09-12/contract-sign-in.md`).
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
  "src/app/mockups/ward-flow-sign-in/page.tsx",
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

describe("Ward Flow sign-in screen renders", () => {
  it("shows every named section, the role picker, and stays inert when 'Go in' is pressed", () => {
    render(<WardFlowSignInScreen />);

    expect(screen.getByRole("heading", { level: 1, name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Read this before you go in" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Who you are, and what you may do" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Your role/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^What the bed coordinator can do/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^What the bed coordinator cannot do/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Refused to every role/ })).toBeInTheDocument();
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

    // "Go in" is inert: pressing it announces what it would open and does not throw, navigate, or
    // leave a credential-shaped control behind.
    const goButton = screen.getByRole("button", { name: /^Preview as/ });
    fireEvent.click(goButton);
    expect(screen.getByRole("status")).toHaveTextContent(/Not wired in this prototype, so nothing has opened\./);
    expect(document.querySelectorAll("input")).toHaveLength(0);
  });

  it("never renders a claim that a role is enforced, only what the design system's screens index names it for", () => {
    render(<WardFlowSignInScreen />);
    // The screen must attribute reach to the screens index, not to the running application.
    expect(
      screen.getByText(/is read from the screens index of the Ward Flow design system, which is a drawing of a tool/),
    ).toBeInTheDocument();
  });
});
