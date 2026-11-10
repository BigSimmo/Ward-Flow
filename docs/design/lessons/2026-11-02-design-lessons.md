# Design lessons, 31 Oct to 2 Nov 2026

A dated record of what the Ward Flow screen builds and reviews taught us. The rules that came out of them are in [DESIGN-SYSTEM.md](../DESIGN-SYSTEM.md). The master's own list is [master/rules.html](../master/rules.html). Synthetic data only.

## Josh's taste

- Short labels. "For you / With other desks" was rejected as too wordy (Q179). Keep the Alerts count header ("4 act now · 9 waiting", restored in #1279).
- Plain, warm Australian English, answer first.
- Less is more: extra marks, tags and tabs were dropped on review (names on chart bubbles, a "None fit" tag, an extra tab).
- No coloured side edges ("it feels tacky", 31 Oct).
- Restructure, not restyle. Never shrink the dark band to save space.

## Shell and source

- Mock-ups take the shell from the master, never from `main`. The first Alerts mock-up was rejected because it copied main's pre-30 Oct header (1 Nov).
- The master is the design source and `main` can lag it. A master tab points at a `main` build only after a side-by-side check at 390, 820, 1280 and 1440, light and dark (Q209, Q230).
- The band hero is the header on every page, phone included. The phone hides a repeated eyebrow and keeps one hero action, the rest in "…" (Q153).
- Each person keeps their own phone dock on every page (Q162). Pages no dock tab owns light the Menu icon (Q161). The dock says Alerts, not Tasks (Q268).
- The 36 "As …" role views are archived and must not be built from (Q156).

## Kit reuse

- The most common audit miss was one-off `.tag`, `.chip` and `.pill` CSS instead of the kit `Badge` (1 Nov audit).
- Patients re-implemented `clk()`. Use `format.ts`.
- Several builds drew 48px phone buttons that should be 40px with a 48px cover. Accept, Pull and Decline are the only full 48px buttons.
- Kit sizes found short on phone: segments 32, chips 34, Statewide picker 24 (Q225), small buttons 32 (Q295). All now 40px on phone.
- Desktop tabs stay 30px; the 40px rule is phone only (Q231).

## Design and spacing reviews (2 Nov)

- Q224: the kit `.seg {position: relative}` beat a page's `position: sticky`, so phone tab bars shifted 56px and hid content. Watch specificity between kit and page CSS.
- Q226: names are shown as written ("Dr S. Chen"); `surnameFirst` was removed, reversing Q58.
- Q227: Movements on phone opened every stage closed; open the first useful item.
- Q228, Q243, Q244, Q291: Community team cards and tiles cut off at 820 and 1280. Stack crowded cards below about 900px.
- Q229, Q290, Q293: hero figure strips wrapped or clipped at in-between widths. Let the title column shrink first and keep figures on one row.
- Q232 to Q248: spacing fixes (Legal forms rows, Patient hero labels, Capacity bed map title, Discharges stray dot, ED padding, Statistics Median). The design sweep CI spec now fails text under 12px and covering sticky bars.
- Phone screenshots must wait for the "Loading, not live yet" note to clear, or they show the desktop tree squeezed to 390. Use a mobile identity (touch, mobile user agent) at phone widths.

## Pre-launch checks (2 Nov, Q260 to Q307)

- Wording drift was the biggest batch: one label, different numbers (Q260); two words for one thing (Q261 to Q267, Q269, Q272). The fix is one term per thing and one source per count.
- Test words reached the screen ("Mock numbers", "Demo time") (Q270).
- Loading and offline states needed time limits and a way out (Q273 to Q275), and must not cover the title (Q276).
- Long data: long page names pushed Search off the phone bar (Q280); hidden table text made a page slide sideways (Q281); unbroken typed words ran out of cards (Q283); shortened names lost the first name (Q285).
- Widths: landscape phones over 768 wide got the tablet layout with tiny controls (Q288, Q289); iPads at 744 and 768 got the phone layout until the phone range ended at 743px (Q292, Q294, #1298).
- Accessibility: at 200% text kit controls, the dock and safety lines were cut (Q297); kit labels now wrap (Q306); dock labels shrink to fit and never split a word (Q307, #1310). Focus rings, focus return, Tab trapping, heading levels and landmark names were fixed (Q298 to Q304). Dark red badges need a deeper fill (Q302).

## Tools review (2 Nov, Q308 to Q326)

- A demo control took the best spot in Tools (Q308). Demo controls go at the foot.
- Several tools could be open at once and opened below the fold (Q310). Open one at a time, scrolled into view.
- Results were hidden under filter rows (Q317). Results first; fold filters into one line.
- Look-alike icons confused tools (Q314). One icon per meaning.
- A browser drop-down sat where the kit choice belonged (Q319).

## Process lessons

- Build only approved designs, mock-up first, numbered questions with one recommendation each.
- Mark a PR ready once CI is green and it matches the mock-up; switch auto-merge on while checks run (GitHub refuses it on an already-green PR, Q175), but never on a PR that is held or awaiting Josh's approval. If GitHub refuses to arm a clean green PR of your own, merge it by hand (AGENTS.md hard rule 6, 3 November 2026).
- Run one capture process at a time against a dev server; three at once crashed it. A production build (`WARD_GATE_BUILD=1 npm run build`, `next start`) takes five parallel reviewers.
- Rewrite tests that pin old wording; never skip a test to get green.
