---
name: a-gate-that-passed-before-your-next-edit
description: "A gate that went green before a later edit reports green again from its memoised receipt — the pass is about the old content, and CI is where it turns red"
metadata:
  node_type: memory
  type: feedback
  originSessionId: f7dea8db-82e3-4cc2-83cc-c11937809216
  modified: 2026-09-17T17:26:06.100Z
---

I ran `npm run check:pr-policy` until it passed, **then** rewrote
`.github/pull_request_template.md`, and never re-ran it. Later runs still said
`[pr-policy] self-test passed`. CI failed on that exact check.

`scripts/gate-receipts.mjs` memoises `lint`, `typecheck` and Vitest against a content
signature, and **`CI` being set disables reuse** — so the local pass was a receipt for the
pre-edit content while CI actually ran the check. The self-test asserted the template still
carried all seven governance items as unchecked boxes; the slimmed template did not.

**Why:** a receipt reports on the content it was taken from, not on the tree in front of you.
Nothing in the output distinguishes "I just ran this" from "I ran this two edits ago" unless
you look for the `reused receipt` wording — and the bare `passed` line looks identical to a
fresh run. The window is widest exactly where I am most confident: after a gate has gone
green once, I stop thinking of it as outstanding.

**How to apply:**

- **Order matters more than count.** The question is never "did this gate pass?" but "did it
  pass on _this_ content?" Re-run any gate whose inputs you touched _after_ its last green.
- Before pushing, re-run the decisive gates with `GATE_RECEIPTS=refresh CI=true` — that is
  what CI does, and it reproduces failures locally instead of buying a red round trip.
- A guard often reads files far from the one you edited. `check:pr-policy` reads the PR
  template; `check-gate-manifest.mjs` reads counts out of `CLAUDE.md` and a SKILL.md. Editing
  a doc can redden a script gate. See [[a-declaration-is-not-an-effect]].
- Report a reused receipt as "reused receipt from &lt;time&gt;", never as a fresh run
  (AGENTS.md requires this). Relates to [[gate-wrappers-mask-exit-codes]] and
  [[a-clean-result-from-measuring-nothing]].
