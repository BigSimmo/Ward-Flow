# Build contract — Ward Flow "Sign in" screen

Drawing: `docs/ward-flow/mockups/sign-in-third-edition.html`
Route status: measured — no route exists for this screen anywhere in `src/app` or `ward-nav.ts`. Genuine new build.
This document is READ-ONLY output. No repository file was built, edited, created or deleted to produce it.

## 0. Design or reproduction?

**A new design, not a reproduction.** Grepped the whole file for "reproduced", "verbatim", "exactly from", "copied from", "based on" — zero matches. The file's own comment block (lines 4383–4396) instead states this screen is _"deliberately outside the shell of section 5.6"_ used by every other screen, because _"a person who has not signed in has no rail to stand in and no bar to read"_, and cites **"Owner ruling, 10 September 2026: standalone, no rail or bar."** No claim anywhere that this reproduces existing code.

## 1. What does the drawing actually ask for?

**A role picker, not a credential screen.** The drawing says this in its own words, twice, in the "Who you are, and what you may do" section (lines 4665–4677):

> "Who you are is settled by the hospital's own sign on, which sits outside Ward Flow and is drawn nowhere in this prototype. **This screen holds no password field, because a drawing of a tool must never be somewhere a real password is typed.**"

> "What Ward Flow settles is the role, and the role is a set of permissions. **Ward Flow signs a role in and never a person**, which is why the foot of the rail on every other screen reads Signed in as Bed coordinator and never somebody's name."

The title is literally `<h1 id="siTitle">Sign in</h1>` (line 4640) — "Sign in AND ROLE" from the brief is not a literal quote from the file, but the drawing's content matches the "role-choosing" reading exactly: the whole body is a `role="group"` of toggle buttons (`.roleBtn`, `aria-pressed`), never a form, and the only submit-like control is a button whose own note says "Not wired in this prototype."

## 2. Does a role concept exist in the app? Enumerate.

Yes, a real one — but it does **not** match the drawing's role list.

- `src/components/ward-management/ward-flow-roles.ts`: `WardFlowRole = "coordinator" | "ed" | "ward" | "officer" | "demo" | "community"`. This is the type every event in `ward-flow-events.ts` carries (`role: WardFlowRole`) and the reducer's `EVENT_ROLE` table checks it against.
- `src/components/ward-management/ward-chrome-role.ts`: a _different_, narrower type, `WardChromeRole = "coordinator" | "ward" | "ed"`, and its own doc comment states outright: **"WARD FLOW HAS NO SIGNED-IN ROLE… the role IS the route you are on"** and **"THIS READS THE PATH AND STORES NOTHING… IT IS A CHROME HINT, NEVER A PERMISSION."**
- `src/components/ward-management/ward-role-switcher.tsx`: the app's real role switcher. It is a set of `<Link>` elements to fixed role-home routes (Coordinator → `/mockups/ward-flow`, Officer → `/mockups/ward-flow/transport/officer`, Ward/ED → inferred detail routes), explicitly **not** "a control that sets an identity." Its own comment: "the role switcher is a set of `<Link>`s to role homes, not a control that sets an identity."
- `src/components/ward-management/ward-nav-role-order.ts`: reiterates — "THE ROLE IS THE ROUTE. Ward Flow has nobody signed in."

**Current role is not stored anywhere**, checked directly: `grep -i "currentRole|activeRole|localStorage|sessionStorage"` in `ward-flow-provider.tsx` returns nothing. There is no state variable for "who I currently am." Role is recomputed fresh, on every render, from `pathname`.

**The drawing's seven roles (Bed coordinator, Coordinator on call, ED liaison, Duty consultant, Governance lead, Service lead, Ward) are drawn from the Ward Flow _design system's_ screens index, not from the code's `WardFlowRole`/`WardChromeRole` enums.** They overlap (Ward ≈ `ward`) but mostly do not correspond to distinct real destinations — the code has no separate route or chrome state for "coordinator on call," "duty consultant," "governance lead," or "service lead." This is a gap, named in section 5 below, not something to paper over.

