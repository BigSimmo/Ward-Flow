# Build contract — Legal forms (drawing: `docs/ward-flow/mockups/legal-forms-third-edition.html`)

## 1. Does this screen already exist? NO — as a screen. Parts of its DATA are wired elsewhere.

`ward-legal-forms.ts` (70 lines, read in full) is not a screen — it is the picker list
(`SELECTABLE_LEGAL_FORMS`) and two naming helpers, `legalFormName` / `legalFormNameLabelFirst`
(`src/components/ward-management/ward-legal-forms.ts:38-70`). There is no dedicated "Legal
forms and deadlines" list page anywhere in `src/components/ward-management/**` or
`src/app/mockups/ward-flow/**` — no directory, no route (`find src/app/mockups/ward-flow -type d`
lists 30+ routes, none named `legal*`; `docs/site-map.md` has no ward-flow legal route). Searched
`legalForm` (three spellings tried: `legalForm`, `legal-form`, `LegalForm`) across the whole model
and every screen.

What DOES exist, spread across other screens, all reading the same `Movement.legalForm?: LegalForm`
(`ward-model.ts:894`):

- Movement drawer: one line, "Legal authority: {name}" (`movement-drawer.tsx:224-225`).
- Coordinator shortlist: `legalFormLine` — form name, and "no deadline recorded" paired with
  elapsed ED time, or minutes to/past deadline (`shortlist-panel.tsx:231-241`).
- Console (`ward-management-console.tsx:145-152, 2716-2719`), Network
  (`ward-management-network.tsx:1165`), Delays, Handover, ED screen, `ward-priority.ts`,
  `ward-derivations.ts`, `ward-pressure.ts` — each reads `movement.legalForm?.dueAt` for its own
  narrow purpose (sorting, breach counts, one line of text). None of these is a cross-patient
  "every legal form, ordered by time remaining" list — that view, which is this drawing's entire
  content, has no app counterpart.

**Verdict: build, not rebuild.** Nothing existing duplicates this screen's list-and-breakdown view.

## 2. The drawing's sections, in order

The whole page body is lines 4474-4611 of the HTML (everything else in the 12,143-line file is
shared chrome — masthead, search, drawers — common to every mockup in this set). Two panels only:

1. **"Legal forms and deadlines"** (`h2#lfHeading`, line 4576) — a single ordered list
   (`ul#legalList`), one row per open movement that carries a legal form: name, ID, form code,
   legal status, deadline sentence, site/department, owner. A scope sentence above it
   (`#lfScope`) states how many of the service's open movements carry a form vs. are voluntary.
2. **"If nobody renews it"** (`h2#lfNextHeading`, line 4592) — explanatory prose (Ward Flow does
   not act when a deadline passes; the record stays as-is until a human changes it) plus a
   per-form breakdown (`#lfBreakdown`: form code, open count, how many breached).

No tabs, no third panel.

## 3. What the model actually holds

`SELECTABLE_LEGAL_FORMS` (`ward-legal-forms.ts:38-44`) — the ONLY forms the app names, verbatim:
`{code:"1A", kind:"examination"}`, `{code:"3B", kind:"detention"}`, `{code:"3D"}` (no kind —
model holds no classification for it), `{code:"4A", kind:"transport"}`, `{code:"4C",
kind:"transfer"}`. Titles are never stored — they resolve from `formTitleForCode` (the Chief
Psychiatrist register) at render time; an unlisted code renders as the bare "Form {code}"
(`ward-legal-forms.ts:56-59`).

`LegalForm` (`ward-model.ts:273-283`): `{ code: string; kind?: ...; dueAt?: Instant }`. `dueAt`
is optional.

Drawing → model mapping: patient name/ID (`Movement` fields) ✓; form code (`legalForm.code`) ✓;
`legalStatus` — a separate required field, `"Voluntary" | "Referred for psychiatric examination"
| "Detained awaiting examination" | "Involuntary inpatient"` (`ward-model.ts:248-249`) ✓;
deadline sentence — `legalForm.dueAt` where present, **NOT IN THE MODEL for every 1A and 3B** (see
§4); "owner" — `Movement.owner` (or "No owner") ✓; site/department — via `ed(m.ed)` in the
drawing's fixture, `Movement.ed` in the real model ✓; per-form breach breakdown — derivable from
existing per-movement breach logic (`isBreached`, mirrored in `ward-priority.ts`/
`ward-derivations.ts`) ✓.

## 4. 🔴 What cannot be built honestly — EXPIRY

This is the central finding, not a footnote. `ward-model.ts:250-268` is explicit and owner-sourced:
**neither a Form 1A ("referral for examination") nor a Form 3B ("inpatient treatment order")
carries a `dueAt` in this model**, by the product owner's own instruction (2026-08-23: "please can
you leave the legal part and just start a clock once the patient arrives to ED. Keep it simple for
now"). Only 4A (transport) and 4C (transfer) carry real `dueAt` figures. 3D carries none — the
model holds no classification or clock for it at all.

