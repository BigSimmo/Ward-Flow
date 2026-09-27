---
name: ward-flow-no-edge-bars-ruling
description: "Owner ruling 2026-09-09 — no coloured bar along any edge of a Ward Flow row, card or candidate (brass included) and no top highlight; where it is recorded and what was deliberately kept"
metadata:
  node_type: memory
  type: project
  originSessionId: 29c363eb-169a-4dac-8951-045babf2d37d
  modified: 2026-09-09T11:13:35.689Z
---

On 2026-09-09 Josh removed a design feature he hates from the Ward Flow third edition: the 3px
status bar along the left of register rows, candidate rows and pinned rows, the 3px bar along the
top of pressure cards, the brass bar beside a selected queue row, chosen service row, pressed task
row and current screens card, and the one pixel highlight along the top of panels, pop outs and the
primary control. The word, the mark and the meter now carry every state alone. A register row's
title carries its tone in its own colour instead.

Recorded in `docs/ward-flow/mockups/WARD-FLOW-DESIGN-SYSTEM.md` section 13 "Decisions taken", the
Never list, rules 5, 6 and 10, and the departures table (commit 485a9cfa98 on
`claude/wardflow-design-review-43df97`). The two highlight tokens stay defined and are marked retired.

**Deliberately kept, pending his word:** the rail's brass "you are here" bar beside the current
item, the brass underline on the live tab and segment, the brass current stage in the stepper, the
service stripe under the brand, the 3px brand stripe at the top of the window, and the flow map's
pressure bar on the left of each ED node.

**Why:** other chats re-cut mockups from downloaded artifacts or older branches, and the four
mockup pages published before 2026-09-09 (Patient search, ED hub and so on) still draw the bars.
Re-cutting one from the standard is right; copying its old CSS forward re-commits the feature.

**How to apply:** before drawing any coloured edge on a Ward Flow row or card, read section 13 of the
standard. If a page still has the bars it predates the ruling and is a candidate for a re-cut, not a
model. See [[ward-flow-coordination-state]] and [[a-mockup-can-re-commit-a-closed-defect]].
