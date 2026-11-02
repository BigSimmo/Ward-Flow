# Tools: review and suggestions (2 Nov 2026)

What I reviewed: the Tools sheet in the master design (Shell popups, Tools tab, built from main dce1194a0). I opened every tool at 390 and 1280, in light and dark. Screenshots are in this folder. Nothing is built. Mock-ups come only after you say yes.

## The short version

Tools works, but it reads as a long list of drop-downs. The best spot at the top goes to a demo control. Tools open below the fold. Find a bed hides its results under four rows of filters. The fixes that matter most:

1. Put your recent tools at the top.
2. Open one tool at a time.
3. Show counts on rows.
4. Put results first in Find a bed.
5. Add Remind me.

## How it looks and feels

**Q308.** Move "Viewing as / Change view" from the top of Tools down to the Demo section at the foot. It is a demo control, but it takes the best spot (about 70px). _Recommend yes._

**Q309.** Add a "Recent" row at the top: up to 4 chips for the tools you used last, so a repeat look-up is one tap. _Recommend yes (recent tools only; skip hand-picked pins for now)._

**Q310.** Open one tool at a time, and scroll it to the top when it opens. Today several can be open at once, and Find a bed opens below the fold at 1280. _Recommend yes._

**Q311.** On wide desktops (1280 and up), use two panes: the list on the left, the open tool on the right. _Recommend not yet; do Q310 first and look again._

**Q312.** Show live counts on rows with the kit count badge, for example "Hospital feed 3" and "Legal forms 5". _Recommend yes._

**Q313.** Shorten each row's second line to 2 to 4 words: "Team by suburb or postcode", "Beds, flow and waits", "Who is on now", "Text for email or Teams", "Every open form". _Recommend yes._

**Q314.** Fix the icons. On-call uses a magnifier, the same as search, so give it a phone. Find a bed and Update a bed use almost the same bed icon, so give Find a bed a bed with a search mark. _Recommend yes._

**Q315.** Tint the row icons by group, using master tokens: accent for Do now, neutral for Look up and Print and share. It makes Do now easier to spot. _Recommend yes._

**Q316.** Make search do more. When nothing matches, offer "Search Ward Flow for this" so the words go to the main search. Pressing "/" in Tools jumps to the search box. _Recommend yes._

## Better versions of what's there

**Q317.** Find a bed: show the results first. Fold the four filter rows (age group, bed, ward for, legal status) into one line, for example "Adult · Any bed · Any · Voluntary", and tap it to change. Remember the last choice. _Recommend yes._

**Q318.** Copy bed summary: show a tidy preview card with short headings and bold figures, in place of the code-style text block, and keep Copy pinned at the bottom. The copied text stays the same. _Recommend yes._

**Q319.** Form times: swap the browser's own drop-down for the kit's choice control. Show the result as a large due time plus time left, in the master's due colours, with "Add to My list". The "not legally checked" line stays. _Recommend yes._

**Q320.** Hospital feed: list the messages waiting, each with Confirm. Move "Receive next message" to Demo, because it is a demo button sitting under Do now. _Recommend yes._

**Q321.** All figures: cut it to 4 headline figures and add "See all on Statistics". Eighteen figures is a lot for a side sheet, and they repeat Statistics. _Recommend yes._

**Q322.** On-call: open on Key lines, with a 40px call button on each line. Fold the five filter chips into one choice. The numbers stay invented demo numbers. _Recommend yes._

## New tools

**Q323.** Remind me: set a reminder on a ward, bed or movement, for example "Check this bed at 14:00". It shows in Alerts at that time. You pick from lists, with no free text, so no patient words get typed. _Recommend yes. This is the most useful new tool._

**Q324.** Message builder: grow Copy bed summary into 3 ready messages: executive on-call escalation, bed meeting update and ED update. Each one is built from the current figures. _Recommend yes._

**Q325.** Book transport: add a Do now row that opens the existing Log transport pop-up from any page. _Recommend yes._

**Q326.** Due back from leave: a look-up of leave beds due back today, by ward, using the leave data the app already holds. _Recommend yes._

Q327 onward is used by the design system thread.