So the drawing's premise — a list of "legal forms and deadlines" sorted "by time remaining" — has
**no time remaining to sort by** for what will be most of its rows (1A/3B are the referral and
detention forms, the ones most likely to be common). Reassuringly, the drawing's own code does
NOT fabricate one: `legalSortKey`/`legalDeadlineText` (HTML lines 8581-8599) correctly treat
`m.legalDue === null/undefined` as "no deadline recorded" and sort it last. **The drawing is
honest about this on its face.** The risk is not in the drawing's logic — it is that the screen's
own title and framing ("Legal forms and deadlines", sorted "by time remaining") implies every
legal form has a clock, when the model and the owner have deliberately withheld one for the two
most legally consequential forms (examination referral, detention). A coordinator skimming the
list could reasonably read "no deadline recorded" as "nothing to worry about" rather than "this
form has no expiry the system can track at all" — exactly the ambiguity §5 below shows the app has
already had to guard against elsewhere. Do not design a fix — this needs the owner's sign-off on
whether/how a 1A or 3B could ever carry an authority-expiry figure, and that figure would have to
trace to him or the clinician by name and date, not to an assistant's recollection of the Mental
Health Act (`ward-model.ts:266-268`).

## 5. Owner decisions that bind this screen

- **`ward-model.ts:250-268`** (not the ruling doc, but itself the authority) — 1A/3B carry no
  `dueAt`; do not reintroduce one without a named, dated source.
- **Canonical wording for an absent fact, and the drawing does NOT match it.** The standing rule
  (memory: "one word, two states") is realised here as `shortlist-panel.tsx:225-241`: the
  comment is explicit — _"The wording is deliberately 'no deadline recorded', not 'no statutory
  deadline'... asserting an absence is the same overreach as asserting the [deleted] seven-day
  figure"_ — and, critically, the app **never renders that phrase bare**; it always pairs it with
  the real elapsed ED time (`"{form} — no deadline recorded; {N} min in the emergency
department"`) specifically so it cannot be misread as a statutory countdown. The drawing's
  `legalDeadlineText` (HTML line 8595) renders **bare** `"No deadline recorded"` with nothing
  paired to it. This is the exact shape a related ruling (`owner-decisions-2026-09-1x.md:1162-1181`,
  "D-25", quoting "R-5") flags: R-5 forbade this same string for a PATIENT subject with no legal
  deadline (on the Delays screen) — this screen's subject is likewise a patient, not a department,
  so the same concern applies. I could not locate R-5's full original ruling text in this repo
  (only D-25's summary of it survives) — flagging that as a limit, not asserting its full scope.
  **Do not ship the drawing's bare wording without checking it against `shortlist-panel.tsx`'s
  paired pattern first.**
- Console's `legalFormReadinessLine` (`ward-management-console.tsx:149`) uses yet a third phrasing
  (`"{name} · no deadline recorded"`, no elapsed time). The app is not internally consistent on
  this wording today — worth surfacing to the owner, not resolving unilaterally.

## 6. Catchers, per section

1. **List panel:** a DOM/unit test asserting (a) population = open movements with a `legalForm`,
   scoped by service, matching `legalPopulation()`'s filters; (b) sort order — breached first
   (furthest-past first), then soonest-due, then no-deadline rows tied by longest wait, matching
   `Command's own tie-break` cited in the drawing's comment (HTML lines 8558-8571); (c) the
   deadline sentence for a `dueAt`-less row is asserted byte-for-byte against whatever wording is
   ruled correct (not invented fresh) — a mismatch here is a red string-equality test, cheap and
   exact.
2. **Breakdown panel:** a test that the per-form counts and breach counts in `legalFormBreakdown`
   sum back to the list panel's own rows (no separate/divergent computation) — same shape as the
   D-26 "cannot disagree structurally" pattern already used for Command vs. ED home.

## Limits of my reading

I read `ward-legal-forms.ts` in full, the `LegalForm`/`LegalStatus` model sections in full, every
non-test `legalForm` call site by grep (not every file opened in full), and the drawing's page
body in full plus its `legalForms`-specific script section. I did NOT read the whole 12,143-line
HTML file (the other ~11,900 lines are shared chrome, confirmed by heading search, not read
line-by-line). I could not find R-5's original full ruling text anywhere in the repo — only two
later documents quoting/summarizing it — so I cannot confirm its exact scope or reasoning, only
that it forbids this exact phrase for this exact kind of subject on a different screen. I did not
read `formTitleForCode`/the Chief Psychiatrist register file itself, so I cannot verify the actual
titles it returns for 1A/3B/3D/4A/4C — only that the mechanism exists. Clinical accuracy of what
each form code legally means (beyond what the code comments assert) is outside what I verified —
I am reporting what the code says, not confirming it against the Mental Health Act myself.
