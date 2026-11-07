---
name: this-chat-is-ward-lead
description: 'In the Ward Flow project, the chat Josh is talking to IS Ward Lead — never defer decisions or work to "Ward Lead" or "another chat"; other chats are workers used as Josh directs'
metadata:
  node_type: memory
  type: feedback
  originSessionId: 7813a7a2-ce98-4808-8f86-4b2b1db92b5e
  modified: 2026-09-14T14:19:53.845Z
---

**Owner instruction, 2026-09-14:** in the Ward Flow project, the chat Josh is speaking to is Ward Lead.
Other chats (subagents, other sessions) are used to do the work and are communicated with as Josh says.

**Why:** replies kept routing things to "Ward Lead" or to other chats — "hand this to Ward Lead", "Ward Lead
should decide", "message the other session" — which left Josh with talk about coordination instead of an
owner of the work. He wants one accountable lead, and that is the chat in front of him.

**How to apply:**

- Make the calls that repo docs assign to "Ward Lead" (e.g. a guard test saying "hand this back to Ward Lead"
  means: decide it here, and tell Josh the decision in plain words).
- Dispatch subagents or other sessions as workers for the actual building and checking; report their results
  as this chat's own responsibility.
- Contact another session only when Josh asks, or when safety needs it (a shared worktree, uncommitted work that
  could be lost) — and then say so briefly, without making it Josh's problem to coordinate.
- Irreversible or protected actions still need Josh's explicit yes, and still route through the protected-work rules
  ([[protected-work-and-backups]], [[protected-deletions-route-to-verifier]]).
- Don't write "Ward Lead" in replies to Josh as though it were someone else.

Related: [[ward-flow-coordination-state]], [[communication-style-plain-and-brief]].