## 3. The drawing's sections and fields, in order

1. **"Read this before you go in"** — four paragraphs of disclaimer prose. No fields.
2. **"Who you are, and what you may do"** — two paragraphs of explanation (quoted in §1). No fields.
3. **"Your role"** (`#roleGroup`, `role="group"`) — seven toggle buttons (`.roleBtn`, `aria-pressed`), one per role, each showing the role's name, a tag ("N of 13 actions"), and a one-line description. Single-select, no free text.
4. **"What this role can do"** — a derived, read-only list of actions the chosen role is named for. No fields.
5. **"What this role cannot do"** — a derived, read-only list of actions named for other roles, with a note that three more roles exist that this screen does not offer (triage, incoming coordinator, community team). No fields.
6. **"Refused to every role"** — a derived, read-only list of things nobody on this screen may do. No fields.
7. **"Go in"** — one button, `id="signIn"`, text "Sign in as {role}", plus a note line ("Signing in would open {screen}. Not wired in this prototype.") and the page's own reconciliation check line. No fields.
8. **Footer** — an Appearance control (Light/Dark/Auto, three toggle buttons) and a link to the design-system markdown document. No fields.

**There is no text input, no password input, and no field of any kind anywhere in this markup.** The only interactive elements are toggle buttons.

## 4. Credential-shaped fields

🔴 **There are none. Zero.** Grepped the entire file for `type="password"`, `type="text"`, `<input`, "username," "staff number" — none exist. The drawing contains no `<input>` element at all.

Because there is nothing typed, there is nothing to discard, store, or send anywhere. This is the single most load-bearing fact in this contract: **the drawing has already made the correct decision the brief warned about, before any build starts.** A build that stays faithful to this drawing introduces no credential surface at all.

## 5. What cannot be built honestly

