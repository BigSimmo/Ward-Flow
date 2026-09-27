# Every piece of text the ward module renders below 12px — measured in a browser, 2026-09-11

**Written by the design-review chat at Ward Lead's request, for the owner to rule on.** Ward Lead saw
five things at 10px and 11px on the ward screen and asked three questions: what the standard says
about a minimum size and an uppercase floor specifically; every rendered size below 12px across the
whole module, enumerated not confirmed; and whether anything is below 10px. Then one recommendation in
plain words. Nobody changes a size until the owner rules.

**How it was measured.** Playwright's Chromium, viewport 1600 × 1200, light theme, against the dev
server serving this worktree at `528bb60708` (the ward master line at `1c45f97c42` plus this branch's
documents; no source differs) [M 528bb60708]. For every element with its own text, `getComputedStyle`
gave the rendered `font-size` — not the declared one, so `rem` under an ancestor scale, `clamp()` and
the v2 tokens over globals are all already resolved. Elements at `display:none` or `visibility:hidden`
were skipped; screen-reader-only text (clipped to a rectangle of nothing) and zero-size text inside a
collapsed section were counted but set aside as _invisible_. Thirty-one distinct screens were read by
following every internal link from the ward home: the sixteen mockup screens' routes, one instance of
each dynamic route (ward, board, ED, movement, patient, community team, service statistics, community
statistics), and the search screen with and without a query. Six more routes (`constellation`,
`escalation`, `exceptions`, `queue`, `morning`, `transport`) redirect to screens already counted. Raw output, the script that produced it, and its limits: `type-floor-record-2026-09-11-528bb60708/` beside this file — a dated record of one tree, never a baseline (committed 2026-09-12 at the owner's word).

⚠️ **A rendered size is a claim about the tree it was rendered from.** These numbers are true at
`528bb60708`; the D-3 ratchet, not this document, is what tracks them afterwards.

---

## 1 · What the standard says — quoted

The standard (`docs/ward-flow/mockups/WARD-FLOW-DESIGN-SYSTEM.md`) says it four times, and it names
uppercase directly:

- §2 principle 4: _"Nothing is set below 12px, and the scale has seven steps. The flow map is the one
  exception: it is a schematic drawn to scale whose boxes are laid out to 10.5 and 11.5px text, and
  every name and figure on it is repeated in the candidate list beside it at 13.5px, so nothing is read
  there alone."_
- §4 type scale, row `--t-0`: _"12px — Uppercase labels, tags, counts, chips, legend items, tier pills,
  the eyebrow in the rail. **The floor: nothing is set smaller.**"_
- §4: _"Uppercase only at t-0 and t-1, always tracked"_; §8: _"Sentence case everywhere. Uppercase only
  as a tracked label at t-0 or t-1."_
- §9 accessibility floor: _"Nothing below 12px in HTML, and nothing on the map below 10.5px."_ and the
  definition of done repeats it.

**So there is no uppercase exception. The standard's answer to "an uppercase eyebrow at 10px" is that
the eyebrow's size is t-0, which is 12px, and uppercase is a treatment applied at t-0 or t-1, never a
licence to go smaller.** That is a permissive rule about uppercase and a hard rule about size, and
both are decisions somebody made, not absences.

And the owner has already ruled on the app: **D-3 (2026-09-10) adopts the 12px floor** — new ward code
never below 12px; the existing uses raised _screen by screen as each of the sixteen is rebuilt_, not
as a sweep; the invented-figures notice raised on every screen now, ahead of its turn; the flow map's
10.5/11.5px unchanged; a ratchet so the count may fall and never rise [R owner D-3]. **What Ward Lead
saw on the ward screen is therefore not a breach of a rule; it is the pre-rebuild state the ruling
already describes, measured for the first time.** What this document adds is the population, so the
owner can see what the ruling covers and decide whether any of it should jump the queue the way the
notice did.

## 2 · The enumeration

**Only two sizes exist below 12px: exactly 10px and exactly 11px. Nothing is at 10.5 or 11.5 in HTML,
and nothing anywhere is below 10px** [M 528bb60708]. The flow map's SVG text did not appear because
the coordinator's diagram is HTML on this tree; no SVG text below 12px was found on any screen.

| Size     | Visible groups (one per element class per screen) | Visible elements | Of which uppercase groups | Screens touched |
| -------- | ------------------------------------------------- | ---------------- | ------------------------- | --------------- |
| **10px** | 174                                               | 1,873            | 47                        | 31 of 31        |
| **11px** | 61                                                | 1,118            | 9                         | 31 of 31        |

Plus 25 groups that render at 10 or 11px but are invisible: screen-reader-only text, and text inside
collapsed panels (the Command screen's register tabs and the closed exceptions list, for instance).
They are in the raw output and left out of the reasoning below, because nobody reads them with eyes.

Two things reach every one of the 31 screens: the **keyboard hints** in the search bar (`/`, `Ctrl K`,
`Esc`) at 10px, and the search **guidance sentence** at 11px. Both are the shared header, so they are
one fix, not thirty-one.

### 2.1 What the 10px text is, sorted by what it carries

**A. State a coordinator has to act on — the words that _are_ the decision.** This is the part that
matters clinically, and it is larger than the five items Ward Lead saw:

- **Delays**, the screen read at pace: for each of 43 waiting people, the **reason they are waiting**
  (_"No suitable bed anywhere in the network"_, _"Awaiting a ward's answer"_), their **profile** (_"Adult
  · Needs a locked bed · Tier 1"_), **how long since anything was recorded** (_"nothing recorded for 10h
  56m"_) and **the wait itself** (_"7h 00m"_) — all four columns at 10px, 43 rows each.
- **Command**: each queued person's **tier** (_"Tier 1 · most urgent"_) and **operational score**, 43
  each; the pressure strip's _"8 waiting · longest 2d 14h"_; the exceptions' detail (_"WF-004 · 10m
  overdue"_) and owner; the flow diagram's **bed chips** (_"Ready 2"_, _"Held 3"_, _"Blocked 0"_), 138 of
  them, and each unit's capability line.
- **Network**: 130 bed-count chips, 49 elapsed-wait labels (_"1h 35m waiting"_), 98 queue metadata
  lines, 45 tier numbers, 23 bed times.
- **Emergency department**: the referral state (_"Accepted."_, _"Destination review"_), the tier label,
  the outstanding items (_"Form 3B (Continuation of detention)"_), and the uppercase outstanding
  headings (_"Medically cleared"_, _"Waiting to move"_).
- **Ward and board**: bed chips (_"Ready 1"_), expected times (_"Expected 22:58"_), the transport
  officer's job lines (_"Accepted · 5h 30m waiting"_) and their four action buttons.
- **Statistics**: two whole comparison tables — 101 cells and 39 headers — at 10px.

**B. Headings and eyebrows, uppercase, tracked** — the device Ward Lead named: the ward screen's panel
headings (_"This ward"_, _"Ward figures, right now"_), the ED's section headings (which also carry
counts: _"Expects · 0 patients"_), the statistics sub-headings and eyebrows, the board's triage labels
(_"Ready"_, _"Confirmed today"_), the Command diagram's service headings, the Delays group names
(_"Yours"_, _"Wards"_, _"Transport"_), the community index's family labels. Forty-seven groups in all.
Nine more uppercase groups sit at 11px (the fact labels _"Legal status"_, _"Form"_; the referral
summary terms; the ED site codes).

**C. Explanatory prose at 10px** — whole paragraphs, not labels: the statistics notes (22 paragraphs
across six screens), chart captions, figure notes, footnotes, the community team's four footnotes, and
**a paragraph that appears on 23 of 31 screens beginning _"Every waiting patient, refusal and…"_ with a
bold _"not real figures"_ beside it.** That paragraph is each screen's own governance banner — the invented-figures notice, worded per screen (`delays/delays-screen.tsx:256`: _"Every waiting patient, refusal and escalation on this screen is invented…"_; `capacity/capacity-screen.tsx` likewise), rendered at 10px [M 528bb60708]. D-3 ordered `.syntheticNotice` raised on every screen ahead of its turn; on these screens the same sentence lives under the class `governanceBanner`, and it is still at 10px. **Whether D-3's "now" reaches a banner by another name is Ward Lead's to say; the measurement says the sentence the owner most insisted on is the smallest text on 23 of 31 screens tonight.**

**D. Chrome**: the keyboard hints on every screen; the community index's A–Z rail buttons; the
prototype badge (_"Synthetic prototype"_, uppercase) on every statistics, search and referrals screen.

### 2.2 What the 11px text is

Mostly metadata and secondary lines: the freshness stamp (_"Confirmed 21:53 · NUM RPH Adult Secure"_),
the bar's key items (_"Under 8 hours"_) and counts, the record rows' 323 separator dots and 58 _"in
journey"_ sub-clocks, the bed map's ward count lines (_"2 ready · 3 held · none blocked · 19
occupied"_), the referral form's summary terms, the movement workspace's fact labels and timeline
times, the board's legend and flow-row lines (_"Bed given away 6 hours ago"_, _"Held up by: …"_), and
the Delays footnote that explains what the coloured edge means. Some of it is read to act — the bed
map counts, the flow-row lines — but less of it than at 10px.

## 3 · Is anything below 10px?

**No.** The lowest rendered size on any of the 31 screens is exactly 10px [M 528bb60708]. The floor
nobody had tested holds where it was assumed.

## 4 · For the owner — the question in plain words, and one recommendation

**The question.** A bed coordinator glancing at the Delays screen has to read _why_ each of 43 people
is waiting, _how long_, and _how urgent_ — and every one of those words is set at 10 pixels, about the
height of the small print on a medicine box. The same is true of the tier and score on the Command
queue, the bed counts on the flow diagram and network, and the referral state on the ED screen. The
uppercase panel headings Ward Lead saw are at the same size, and so is the sentence on 23 screens
telling the reader the figures are invented. Nothing is smaller than 10 pixels. The standard says the
smallest size is 12 pixels with no exception for capitals, and you adopted that for the app yesterday,
to be applied screen by screen as each is rebuilt.

**Recommendation: keep the 12-pixel floor with no exception for uppercase headings, and pull one thing
forward ahead of the rebuilds — the four Delays columns and the Command queue's tier and score, the
words that carry the decision on the two screens read at pace.** Everything else — headings, eyebrows,
notes, keyboard hints, tables — waits for its screen's rebuild exactly as D-3 says, because raising it
early re-lays out screens nobody is checking. Capitals at 10 pixels are the hardest case, not the
easiest: uppercase removes the word shapes a fast reader relies on, and the sixteen mockups already
prove every heading fits at 12 pixels, so the exception would buy nothing. The 23-screen invented-figures
sentence is already covered by your ruling and simply has not been done yet.

**What this costs if wrong.** Pulling the Delays and Command text forward means one layout check on two
screens before their rebuild, which lane A owns. Leaving it means a coordinator reads the reasons and
waits at 10 pixels until those two screens are rebuilt.

**Nothing changes until you say.** Ward Lead has told the lane that found it to inherit the 10px
deliberately rather than be the one odd panel.

_Tags as in the master plan's second edition: [M sha] measured here, [R] ruling, [U] unverified with the
command that settles it._
