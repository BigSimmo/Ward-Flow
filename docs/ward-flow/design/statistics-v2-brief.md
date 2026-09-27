# Statistics screens, second pass — the shared brief

**Owner request, 2026-09-06:** redesign and overhaul the statistics prototypes; keep the sleek,
sophisticated, clean style; improve layout, structure and UX; make them functional and useful based
on what a coordinator and a health service actually need to know; give each an aesthetic centrepiece
graph. **Five screens**, one per audience.

This file is the brief every screen is built from. It exists so five builders make five screens of
**one** product rather than five products.

---

## The five screens, and who each is for

| #   | File                                 | Audience                         | The one question it answers                                       |
| --- | ------------------------------------ | -------------------------------- | ----------------------------------------------------------------- |
| 1   | `mockup-statistics-overview-v2.html` | State bed coordinator, exec      | Where is the system stuck right now, and who has waited longest?  |
| 2   | `mockup-statistics-service-v1.html`  | Health service exec (EMHS shown) | Is my service carrying its own demand, or exporting it?           |
| 3   | `mockup-statistics-cmht-v2.html`     | Community team lead              | Can we take more, and who is waiting on us?                       |
| 4   | `mockup-statistics-ward-v2.html`     | Ward manager, bed coordinator    | What can I offer today, and what is stopping a bed being offered? |
| 5   | `mockup-statistics-ed-v2.html`       | ED lead, exec                    | Who is still in my department, and how long have they been there? |

**Screens 1 and 2 are new work. 3, 4 and 5 replace `-v1` files that stay on disk** — the v1s are the
starting point, not the ceiling; read yours before designing.

---

## ⚠️ The one mechanical rule, and it is checked

**`tests/ward-design-language-canonical.test.ts` requires every mockup's `<style>` block to BEGIN
with the canonical block from `design-language.html`, byte for byte.**

- Copy the content between `<style>` and `</style>` in
  `docs/ward-flow/design/prototypes/design-language.html` as the **first** thing in your style block.
- Append your screen's own rules **below** it, under a clear marker comment. Never above: a rule
  above the copy is overridden by it and reads as dead code.
- **Never edit `design-language.html`.** If the language is missing something you need, say so and
  hand it back — do not patch the copy.
- **Never edit the test file.** Registering the new files in `CARRIERS` is done once, centrally,
  after all five exist. Five builders editing one list is five conflicts.

Prove it: `npx vitest run tests/ward-design-language-canonical.test.ts` — it names the exact
character where a copy diverges.

---

## The design language, in the terms it states about itself

These are the language's own rules. They are clinical, not cosmetic.

1. **State is a WORD first.** Colour only ever reinforces a word already on screen. A tile whose
   tone is the only thing distinguishing it from its neighbour is a defect.
2. **Absence is stated, never blank.** "No ward has confirmed a count" is a fact; an empty cell is
   the page failing to say anything.
3. **Figures are JetBrains Mono, tabular.** Anything a reader compares down a column lines up and
   right-aligns.
4. **Every invented figure is listed at the foot of the page.** These are synthetic prototypes and
   must say so.
5. **Contrast floor 4.5:1**, and design tokens only — no raw hex in your appended rules.
6. **No cream.** Surfaces are `--surface`; state is carried by an edge, a word and a colour, never
   by tinting a large surface.
7. `@media print` and `@media (forced-colors: active)` are **already handled by the canonical
   block**. Do not re-implement them; do make sure anything you add survives them — if colour is
   your only carrier, it will not.

### Vocabulary that is ruled, not chosen

- **"Ready"** is the one word for `min(allocatable, empty)` — the beds you can actually put somebody
  in (owner ruling R-B-09). ⚠️ **The v1 overview and ward screens say "Available now" and
  "Available", which that ruling retired.** Do not carry those forward. Also banned for that figure:
  "you can fill today", "no bed free".
