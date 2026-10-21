# Owner answers — 21 October 2026

Recorded as `docs/ward-flow/HOW-WE-WORK.md` §8 asks: the reply verbatim, then the session's reading.

## 1. Auto-merge on a held PR

**Verbatim**, as relayed by the coordinating session (Grok Bot) at 2:21 PM AWST, 21 October 2026, quoting
the owner's rule word for word:

> Do not arm or re-arm auto-merge on a PR that is held or awaiting owner approval; whoever marked a PR
> ready owns it.

**Reading (this session's, not the owner's words):** a sweep or helper that finds a held PR green leaves
auto-merge off and reports it. The session that marked the PR ready, or the owner, arms it once the hold
is lifted. Recorded in `AGENTS.md` hard rule 6 and `docs/ward-flow/lessons/parallel-chats-and-cross-chat-sync.md`
(PR #523). It supersedes no earlier ruling: hard rule 6 already said automation must not disable or
re-enable auto-merge on an armed PR; this adds that a held PR is not armed at all.
