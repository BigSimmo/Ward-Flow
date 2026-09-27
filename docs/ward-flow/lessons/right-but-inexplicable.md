---
name: right-but-inexplicable
description: My truthfulness fix removed the ward name a coordinator had just searched for — the row went from wrong-but-legible to right-but-inexplicable
metadata:
  node_type: memory
  type: feedback
  originSessionId: c0c9bd3a-7216-4498-b69a-3d91db4f68d5
  modified: 2026-09-04T03:16:23.694Z
---

A search result's Destination column named the first ward _asked_ as though it were the confirmed
destination. I corrected it to "1 ward asked, none has accepted" — true, and an improvement by every
truthfulness measure.

**But the search matches on ward names.** So a coordinator typing a ward's name still got that row,
and after my fix **the ward they had typed appeared nowhere in it**. The result looked arbitrary.
Before: wrong but self-explanatory. After: right but inexplicable. **Neither is what the person
needed**, and nothing in a truthfulness guard can see the second one — every such guard would score
my version strictly better.

The repair was to name the wards in the same cell — _"1 ward asked, none has accepted — FSH Older
Adult"_ — so one string answers both "what is the destination" and "why is this row here".

**How to apply:** after correcting what a screen SAYS, ask what the screen has stopped saying. A
removed falsehood often took a real signal with it, because the false thing was doing two jobs. In
particular, whenever a value is both DISPLAYED and SEARCHABLE, changing the display silently breaks
the explanation of every match — the search index and the rendering are the same fact in two places
and only one of them got fixed.

**And say when the follow-up is yours.** This landed on me as a pre-existing item; it was partly my
own doing, and saying so is what stopped it reading as inherited work.

⚠️ A downstream guard asserted "no referred ward's name may appear on this row" — an exact proxy
while the only way a name could appear was as the destination, and false the moment the cell named
the wards asked beside a denial. Both sides were right, neither branch was red, and **the merge made
them contradict**. Its replacement has no vocabulary in it: strip every unit name and the separators
from the cell, and something must remain.

Related: [[operands-that-coincide]], [[an-absence-promoted-to-a-headline]],
[[a-shared-layer-inherits-responsibilities-not-just-properties]].