- **"Discharged"**, not "released", for the third bed stage.
- A bed **on leave** is information, never availability (ruling R11).
- ⚠️ **`allocatable` alone is a different number from "Ready"** and takes different words.

  🔴 **THE WORD ORDER IS THE WHOLE DISTINCTION, AND THE FIRST DISPATCH OF THIS BRIEF GOT IT WRONG.**
  **"no bed free"** is BANNED — it names `min(allocatable, empty)` stated as an absence. **"no free
  bed"** is LEGAL — it names the raw `allocatable` gate, and `ward-eligibility.ts` already uses it;
  `tests/ward-capacity-figure-one-word.test.ts` names that near-miss as deliberate in its own comment.

  **A decline reason meaning "this ward had no bed" is the allocatable gate, so it reads "No free
  bed".** Two of the five screens shipped the banned order because the instruction they were given
  used it — my error, not theirs. One of those files states the distinction correctly in its own
  footnote and then contradicts it in its labels. **Understanding stated in prose does not survive
  into implementation on its own: check the rendered strings, not the explanation.**

### Two standing owner rulings that shape every one of these screens

- **R17 — the board is a convenience, not a source of truth.** A placement action must prompt to
  confirm with the ward. **Every screen must carry this**: a statistics page that reads as
  authoritative invites a decision made without the phone call. Say it once, plainly, near the top.
  It bounds the CLAIM, not the care — it does not license treating a figure as unimportant.
- **R16 — the eligibility figures get the strongest protection: sex mix, one-to-one nursing
  capacity, age band.** _A wrong bed count wastes a phone call; a wrong sex-mix figure puts someone
  in an unsafe place._ Where your screen shows any of these, it fails conservatively: stale or
  unconfirmed reads as unknown, never as a number.

---

## The domain, so nobody invents a model

The network: **23 units across 15 hospitals** — 16 Adult, 6 Older adult, 1 Youth. Four health
services: **EMHS** (East Metro), **SMHS** (South Metro), **NMHS** (North Metro), **WACHS** (country).

**The seven stages a movement passes through**, in order: `placement requested` → `destination
review` → `accepted, awaiting bed` → `bed pulled` → `handover ready` → `moving` → `arrived`.

**Bed figures:** `allocatable` (what the ward says it can staff), `empty` (physically free),
**Ready** = the smaller of the two, `held`, `blocked`, `on leave`.

**Why a ward says no** — the eligibility gates, in the order they are checked: authorisation,
cohort, security, sex designation, forensic, sex mix, specialling, prior decline, capacity
freshness, allocatable bed. ⚠️ **A "no" for want of a bed and a "no" because the patient does not
match are different answers and must never be summed into one figure** — the first may change this
afternoon; the second will not.

**Bed releases:** `expected` → `confirmed` → `discharged`, each carrying **one** thing it is waiting
on, defined as _the one that will take longest_ (owner ruling R7 — say so). The list, extended by the
owner on 2026-09-06: awaiting ward round · awaiting family or carer agreement · awaiting
accommodation · awaiting community team acceptance · **awaiting legal or Mental Health Act process**
· **awaiting transport** · nothing outstanding.

**Transport:** the SENDING team books it, never the receiving ward (TR-D1), and cannot book until the
ward has pulled a bed (TR-D4).

---

## What a good screen does that the v1s do not

- **Leads with the number that can take a patient today**, and shows empty separately (ruling R9).
- **Separates "nothing free" from "nothing suitable".** The single most useful distinction on any of
  these pages, and the one the v1s collapse.
- **Names the longest wait as a person's wait**, not as a distribution statistic. A median hides the
  one that matters.
- **Gives one centrepiece chart**, not five small ones competing. Inline SVG, `role="img"` with a
  real label, **and a written caption stating the same numbers in words** — so the reading survives
  a greyscale printout and a reader with no colour perception.
- **States its own staleness.** When was each figure last confirmed, and by whom.

---

## Deliverable

One HTML file. Self-contained. No build step, no external assets, no scripts required to read it.
Open it in a browser and it is the screen.

**If you reach a decision this brief does not cover, stop and hand it back** rather than choosing.
