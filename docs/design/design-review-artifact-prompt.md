# Prompt: design review as a full-page artifact

_Standing rule for every Ward Flow design task (Josh, 9 Nov 2026, [D-107](../ward-flow/decisions.md#d-107-working-rules-and-documentation-from-the-9-november-2026-audit-9-november-2026)). Copied verbatim from the project prompt; [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md) holds the design rules it cites._
_Ward Flow notes. Where the prompt below and a recorded decision differ, the decision wins:_

- _**E.4:** the one allowed split is the held clinical PR in [fewest PRs](../agents/git-publication.md#fewest-prs). Non-clinical work stays in the thread's one PR, not a second one._
- _**A.6 and A.8:** building a clear change locally first is allowed. Nothing is built from a drawn mock-up until Josh approves that mock-up (D-74 standing rule), and signature parts still need an approved mock-up first ([DESIGN-SYSTEM.md §8](DESIGN-SYSTEM.md))._
- _**Part C, shared screens:** D-83 keeps full names on every screen, copy and TV, with no initials-only mode. Offer other privacy aids, such as the D-102 screenshot blur, not initials._
- _**A.9 and screenshots:** every name and detail is synthetic, never a real person's ([AGENTS.md](../../AGENTS.md) hard rule 1)._

**Standing rule (9 Nov 2026):** every Ward Flow design task follows this prompt, whether or not it is pasted in. It covers any kind of design work: quick fixes, polish passes, redesigns, new pages or features, whole flows (for example "admit a patient"), pop-ups and panels, tables and charts, and printed, TV or shared-screen layouts. You can still paste it into a new thread with what you want designed.

---

Design **[what: the screen, note, feature or flow]** in Ward Flow and show me the result as one full-page review artifact before anything is published. The standard is "a screenshot of a finished, premium clinical app", not a sketch. It should be beautiful, polished, intuitive and low-friction. Follow parts A to E, scaled to the task: a one-line fix needs a short page, a redesign needs the full structure. Where something doesn't apply, skip it.

## A. How to work

**Ground it in the real app**

1. Open the real page or flow first: read its source, run the app locally with synthetic data, and take "before" screenshots at desktop (1280 px) and phone (400 px) width, plus any pop-up, sheet or panel involved, opened. For a brand-new page, screenshot the closest existing screens as the reference instead. Design from what is there, not from memory. (In a cloud container, follow the project memory note on local preview if Node 24 is missing.)
2. Read `docs/design/DESIGN-SYSTEM.md` (principles, tokens, layout patterns, the variation zone and the section 9 checklist), the kit in `src/components/wf/` and the token files in `src/app/`. Reuse kit parts and patterns from screens I've already approved before inventing anything.
3. Work out who uses it, on what device, and the one or two jobs they come to do. Walk through those jobs in the current app and count the steps, taps and page changes. That count is the baseline to beat.
4. If I've sent a note or PDF, number your items to match my numbered issues. Fix small, clear items (alignment, spacing, wording) straight away in code and show real before and after screenshots. Only bigger changes need a mock-up.

**Choose the approach**

5. Pick the one that fits, and say which in the artifact's header:
   - **Quick fix** (alignment, spacing, wording): fix it in code and show before and after screenshots. No mock-up.
   - **Polish pass** ("polish", "perfect", "review for improvements"): go through the screen in the running app against parts C and D, list the improvements, and build them.
   - **Redesign or new feature, direction clear:** build it in the real app (steps 6 to 7).
   - **Direction open:** show two or three genuinely different options side by side at the same fidelity, each with its trade-offs and one recommendation. Build the chosen one.
   - **Flow:** show each step in order, with the tap count before and after.
   - **Print, TV or shared screen:** use the real output frame (an A4 page at print scale, a 1920 × 1080 TV) instead of the phone frame, at the distance it will be read from.

**Build, don't draw (preferred)**

6. If the change is clear enough, build it in the real components on a local branch. Commit locally only: no push, PR or live service yet. Run the type check and related tests.
7. Screenshot the built screen as the "after" at desktop and phone width, light and dark. Wait for the page to finish loading, hide developer overlays, use 2x resolution, and keep before and after at the same scale and crop.
8. Only when the design is still open, or building first would waste a lot of effort, draw a mock-up. Never hand-write look-alike styling: start from the real page's rendered HTML and CSS (or the kit's classes and tokens) and change only what the design changes. Make it live and clickable (switches, expanding rows, Save), so I can try the flow.
9. Fill screens with realistic synthetic content: a full list, long names and labels, a few urgent items, one empty section, one "Not recorded" field, wrapping text. Show the states the change touches (empty, loading, error, selected, focus, done).

**Look before you send**

10. Render the artifact in a browser at 1440 px and 390 px, light and dark. Put each after next to the real app screenshot and check they match: fonts, sizes, colours, radii, spacing, icon weight. Fix anything clipped, overlapping, misaligned or scrolling sideways.
11. Critique it honestly as a senior product designer against parts C and D: name the three weakest parts of each screen, fix them, and check again. Run the polish checklist in D. Never publish a design you haven't looked at rendered.

## B. The artifact's structure

Publish one plain full-page HTML artifact that opens straight to the content and scrolls top to bottom. No board, canvas or Design-type artifact. Keep one link for the whole task and update it in place. The page itself must look as polished as the design: Ward Flow's fonts (Geist, Geist Mono for figures) and tokens, calm spacing, content up to about 1200 px wide, and a light/dark switch.

Lay it out in this order:

1. **Header.** Title (what's being designed, plus "Note N" if there is one), one line on what this review covers, the date, version ("v2, updated 14:20") and "Synthetic data only".
2. **Your decision.** A short box that says exactly what I'm being asked to approve and your recommendation, matching the decision card.
3. **Contents strip.** Numbered to match my note (or by area if there's no note), sticky as I scroll. Each item has a status tag, such as "Built, awaiting your yes", "Mock-up below", "Fixed", "No clinical change", "Your ruling applied" or "Clinical content: needs your sign-off".
4. **Legend.** One line: dashed outline = new, with small labels such as "New" or "Replaces X".
5. **One section per item, always in the same order:**
   - Number, title and status tag.
   - **The problem or goal:** one sentence in my words.
   - **What changes:** three to five bullets, including what was removed or merged.
   - **Effort saved:** steps or taps before and after for the main job ("4 taps → 1"), where it applies.
   - **Desktop:** before and after side by side at the same width, captioned "Before (live app today)" and "After (built)" or "After (mock-up)". For a new page, "before" is the closest current screen. They stack on a narrow screen, and tapping an image shows it full size. I review on an iPhone, so desktop views must be fixed-width images or frames that scale down as a whole picture, never reflowing into jumbled text.
   - **Close-up:** for small changes (alignment, spacing, a tag), a zoomed crop of before and after so the difference is obvious.
   - **Phone:** after in a 390 px phone frame, with before beside it where useful. For print, TV or shared screens, use that output's frame instead.
   - **Try it:** the live clickable mock-up, when there is one. For a flow, show the steps in order.
   - **Options:** when the direction is open, the two or three options side by side, labelled A, B and C, with the recommended one marked.
   - **Proposal card,** for new features only: what it does, why clinicians would want it, the evidence (a real guideline or study, named), the effort (small, medium or large), and whether it changes clinical logic.
6. **Check before clinical use / Privacy and records,** where relevant: phone numbers, service lists, thresholds, answer lists and evidence quoted from memory.
7. **What I checked.** What was verified (tests, browser check at which widths and themes) and what wasn't (GitHub's run, the live site).
8. **Revision log.** One line per version saying what changed, so I can see progress on the same link.

Embed images as compressed WebP or optimised PNG, lazy-loaded, keeping the page to a few MB.

## C. Make it easy to use (UX)

**Reduce friction**

- Make the most common job the shortest path: aim for one or two taps, and count them before and after.
- Act in place. Let people do the job where they see it (a row button, an inline choice), without jumping pages or losing their place. After an action, show the result right there and move them to the next sensible item.
- Group repeated work into one action ("Chase all", "Mark all reviewed").
- Prefer Undo to "Are you sure?" for anything reversible. Confirm only what can't be undone.
- Remember view choices such as filters, tabs and sort order, but never typed text, and never pre-select anything clinical.
- Don't ask for what the app already knows. Fill it from the record and let people change it.

**Make it intuitive**

- Each screen answers one question within five seconds. The main action is obvious, and there is only one main action.
- Recognition over recall: choices from lists, words beside icons, the current tab and filter always visible, counts on tabs.
- The same thing looks and works the same everywhere. Reuse an existing pattern before inventing a new one.
- Show only what's needed now, with detail one tap away (Show more, a tab, a side panel). Order content by urgency, then time.
- Use the user's own words: one to three word labels, buttons that say what they do ("Save callback", not "Submit").

**Prevent and recover from errors**

- When something can't be done yet, say why on the spot ("Save needs a callback time") instead of failing after the tap.
- Check fields as people fill them. Error messages say what happened and how to fix it, in plain words.
- Never lose work: keep drafts within the app's privacy rules and warn before leaving with unsaved changes.

**Feedback and trust**

- Every press responds within 100 ms. Saving shows "Saving…" then "Saved 14:02". Changes confirm with a short toast that offers Undo.
- Loading keeps the layout still (placeholders shaped like the content, not spinners or jumps).
- Values show how old they are, and counts agree everywhere.
- Empty states give one plain sentence and the next useful action.

**Work for real conditions**

- People use it in a hurry, interrupted, on phones and shared screens. Make it scannable at a glance, with key facts aligned and in the same place every time.
- On desktop, keyboard paths and shortcuts help power users ("/" to search, Escape to close).
- On shared screens, keep full names (D-83, D-113) and offer other privacy aids, such as the D-102 screenshot blur. Never offer initials only.

## D. Make it beautiful (visual design and polish)

**Overall feel**

- Refined, calm and modern: the quality of the dark header area and the rebuilt Settings header. Restraint over decoration.
- Avoid the cartoonish and dated: emoji or clip-art icons, rainbow chips, thick borders, heavy shadows, pastel blobs, gradients, and rings, gauges, sparklines or tile grids added for show.
- Simplify before adding. Each element must earn its place. If I say "push it further" or "perfect it", make it sharper, simpler and more useful, not busier.

**Hierarchy and layout**

- Build hierarchy with type size, weight and spacing, not with boxes and colour. Avoid boxes inside boxes.
- Calm and dense: 4 px rhythm, compact type scale, flush columns, no empty rails. Cut wasted height: blocky tiles and oversized cards are my commonest complaint.
- Restructure, don't restyle: each fact lives in one right place. Don't repeat the same people or counts in two sections.
- Group related things by spacing (close together means related) and keep line lengths readable.
- 12-column grid with 16 px gutters, main and side column at 2:1 or 3:1, and sections 24 px apart. Side-by-side cards are flush and level.
- At most one signature visual per page, honest and to scale (bed squares, a stage rail, a heat map).

**Colour and depth**

- Colour means state. Red means act now and nothing else. Words stay neutral ink, with one action blue.
- Show tone in small tags and glyphs, never coloured side edges.
- One elevation per role. Cards that aren't separate objects get no shadow. Frosted glass is for bars and pop-ups, never on data.

**Type, numbers and tables**

- Use the type scale only (12 to 28 px, 12 px floor). Figures, times and counts use Geist Mono with tabular digits.
- Right-align numbers in tables and line up action buttons on the right edge of a column.
- Keep empty cells consistent: "None", "Too few" or "Not recorded", never a mix of dashes and words.
- Use small worded tags ("Form 4A needed") instead of cryptic symbols or hollow circles.
- Long names wrap in full and never lose the first name. Other long text gets two lines and an ellipsis.

**Controls and panels**

- One filled button per panel, with actions pinned at the foot.
- Slim segmented controls (30 px desktop, 40 px phone items on a 48 px track).
- Pop-ups and side panels: the name, a small status tag and one quiet context line, then three to five label-and-value facts per titled group.
- Use kit chips and pickers, not browser dropdowns. Forms open blank.

**Phone**

- Design the phone layout properly, don't squash the desktop one. It may simplify to a list or strip, with the main action in thumb reach.
- Buttons are drawn at 40 px with a 48 px tap area (only Accept, Pull and Decline are a full 48 px).
- Keep dark headers compact: no big initials avatar, a small name, compact fact cells and a slim step tracker.

**Polish checklist (run it before sending)**

- Edges, text baselines and icons line up. Padding is equal on all sides of like items, and icons sit optically centred.
- Radii, borders and spacing are consistent across the screen.
- Every control has hover, pressed, focus and disabled states. Transitions are short (100 to 220 ms) and switch off under reduced motion.
- Words are consistent: the same term for the same thing, correct plurals ("1 bed"), and one time and date format.
- No orphaned words, awkward wraps, ragged columns or stray scrollbars.
- Contrast of at least 4.5:1 in light and dark, a visible focus ring, and layouts that survive 200% text.
- Missing data says "Not recorded" and is never invented. Synthetic people only.

## E. Then ask, once, and follow through

1. Post one short message with the link and one decision card with two to four options and one recommendation, such as "Yes, push and open the PR", "Build all", "Non-clinical only" or "Change first". Keep working on the recommended option while you wait, unless a step can't be undone.
2. If I say it looks poor, blocky or simple, don't just add more: go back to parts C and D and steps A10 to A11, rebuild from the real app, and update the same page with a revision log line.
3. A change to what the patient record holds needs my explicit ruling. Ask with a decision card and say which earlier ruling it replaces.
4. Put clinical changes in their own pull request, held for my review of the wording. Non-clinical changes go in a separate PR.
5. After building, check the final screen against the review page at desktop and phone width. Tell me what you verified and what you didn't.

---

_8 Nov 2026: combined the Triage and RAMP thread's `mockup-artifact-prompt.md` (now superseded) with the Note 3 approach of building in the real app and screenshotting it._

_9 Nov 2026: added the Note 4 (Home) lessons (tokens, small fixes first, clickable mock-ups, side-by-side desktop plus phone frames, labelled outlines, browser check)._

_9 Nov 2026: reorganised into parts, with a fixed artifact structure and design principles drawn from DESIGN-SYSTEM.md and feedback across the Home, Waiting, Settings, Tables, Triage, Add patient and patient page threads. Main lessons: the Home board looked poor because it was hand-written with invented colours and never viewed; the Waiting tiles were "blocky, taking up excessive space"; desktop views reflowed on iPhone; the designs that worked were built in the real app and checked._

_9 Nov 2026 (later): made it general for any design task (notes, single screens, new pages, flows, panels, print and TV). Added part C on ease of use (fewer taps, act in place, undo, clear errors, feedback, real conditions), a polish checklist, and an "effort saved" line per item._

_9 Nov 2026 (final): made the standing rule for every Ward Flow design task. Added "Choose the approach" (quick fix, polish pass, redesign, open direction with two or three options, flow, print/TV) and scaling the page to the task._
