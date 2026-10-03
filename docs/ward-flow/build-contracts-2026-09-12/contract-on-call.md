# Build contract — Ward Flow "On-call and contacts"

Drawing: `docs/ward-flow/mockups/on-call-third-edition.html` (8,627 lines)
Route measured: does not exist under `src/app` — this is a genuine new build, not a reskin.

## Current interface — owner-requested simplification, 3 October 2026

The current Movements design remains the visual baseline. On-call uses the Capacity-style header placement: a compact top-right directory island with derived role, consultant and ED counts. The page has three sections: on-call roles, a full-width ED directory, and three routing cards in one desktop row. Tables retain all source records, service filters and search; filtered counts and a clear-filters action show the current scope.

The owner requested removal of the two yellow coverage banners and the data/governance section. Services without roles now receive a neutral, explicit empty state when selected. A brief visible synthetic-data statement remains beside the roster; no real contacts or live coverage are asserted. The Tier 3 button and modal were removed from this directory: they only recorded an escalation against a movement and sent nothing. Redundant level/status columns, non-functional Connect buttons and hard-coded ED handover/liaison assignments were removed. Reach-via links scroll to the corresponding current-directory guidance.

The original research below is historical evidence, not a requirement to restore the removed panels or controls.

## 0. Design or reproduction?

**Design, not reproduction — with one explicit exception the drawing itself names.**

The drawing's own comment (`on-call-third-edition.html:4406-4412`):

> "Everything above this comment is the third edition stylesheet and the kit's shell rules, copied from command-third-edition.html unchanged."

and again at `:4620-4625`:

> "The first is the network: the wards, the emergency departments, the movements, the referrals and the override register, copied from command-third-edition.html unchanged"