- **No session, no user identity, no persistence across reload.** Confirmed by direct code reading, not inference: `ward-chrome-role.ts` states the app "reads the path and stores nothing," and `ward-flow-provider.tsx` holds no current-role state. The drawing's own "Sign in" button, when clicked, does not navigate — its handler (script lines 5093–5099) only announces: _"Sign in as {role} would open {screen}. Not wired in this prototype, so nothing has opened."_ **If a "signed-in as" state cannot survive a page load, a sign-in screen is theatre, and this drawing already says so of itself rather than pretending otherwise.**
- **The seven roles offered do not map cleanly onto the app's real role types.** A faithful build can make each role button link to a real destination only where one exists in `ward-nav.ts`/`ward-role-switcher.tsx` (roughly: Bed coordinator → Command, Ward → the ward index or example ward, ED liaison → the ED example route). For "Coordinator on call," "Duty consultant," "Governance lead," "Service lead" there is no distinct destination the live code recognises as a different role — at best they'd land on an existing screen (Governance, Statistics) that any role can already open regardless of chosen role, which would misrepresent "signing in as" that role as gating something it does not gate.
- **Wiring the "Sign in" button to actually navigate is a decision, not a given.** The drawing explicitly keeps it inert ("Not wired in this prototype"). Whether a real build should make it a set of `<Link>`s (matching `ward-role-switcher.tsx`'s existing, honest pattern) or keep it inert and only demonstrative is a product decision this contract does not make.
- **No mechanism exists, anywhere in the app, to validate anything typed** — moot here since nothing is typed, but stated for completeness per the brief's instruction.

## 6. Owner decisions that bind this screen

From `docs/ward-flow/archive/dated-notes/owner-decisions-2026-09-1x.md`:

- **D-2** (line 108, owner's words, 2026-09-10, ruled in force): _"a message is addressed to a **role at a place**… and it is seen when the viewer is in that role — the role switcher the app already has is the viewer. **No new notion of a user, an account or a person-who-logs-in is created**, because that is a use-gate question with privacy consequences and it was not asked."_ — This directly rules out building any real authentication, account, or persisted identity for this screen. A role picker that stays a role picker is compliant; a screen that grows an account/session is not.
- **D-4 ADDENDUM** (lines 390–429): a related ruling on a different panel (the access-search "who looked" column) makes the same point from the opposite direction — a role value that "is not an identity" must not be presented as one, and _"If Josh wants a real 'who', that is a signed-in user — which D-2 rules out for this build."_ Directly on point for this screen: any "Signed in as X" wording built here must keep meaning "role chosen," never "person authenticated."
- **Q-8** (line 54): _"A reload wipes the demonstration — leave it? **YES, this phase.** Persistence is a separate decision with privacy consequences once the data stops being invented."_ — Consistent with §5: no persistence across reload is the ruled default for this whole build, not just this screen.
- The disclosure rule ("every invented figure discloses in its own sentence") is already met by the drawing's own boilerplate header comment and its "Read this before you go in" section, which states plainly that every figure is invented and the hospital/health-service names are real.

I found no owner decision that names "sign in," "role picker," or this screen by name directly — the above are the closest bindings, reached by searching "role," "sign in," "identity," and the invented-figures rule as instructed.

## 7. The catcher, per section

- **§1 disclaimer / §2 explanation:** static text; catcher is the existing whole-repo governance-copy contract tests (verbatim-disclosure checks) already run under `verify:cheap` — no new catcher needed beyond keeping the sentences intact.
- **§3 role picker / §4–6 derived lists:** the drawing's own reconciliation line (counts every role's two lists against `ACTIONS.length` on every render) is a strong existing self-check; a build should keep an equivalent as a unit test asserting the two lists partition the action set for every role.
- **§7 "Go in":** if built inert (as drawn), a test asserting the button's click handler produces no navigation and no dispatched event. If built wired to real links, a test that every role's destination resolves to a real route in `ward-nav.ts` (mirroring the existing `tests/ward-nav.test.ts` href-reality check) — this stops a role button silently promising a screen that does not exist.
- **🔴 The specific catcher the brief asks for — stopping this screen from ever growing a real-looking password field:** no such guard exists today (checked: no test file references "sign-in" + "password" together). The recommended catcher is a **static content test** on this screen's source file/route asserting it contains no `<input>` element of any type, and no string matching `/password|passphrase|PIN\b/i` outside of a comment explaining why one must never be added — the same shape as the repo's existing `eslint-rules/no-hardcoded-hex.mjs` pattern (a grep-shaped static rule, not a runtime check), scoped to this one route so it cannot be silently loosened by a change elsewhere. This is a recommendation, not a build — the brief asks that gaps be named, not designed.

## Limits of this reading

- I read the full drawing file (5,148 lines) via targeted greps plus two full-range reads (lines 1–1822 and 4380–5148); I did not re-read lines 1823–4379 in full, since grep confirmed no credential-related or role-related terms occur there and that range is the shared reference stylesheet documented at the top of the file (identical boilerplate pattern seen in this drawing set).
- I read `ward-flow-roles.ts`, `ward-chrome-role.ts`, `ward-nav-role-order.ts`, and the top ~120 lines of `ward-role-switcher.tsx` and `ward-nav.ts` in full; I did not read every line of `ward-flow-provider.tsx` or `ward-flow-events.ts` (over 500 lines), relying on targeted grep for role/session/storage terms in those files, which returned no matches for a persisted "current role."
- I read `docs/ward-flow/archive/dated-notes/owner-decisions-2026-09-1x.md` by targeted grep and then read the two most relevant sections (D-2, D-4 addendum) in full; I did not read the entire 2,000+ line document top to bottom, so a binding ruling elsewhere in it that does not use the words "role," "sign in," "identity," or "invented" could exist unseen.
- No server was run and no test was executed — this is a static reading only, as instructed. I did not verify at runtime that the drawing renders as described; the reading is from source only.
- If a decision about wiring the "Sign in" button, mapping the seven design-system roles onto the app's six real role values, or building the recommended password-field guard is needed, that is a decision this contract does not make — hand it back rather than assume it.
