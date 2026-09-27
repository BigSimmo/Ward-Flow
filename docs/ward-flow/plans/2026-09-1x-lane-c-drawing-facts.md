# Lane C — facts COPIED from the four drawings, and two guards that do not exist

> **SUPERSEDED on 17 Sept 2026 by `docs/ward-flow/plans/README.md`.** Kept for history; do not follow.

Companion to `2026-09-1x-lane-c-search-patient-referral.md`. Re-derived at the line `8a41ff867a`,
after the third-edition drawings folded.

⚠️ **The master plan's §4 prose PARAPHRASES the drawings' panel and tab names.** Tab and panel names
are what a DOM test asserts, so a paraphrase makes the test fail against a **correct** screen — and
the cheapest repair from inside a task is to damage the screen. **Assert nothing from the prose.
Everything below is copied from the drawing itself.**

---

## A · Names and sentences

### A1 · The Search hub's reconciliation sentence, both branches

    agreeing      Invented figures, reconciled with each other, as at <clock>, no event feed on this screen
    disagreeing   Invented figures, N figure(s) do/does not reconcile, as at <clock>, no event feed on this screen

🔴 **The trailing clause is SCREEN-SPECIFIC, and this one names no event.** The instruction that
reached this lane described the sentence as carrying _"the clock and the last event"_. **This screen
has no event feed.** Composing from that description puts a last event on a screen that has none — a
false sentence, on the one line whose whole job is to be true read alone. **Copy each screen's own
clause from its own drawing; never assume it names an event.** A description of a string is not the
string. Implemented in `hub/hub-provenance.ts`.

⚠️ **The plural is a function of the count** — _"1 figure does not reconcile"_, _"2 figures do not
reconcile"_. A test written against a two-problem fixture passes while the commoner one-problem case
reads wrong.

### A2 · Panel headings

    Patient search    Search · Results · Selected person · Access record
    Search hub        The network · At a glance · Where these figures come from
    Patient           The person now · Journey · One day, one network
    Raise a referral  The person · Who the referral is about · What they need · The history ·
                      Where to refer · What will be sent · What follows from these answers ·
                      What sending does · Send · Reconciled to the Command screen

⚠️ **Two of these the prose loses.** §4.11 calls Search hub's third panel a _"real/invented footer"_;
it is **`Where these figures come from`**. And **`One day, one network`** is not in §4.10 at all — a
whole panel, not a rename.

#### A2a · 🔴 `Selected person` is NOT adopted as that panel's heading, and the reason is the drawing's

Settled under Ward Lead's D-1 test: changing it renames nothing a builder, a route, a seed or a
directory depends on — a grep finds the string only in two comments — **so it was mine to decide.**

**The panel serves THREE states, and only one of them is a person:**

    nothing selected   title "Preview"
    a person selected  title <the person's name>
    a movement         title "Movement WF-0xx"

**A fixed `Selected person` heading would be FALSE over a movement preview**, which is one state in
three. ⚠️ **Same shape as the facets** (§A3): the drawing's noun is right for the state it draws and
wrong for the states the app also has, and adopting it would assert the wrong noun rather than
rename a heading.

**And the dynamic title is better for the reader anyway** — a screen-reader user navigating by
heading hears the person's name rather than a category label. **Kept as it is, deliberately, and
recorded here so the drawing's name is not "restored" later as a fix.**

### A3 · Tabs

**Patient** — the tablist's accessible name is **`The record`**, not "Tabs". Five tabs, in order:

    Now · History · Community · Details · Documents

⚠️ **Now, History, Community and Documents each carry a count beside the word; `Details` does not.**
An assertion that every tab carries a count **fails against a correct screen.** The two that Task 11
does not build are **History and Community** — confirmed against the drawing, not assumed.

**Patient search** — the facets are over **MOVEMENTS**, not people:

    Everything · Accepted · No ward yet · No owner · Under 6 hours · 6 to 24 hours · Over 24 hours