So the **shell chrome and the Command network data** (wards/EDs/movements/referrals/overrides) are a deliberate, disclosed copy of an already-built pattern (Command's shell). But the screen's actual subject — on-call roles, ED liaison, "Reaching a role" — is new content authored for this drawing (`ROLES`, `SVC_ROLES` arrays, `:5603-5629`), not a reproduction of any existing built screen. I found no comment anywhere in this file claiming the on-call/contacts _content_ was "reproduced exactly" from an existing component (checked case-insensitively for "reproduced", "verbatim", "existing component", etc. — no hits beyond the shell-copy statements above). The warning in the brief about a drawing claiming exact reproduction refers to a different file in the mockup set, not this one.

**Consequence:** this is not "wire up what exists" for the on-call content. The shell/network portion, if built, should reuse Command's already-built components rather than re-implement them — that part genuinely is "wire up what exists."

## 1. Does any contacts or roster surface exist?

Enumerated (not just grepped for expected names) across `src/app` and `src/components`:

- **`src/app/(search-app)/on-call/**`** and **`src/components/on-call/**`** — a real, already-built feature, but it is a **different product area entirely**: PsychSift's clinical-reference on-call mode (card, education, logistics, orientation, playbook, referrals, search, contacts sections — e.g. `on-call-contacts-section.tsx`, `on-call-entry-editor.tsx`). This is clinical-guideline content (what to know when on call), not a ward bed-coordination staff roster. It shares the name "on-call" with the drawing but not its subject.
- **`src/components/caring-contacts/**`** (`team-roster.tsx`, `contact-vocabulary.ts`) — also a distinct feature (a different mode's contact/roster workspace), unrelated to Ward Flow.
- Inside `src/components/ward-management/` itself: **no roster, contact, phone, bleep, pager, escalation-contact-directory, or duty-consultant surface exists.** The only hits are prose/comments (owner-decision citations) and the two model fields covered in §3.

None of these is a built Ward Flow on-call/roster screen. The route genuinely does not exist, confirming the brief's measurement.

## 2. The drawing's sections, in order

Rendered by `renderOnCall()` (`:5828-5833`):

1. **"On-call now"** (`h2#ocNowH`, `:5765-5782`) — the two network-wide roles (Bed coordinator, Governance lead) with shift window, plus a table of Coordinator on call / Duty consultant per health service, plus a count "N of M roles recorded." A note for WA Country: "No coordinator on call and no duty consultant is recorded for WA Country in this prototype."
2. **"ED liaison, by department"** (`h2#ocEdH`, `:5786-5799`) — a table of Site / Emergency department / Health service for each visible ED, described as answering "through its own ED liaison."
3. **"Reaching a role"** (`h2#ocReachH`, `:5801-5811`) — pure explanatory text, no data: states a role is reached through the site directory kept outside the prototype, and that any extension/address shown elsewhere is a placeholder that "reaches nothing."
4. **"Every figure here is invented"** (`h2#ocFootH`, `:5815-5826`) — disclosure footer with "What is invented" / "What is real" / "Reconciled" sub-panels, plus the page's own reconciliation line (`ocReconcile`).

A "New referral" menu and a service filter bar sit above these four, reused from the Command shell pattern (`:4591-4610`).

## 3. 🔴 Does the model hold people at all, beyond patients?

**No. Checked directly in both files — no.**

`ward-model.ts` and `ward-sites.ts` hold **zero** concept of a staff member: no name field, no phone/pager/extension/address field, no shift-roster type, no "person on call" type. Confirmed by reading every type export in both files (`Unit`, `Site`, `EmergencyDepartment`, `Movement`, `Referral`, `Decline`, `Override`, etc. — none carries a person).

**The only two things that come close, and exactly what they are and are not:**

- **`Movement.owner: string`** (`ward-model.ts:903`). Seed values (`ward-movements.ts`, e.g. lines 89, 118, 148, 291): `"ED mental health team"`, `"Flow coordinator"`, `"Ward nurse in charge"`. This is a **role/function label**, never a named individual, never a contact method. It has no shift, no time window, no phone number.
- **`Movement.escalation?.contact: string`** (`ward-model.ts:1018`, doc comment: "Recorded when the network is exhausted"). Seed value (`ward-movements.ts:437`): `"State bed coordination desk"` — again a **desk/function description**, not a person or number. But the _type_ is a bare `string`: nothing in the type system stops a future value from being a real name or number. `docs/ward-flow/archive/dated-notes/owner-decisions-2026-09-1x.md:1444` already flags this exact field as a "false-presence trap": _"the substantive claim is TRUE with a false-presence trap under it: no `contactedAt`, `firstContactAt` or `contactRecord` exists anywhere — but `ward-model.ts` carries `escalation?.contact`, an escalation's contact [role/desk]."_ That ruling (D-39) is about a **different** screen (one pairing "Contacts are not recorded" with a "Time to first contact" panel), held pending resolution — it is not a ruling on this on-call screen, but the same trap applies here: a naive grep for "contact" in the model returns a hit and could mislead a builder into thinking a real contact concept exists.
- **`WardFlowRole`** (`ward-flow-roles.ts:26`): `"coordinator" | "ed" | "ward" | "officer" | "demo" | "community"` — this is an **application/login role** used for addressing in-app notices (`Addressee`), not a roster of who holds which clinical duty, and carries no name or contact method either.

There is no partial roster to extend — there is a role-label convention (string tags naming a function) and nothing that has ever held a name, number, or shift for a real person.

## 4. 🔴 What cannot be built honestly

**The data half of this screen cannot be built honestly at all — only the "figures are invented" framing already in the drawing can be.**

The drawing's own "Reaching a role" panel and footer already state this is unbuildable as anything but a disclosed mockup: "No real number, pager, extension or address is held on this screen, for any role... A real one written here would age the moment a roster changed, and nobody reading a mockup would know to fix it." That is accurate, and it is the correct posture — **not a gap to close by building real contact data**, because there is nowhere in the app for that data to live truthfully.

The hazard named in the brief is real: this screen's entire purpose is to be dialled. If it were built with any invented-looking name, extension, or address attached to a role, a coordinator under time pressure at 3am could treat it as real and ring it. The drawing avoids this by disclosing every placeholder in-line and by never rendering an invented name against a role (the `ROLES`/`SVC_ROLES` arrays hold no `name` field at all — see §3). Any build must preserve that: **no field that could be mistaken for a real contact method may ever be populated, even with an obviously-fake value, unless every rendering of it is co-located with an explicit "invented/placeholder" disclosure** — which is exactly what the drawing already does for the Tools-panel "ward contacts" table (`ext 01`, `name@example.invalid`, both under "Extensions and addresses are placeholders... None is real," `:7444`).

**What the model would need before a real (non-disclosed) version of this screen could exist**, named without designing it (owner approves growth individually):

- A staff/person record: name, role, contact method(s), and a shift/roster window — none of which exists today.
- A source of truth for who currently holds a role at a given time (a real roster feed or manual roster entry mechanism) — none exists; `ROLES`/`SVC_ROLES` are hard-coded fixture arrays, not derived from anything live.
- A way to keep contact details current without the app itself going stale the moment a real roster changes (the drawing's own stated reason it defers to "the site directory, kept and updated outside this prototype").

## 5. Which owner decisions bind it

- **The changeable-data rule** (`owner-decisions-2026-09-1x.md:170`): _"every invented figure carries its own marker, and nothing may be built that only works for the seed."_ Directly binding: every invented role-holder, shift, and placeholder extension/address must carry its own in-line disclosure, matching the drawing's existing footer and "Reaching a role" panel — not a single disclaimer under a heading.
- **D-39** (`:1438-1444`, HELD, build neither): a related but distinct screen was held for pairing "Contacts are not recorded" with a "Time to first contact" panel, and for the `escalation.contact` false-presence trap. Not a ruling on this screen, but the same trap (a grep for "contact" finding a real-looking field) applies here and must be flagged the same way if this screen is ever scoped for build — i.e., raise it to the owner rather than assuming D-39's "HELD" silently extends to on-call.
- No owner ruling specifically names "on-call," "roster," "duty consultant," or "coordinator on call" — searched the full decisions doc, no hits. This screen has not been individually ruled on.

## 6. The catcher

Per section, what would prove it was built correctly:

1. **On-call now** — a test asserting `ROLES`/`SVC_ROLES` (or their production equivalent) never carries a `name`, `phone`, `extension`, `pager`, or `address` field, and that every "recorded" role renders only a role label + shift window, never a person.
2. **ED liaison** — a test asserting the ED table only ever renders `Site`/`Emergency department`/`Health service` columns sourced from `ward-sites.ts`, with no contact column.
3. **Reaching a role** — a static content test that the explanatory copy about placeholders/site-directory is present and unconditionally rendered (not something that can be dismissed and stay dismissed).
4. **Footer disclosure** — a test that the "What is invented" / "What is real" text renders every render, and that it names role-holders and shift data as invented (not just "figures").

**The catcher that stops someone building it with invented contacts later:** a repository-wide static gate (in the shape of the existing `eslint-rules/no-hardcoded-hex.mjs` pattern) that fails the build if any string literal matching a phone/extension/pager-shaped pattern (e.g. `/^(ext\.?\s?\d|\+?\d[\d\s-]{6,}|\d{2,4}-\d{3,4})/i`) appears inside `src/components/ward-management/**` or any Ward Flow route, **unless** it sits inside a file or JSX subtree already carrying the word "invented" or "placeholder" in an adjacent disclosure string. This does not exist today — it would need to be built alongside the screen, not after it, given the 3am-dial hazard.

## Limits of this reading

- I read `ward-model.ts` and `ward-sites.ts` in full (via targeted greps across all exports, not a sample), and `ward-flow-roles.ts`, `ward-movements.ts` (grep-only, not read end to end), and `ward-derivations.ts` only at the `owner`-usage lines. I did not read `ward-flow-reducer.ts` or `ward-flow-events.ts` beyond the single `escalation`/`contact` line each.
- I read the owner-decisions doc only via targeted search (on-call/roster/contact/staff/duty terms and the changeable-data rule), not end to end — it is a very large document and other rulings may exist that use different words for the same concept (e.g. "who to ring") that a keyword search missed.
- I did not open every file the roster/on-call enumeration turned up (§1) — I read file names and a sample of `caring-contacts` filenames to confirm they are a different feature, not the full contents of `on-call-entries` API routes.
- I did not check `docs/ward-flow/plans/**` for any newer build plan that might already scope this screen.
- No code was run; this is static reading only, and no repository file was touched.
