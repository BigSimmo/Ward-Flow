# Brief: build or perfect one Ward Flow third-edition mockup

Give this to one agent per page. It is the brief that moved sixteen pages onto the third edition on 9
and 10 September 2026, generalised. The lead fills in the page name, the file and the page notes.

## Where things are

- Repository root (run every command from here): the worktree root.
- Your page: `docs/ward-flow/mockups/<page>-third-edition.html`.
- The standard: `docs/ward-flow/mockups/WARD-FLOW-DESIGN-SYSTEM.md` (the markdown is the source of truth;
  `design-system-third-edition.html` mirrors it as a page; `ward-flow-digest.html` is the reader's brief).
- The reference build: `docs/ward-flow/mockups/command-third-edition.html` (Command). Its stylesheet, shell
  markup and shell script are THE source for every shared thing. Copy from it; never re-derive.
- The harness: this folder (`check.mjs`, `check-shell.mjs`, `shots.mjs`, `run-all-checks.sh`,
  `shell-sweep.mjs`; fonts stubbed from `fonts/`; the scripts fall back to Playwright's own Chromium).
- Your scratch folder for anything temporary: the session scratchpad, never the repository.

## Read first, in this order

1. The standard, whole. In particular: section 2 (the ten rules), 5.6 (the shell), 6 (components),
   7 (behaviour), 8 (wording and honesty about data), 9 (accessibility floor), 10 (definition of done),
   11 (applying it to a new mockup, and its Never list), 13 "Decisions taken", and your screen's entry in
   14 if it has one.
2. Command, whole: how the rail, the one-row bar, the three drawers, the live region, the reconciliation
   line, the panels and the rows are built and behave.
3. Your own page, whole (or, for a new page, the owner's drawing or brief for it).

## Do, in this order

1. **The shell.** Your page's rail, one-row bar, three drawers, skip link, live region and
   reconciliation line are Command's markup and shell script, with only the page's own parts changed:
   the rail link marked current, the four live-tally figures, the primary action, the storage key
   (`ward-flow-<page>-appearance`), the title and heading. Never hand-patch a copy of the shell; copy it
   and adapt only the named parts. If the page has no rail link of its own, mark the parent it belongs
   to and say so in your report. If the screen has no entry in section 14.1, keep its purpose from the
   page and report the missing entry as a gap; do not add it to the standard.
2. **The Never list (section 11).** No coloured bar along any edge of a row, candidate or card, brass
   included. No highlight along the top of a panel or control. No retired token. No HTML text under 12px
   (SVG text may be 10.5px and up). No hex in a component. No shadow inside a panel or on a button, chip,
   card or row. One primary control per panel at most. No new tokens, no new greys. No font family named
   in the page's own CSS: the three tokens `--display`, `--body`, `--mono` only.

   ⚠️ **"No arrow" is THREE narrow rules, not one broad one, and this brief used to overstate it.** The
   standard bans an arrow as an overflow affordance (5.8); as the way a queue row writes where somebody is
   going, where the words from and to are required instead (6.7); and as a delta in a figure band (6.16).
   **It says nothing about a directed diagram, where direction IS the content.** Command's flow map draws
   arrowheads on its route lines and that is not a defect. Read the rule, never this summary of it.

3. **Polish as a bed coordinator would use it.** Hierarchy and scan order. Every count in the rail, the
   bar, the drawers, the tabs and every panel header derived from the page's data and reconciling. Every
   empty list says why. Every zero reads "none". Absences stated in words, never colour. Keyboard reach
   and a visible focus ring on every control. Every width (1920, 1600, 1440, 1280, 1200, 1100, 390, 320)
   in both themes with nothing clipped, nothing overflowing, nothing hidden that carries a count. Wording
   per section 8: site code first, figures in mono, from and to, no arrows, no dashes as punctuation, no
   verdict about a person, no invented real-seeming name or record number, and every sentence that
   discloses an invented figure true when read alone. Where a small redesign buys a big improvement,
   make it and describe it in one line.
4. **Format, then prove it.** `npx prettier --write docs/ward-flow/mockups/<page>-third-edition.html`
   (one file at a time; Prettier crashes on several). Then, once each, from the repository root:

   ```
   node docs/ward-flow/mockups/third-edition-kit/check.mjs docs/ward-flow/mockups/<page>-third-edition.html platinum
   node docs/ward-flow/mockups/third-edition-kit/check-shell.mjs docs/ward-flow/mockups/<page>-third-edition.html platinum
   node docs/ward-flow/mockups/third-edition-kit/shots.mjs docs/ward-flow/mockups/<page>-third-edition.html <scratch>/shots/page platinum
   ```

   Paste the deciding lines verbatim. Look at your 1600 and 390 screenshots before reporting. Where
   check-shell asserts something Command-specific, say which line and why, rather than bending the page
   to pass it.

   🔴 **BUT THE DEFAULT IS THAT A RED LINE HAS FOUND YOUR BUG.** Three agents in one week reported a
   failing check as an inapplicable one and were wrong all three times. In the worst, a page shipped with
   the control that says "your service was changed, here is the way back" rendered inside a panel the page
   had hidden, so a coordinator moved into a service they never chose would have had no visible route out.
   **Before you call any line Command-specific you must show that the thing it asserts cannot exist on your
   page FOR A REASON OF DESIGN, not because you did not build it.**

   **Two that genuinely are Command's**: it types Command's test person "Flint", and it presses the Capacity
   rail item expecting an unbuilt screen to answer, which no page that marks Capacity as its own current
   item can satisfy.

   ⚠️ **One that is NOT, and has been misread three times**: the filter bar and its `[data-restore-svc]`
   control are not part of Command's queue. They state that the reader's Service selector has been moved out
   from under them and offer the way back, which applies to ANY page carrying that selector. A page with no
   queue still needs them: `network-third-edition.html` is queue-less and passes the whole run. Read it.

   **Never run an edited copy of a kit script and report its output as a pass.** A script you changed until
   it agreed with you is not a gate. Known trap: a page that is a full HTML document has a small reset
   `<style>` in its head; a page rule must go at the end of the MAIN stylesheet or the main block overrides
   it.

## Rules that are not negotiable

- Edit only your one file. Never commit or stage; the lead commits after reading your report. Never
  delete, move or rename anything; never create files inside the repository.
- Do not edit the standard, Command (unless Command is your file), the kit or any other page. A
  shared-layer improvement goes in your report as exact old and new text for the lead to apply to every
  page at once.
- Do not publish artifacts, touch GitHub, call any provider, or push.
- Every colour comes from a token; every size from the scale; a value the standard lacks is reported as
  a gap, never invented. Keep the page's invented data and its refusals; they are the owner's.
- If you reach a decision this brief does not cover, stop and hand it back in your report.

## Report, in this shape

1. **Ported:** what the shell work changed, in a few lines.
2. **Never list:** what was removed or replaced, with counts.
3. **Polish:** each change, one line each.
4. **Redesigns:** each one with its reason, one line each.
5. **Harness:** the deciding lines of the three runs, verbatim, and any Command-specific check-shell
   line with your reason.
6. **Handed back:** decisions the brief does not cover, for the owner.
7. **Gaps in the standard:** rules or entries the standard lacks that your page needed.

Plain English throughout; the owner reads these reports.