Each carries its own empty wording (_"No open movement here has an accepted ward."_ / _"Every open
movement here has an accepted ward."_). ⚠️ **This confirms I-17 from the inside.** Q-3 keeps both
screens so the name stays, **but a facet test written as though the rows were people asserts the
wrong noun**, and the empty wordings are per-kind and must be copied, never generalised.

---

## B · Raise a referral — twelve rules inside its own drawing

The drawing carries numbered sections nobody's task list mentioned. **§7 · Rules the build must not
break** opens: _"Each of these is here because breaking it has already caused a defect somewhere on
this system."_ All twelve bind Task 13.

1. **Tap targets stay at 48px, not 44.** Cutting them to satisfy a generic accessibility rule
   **reintroduces a known test flake.** Twice-attested: the repository's own `CLAUDE.md` carries the
   same warning about `min-h-12` versus `min-h-11`.
2. **The reason sits BESIDE the Send button, never above it.** Reasons appear and disappear as you
   answer, and a reason above the button **moves the button out from under a thumb.**
3. **A figure beside a checkbox stays beside that checkbox; a destination's question stays on that
   destination's card.** Moving one into a rail **silently unhooks the screen-reader description.**
4. **Absence is written in words** — _"Not recorded"_, _"Not written yet"_. Never a blank, a dash or
   a zero. **A blank reads as a value.**
5. **Nothing ranks, scores or suggests a destination, and nothing scores the history.** Ordering is
   the network's own fixed order, and the copy says so.
6. **The name never enters the structured referral, and the history is not structured.** Say which
   half is enforced, every time it is said.
7. 🔴 **Every list of options is generated from one source of truth, never retyped into a sentence.**
   _"Retyped enumerations produced stale copy three times, including the sentence on this very screen
   that counted the permitted facts and was still saying 'five' after a sixth was added."_
8. **The rail REPORTS the history. It never previews it.** A truncated preview implies that something
   read it.
9. **Free text is never given a green state.** Green means checked on this screen, and nothing checks
   this.
10. **Nothing truncates the history silently.** Over the limit is a blocking, visible, counted state.
    Already correct in the app: the textareas deliberately carry no `maxLength`.
11. **When more than one destination is chosen, the screen says the history goes to all of them —
    before the send, not after.**
12. 🔴 **Taking a statement off the screen RELOCATES it; the statement itself survives.** v6 lifted a
    banner at the owner's request, and the prototype mark, the free-text warning and the
    not-a-medical-device sentence **all still exist in three places a reader reaches.** **Check this
    rule before lifting any sentence for reasons of appearance.**

---

## C · Four open questions sitting INSIDE the referral drawing

**§8 · Open questions the build must settle.** Its own framing: _"A screen that guarantees behaviour
nobody has built is the defect this project finds most often."_

⚠️ **A question inside a drawing has never been asked of the owner**, and his instruction for this
phase was to ask for clarification rather than infer. **None of these is settled here.**

**C1 — a half-written history lost on reload.** ⚠️ **Adjacent to Q-8 and NOT covered by it.** Q-8
asked whether a reload wiping the _demonstration_ may stand; this is an in-progress referral. The
drawing: _"Tolerable for three checkboxes, not tolerable for four paragraphs of a risk note. Either
the draft is held and the screen says so, or the screen warns before leaving. It must not silently do
neither."_ 🔴 **The hazard is that Q-8's YES reads as covering it** — a builder applying Q-8 here
discards a clinician's written account of a patient and has a ruling to point at. **Today the screen
does neither of the two acceptable things.**

**C2 — can the history be edited after sending, and does the receiving team see that it changed?**
Never asked. _"the version the receiving team read must remain recoverable, or two people will be
acting on different accounts of the same patient."_

**C3 — who can read the history after it is sent, and for how long?** Never asked, and the drawing is
precise about why it is new: _"The structured fields carry no identifying content, so access has been
a low-stakes question. The history changes that: it is the first thing on this form that would matter
if the wrong person read it."_ It marks itself _"needs an answer before a real patient, not before it
is built"_ — **so it belongs beside the three deferred real-patient gates. It does not block Task 13.**

**C4 — are the three sections the right three, and are the limits right?** 🔴 **The first half is
SUPERSEDED by Q-13 and must not be put to the owner again.** ⚠️ **The second half is live:** the
drawing calls 1500 / 2000 / 1000 _"placeholders — nobody has measured a real referral against them"_,
and `REFERRAL_HISTORY_LIMITS` holds exactly one entry, `history: 2000` — one of those three, carried
over unexamined. The drawing calls the limits **clinical judgements belonging to the owner.**

---

## D · Two guards that do not exist, measured while building Task 1

### D1 · 🔴 CORRECTED — there are TWO type scales with OPPOSITE floors, and the gate enforces the other one

⚠️ **This section first said "enforced by nothing". That was wrong, and wrong in the direction that
matters.** Ward Lead measured it and I confirmed both halves by opening the files:

    ward standard §4          "Nothing is set below 12px, and the scale has seven steps."
                              One named exception: the flow map schematic, where every figure is
                              repeated beside it at a larger size "so nothing is read there alone".
    scripts/check-type-scale  its own comment, line 7: "text-3xs (10px) is the floor;
                              the old 8px text-4xs step is retired."
    measured across ward CSS  389 uses below 12px — 300 of `3xs` in 33 files, 89 of `2xs` in 17

**So the gate exists and enforces the opposite floor.** A lane obeying its brief and a lane obeying
the linter are obeying different rules, **and only one of them is checked.** Task 1's new line
followed its file's convention and became the 390th — **correctly, by the only rule that is
enforced.**

🔴 **RULING (Ward Lead, interim): no NEW sub-12px HTML text in ward code.** A smaller size is a
stop-and-hand-back, not a token choice.

🔴 **The existing 389 are nobody's to tidy in passing.** One declaration makes it inconsistent with
the line above it; a file is a screen decision; sixteen screens is a programme decision about the
legibility of clinical screens, and it is queued for the owner with the figures. **389 silent
changes is a diff nobody can review.**

⚠️ **And a catcher here has to be a RATCHET** — pin today's count and fail when it rises — **not a
rule that reddens 389 times**, which would be switched off within the hour.

The original measurement on this screen, which stands:

    --text-3xs   0.625rem   = 10px    used 23 times in hub.module.css
    --text-2xs   0.6875rem  = 11px    used  3 times
    --text-xs    0.75rem    = 12px    the smallest legal size

`scripts/check-type-scale.mjs` passes on all of it. It forbids **arbitrary** Tailwind sizes
(`text-[13px]`) and steers every size onto a named token — and its own comment names `text-3xs`, at
10px, as the floor it is steering towards. **It is not silent about the floor; it disagrees about
where the floor is.** No ESLint rule carries a type-size minimum either: the five in `eslint-rules/`
are hex, button wiring, lucide icon aria, z-index ladder and hydration.

⚠️ **What made this hard to see, and worth remembering:** the gate was green, so the natural reading
was "unenforced". The gate was in fact enforcing a **different rule that happens to permit what the
brief forbids**, which looks identical from the outside — a green check is equally consistent with
"nobody is looking" and "somebody is looking for something else".

**Not repaired here, and deliberately so:** changing one declaration makes it inconsistent with the
line directly above it, and the screen-wide and programme-wide versions are Ward Lead's and the
owner's respectively.

### D5 · 🔴 Gender on the Patient screen is an ADDITION the drawing does not draw — logged, not slipped in

**Ruled: D-7, Ward Lead, 2026-09-11.** The Patient screen's identity panel renders `gender`. **The
drawing shows no gender field**, because the drawing **predates the owner's ruling** that split one
merged `sex/gender` fact into two.

⚠️ **THE DRAWING IS NOT WRONG. IT IS OLDER THAN THE RULING.** Ward Mockups may redraw it; that is
not a condition of building this.

**Why it is built:**

- A patient page showing `sex` while silently omitting `gender` **misrepresents the record** — the
  model holds two fields and the screen would show one.
- 🔴 **It is the field the owner ruled DECIDES THE BED.** A coordinator reading a patient page
  without it is missing the fact that governs where that person can go — **even though nothing
  consults it today** (see below).
- The earlier person-screen label fix explicitly left gender's display to this rebuild.

🔴 **AND IT IS LOGGED HERE BECAUSE §5.0(2) FORBIDS QUIETLY ADDING AS FIRMLY AS QUIETLY DROPPING.**

⚠️ **I argued the dropping half and did not check myself against the adding half.** Ward Lead raised
it. **The two halves of that rule are one sentence apart and it is easy to reach for whichever one
supports the change you already want** — which is exactly why the addition is recorded rather than
carried as though the drawing asked for it. **Josh can veto it knowing it was never drawn.**

⚠️ **Nothing on that screen may describe placement as gender-driven.** Measured: `genderEligibility`
has no production caller, `"gender"` is not in `ELIGIBILITY_GATES`, and placement runs on
`movement.sex` through `sex_designation` and `sex_mix`. **The ruling is modelled and not in force**,
and a screen saying otherwise would promise behaviour that does not exist.

### D6 · 🔴 The Documents tab carries NO COUNT — a departure from the drawing, logged as mine

**The drawing puts a count beside four of its five tabs.** `Documents` is built without one.

**Why:** 🔴 **a count of zero implies the system looked and found none.** There is nothing to count
and nothing to look in — the only "documents" in the model are five catchment policy papers, and
there is no patient-document capability for anybody. **The tab's body says so** (_"This prototype
holds no documents, for anyone."_), **but a tab label is read before its body**, so a `0` beside the
word would re-commit the exact defect that sentence exists to avoid, **in the one place the sentence
cannot reach.**

⚠️ **LOGGED BECAUSE §5.0(2) FORBIDS QUIETLY DROPPING AS FIRMLY AS QUIETLY ADDING** — and this is the
dropping half, on the same day §D5 was the adding half. **Both halves of one sentence, in one
screen's work, in opposite directions.** Recorded as **Ward Lead-endorsed and mine**, so Josh can
overturn it knowing the drawing shows a count there.

✅ **It is one departure and not a pattern**, which is the part that keeps it an exception:
**`Details` carries no count in the drawing either**, so the built tab strip has counts on neither
of the two tabs that have nothing countable behind them, and the drawing's other three counted tabs
are not built at all (§0.2). **Nothing about the drawing's counting convention is being redesigned.**

### D3 · The statistics link is a PLAN addition, not something the drawing draws

Recorded because §5.0 item 2 has two halves and this is the second one: every panel, action and
state the mockup draws is present, **or its absence is recorded as an owner question — never
silently dropped, never quietly added.**

**Measured in `search-hub-third-edition.html`:** `statistics` appears only as a **rail destination**
— an icon, a short name, a group of `records`, and a purpose line. **The drawing shows no per-item
statistics link anywhere**, on a row or in the detail pane. §4.11's _"plus a second link to each
item's statistics page"_ is the plan's own addition.

It was built because the plan asks for it and Task 2 was approved. **It is logged here so it appears
in the difference inventory rather than passing as something the drawing wanted.**

⚠️ **And it could not go where the plan said.** §4.11's catcher was _"a DOM test that every row has
both"_. **The result rows carry no links at all** — the row is click-handled and the only anchor on
the screen is in the `At a glance` detail pane. So the second link sits beside the first, which is
the only place an anchor exists. **A test written from the plan's prose would have asserted against
a table of rows this screen does not have.**

### D4 · A `grep -c` for the control counted the comment that explains the control

`grep -c 'type="search"' hub-screen.tsx` returns **2**. There is **one** search input; the other hit
is inside the block comment explaining why that input is a search input rather than a picker.

**Task 3's guard counts through the accessibility tree instead** (`getAllByRole("searchbox")`), and
it passed on the day it was written — which the plan predicted and told the builder to report rather
than invent a change around. Its value is future: the shell grows a search of its own in the bar,
and the route table is meant to suppress it here. **If that is ever missed, this screen quietly
acquires two searches and nothing else notices.**

### D2 · The `PreToolUse` hook also blocks `git restore` and `git checkout --`

Errata §F records that the hook false-positives on files whose prose discusses taking things away.
⚠️ **It also blocks the RESTORE leg of a mutation test**, which is worse than blocking a write: it
fires **after** the mutation is in place, leaving a deliberately broken file in the tree with the
obvious repair refused.

**Restore with the file-editing tool instead, then confirm with `git diff --quiet <path>` that the
restored file is byte-identical to the commit.** A restore that merely looks right is not a restore.
**Never reach for `CLAUDE_ALLOW_PROTECTED_DELETE=1` — that is for owner-approved deletions — and
never edit the hook.**

---

## E · 🔴 The Access record panel promises a trace the build does not keep — TASK 7 IS HELD

**Measured in `patient-search-third-edition.html`, 2026-09-11.** Two authored sentences, both
truthful to whoever wrote them, and **only one of them survives contact with data**:

    header note   ALWAYS visible, static markup inside the panel header
                  the header note at patient-search-third-edition.html:4932 — NOT quoted here,
                  see the warning below. It claims, unqualified, that every search is kept.

    empty state   visible ONLY while the list is empty
                  "Nothing searched yet this session. Every search run from the bar is recorded
                   here with the role that ran it and when, and none is sent anywhere."

**The empty state is careful — _this session_, _none is sent anywhere_. The header note is not, and
the header note is the one that survives.** The moment the panel holds a single row the empty state
is replaced, and **the only sentence a reader can see is the unqualified claim.**

🔴 **So the screen is at its most honest when it has nothing to be honest about**, and makes its
strongest unqualified claim exactly when it starts holding data. Nothing goes red: both sentences
were written truthfully by someone holding the whole panel in mind at once.

### Why this is a hand-back and not a wording tidy-up

**Task 7 records nothing.** Its design is session-only, held in component state, with a test
asserting `localStorage` and `sessionStorage` are never touched — **and that design is right**,
because a persisted record of who looked at whom is a privacy surface nobody authorised.

⚠️ **A NOTE ON HOW THIS SECTION IS WRITTEN.** The old header note is named by **locator**, never
quoted. **A document that quotes false text makes a later grep report that text as present** — the
search for _"is this still anywhere?"_ then finds the note explaining that it should not be, and
reads it as a live instance. That has bitten this project twice this week. ⚠️ **`D-4` on the line
quotes it in full for the same honest reason I first did, and will have the same effect; worth a
locator there too.**

⚠️ **An unqualified claim that every search is kept is not a UI label. On a clinical screen it is an accountability
claim** — to a clinician it says their lookups are logged; to a patient it is the assurance that
opening their record leaves a trace. **A screen that invites reliance on a trace that does not exist
is worse than one that says nothing.**

**This is not routed as a mockup defect the way the three bespoke refusal sentences were. Those were
a wording mismatch. This is a false assurance about patient-record access, and it goes to the
owner** — not fixed quietly by a builder, including by the recommendation below.

**RULED AND BUILT — `D-4`, Ward Lead, 2026-09-11:**

    empty state   the drawing's own sentence, kept as it is — it says more than the header can
    header note   "Who looked, and when. Kept for this session only, and none is sent anywhere."

Both of the drawing's real facts, none of the claim the build cannot keep, **true read alone whether
or not the panel has rows.**

🔴 **D-4 is WARD LEAD'S ruling, not the owner's**, made under his standing instruction of
2026-09-10 rather than holding the lane, and **recorded as his to overturn.** ⚠️ **The owner was
asked directly whether this wording was acceptable to him as the clinician and has not answered.**
Build it, and keep that unanswered question visible rather than letting the ruling close it.

⚠️ **Build the RULED sentence, never the drawn one.** Ward Mockups is correcting five drawings in
parallel; if the old note is still in a drawing, **the drawing is behind, not the build.** D-4 lists
all five locators — all in `docs/`, **none in `src/`**, which is what makes this a falsehood a lane
was about to build FROM rather than one shipping to a clinician today.

### The general shape, which is the reusable half

**For any qualifying clause — _this session_, _not yet_, _in this prototype_, _none is sent
anywhere_ — ask which STATE it renders in, then ask whether the claim it qualifies is visible in the
other states.** A qualifier only does its job if it appears wherever the claim does.

### And how it was found

**The Lane C plan had been quoting the master plan's PROSE for panel copy, not the drawings.**
Re-deriving panel _names_ (§A2) caught several paraphrases; this was the first time the drift
reached a **sentence**, and it was the sentence that mattered most on the screen — the plan's Task 7
quotes a third wording again, _"Kept for this session only, not a record of anything real"_, which
appears nowhere in the drawing.

🔴 **Prose describing a drawing is not the drawing.** Every quoted string in Tasks 9, 11, 12 and 13
is re-derived against its drawing before that task is dispatched.
