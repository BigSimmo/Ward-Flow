---
name: a-scrubber-that-removes-the-evidence
description: "A privacy/safety transform can strip exactly the fields triage needs, and the loss is invisible because what remains still looks like a normal record"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 272cfee6-4b66-4c8f-bdcf-93a1b3add32c
  modified: 2026-09-17T13:36:34.143Z
---

A transform that exists to protect (a privacy scrubber, a redactor, a sanitiser) decides what
survives. If it drops a field the _next_ reader needs, nothing errors — the record still looks
complete, and the absence reads as "there was nothing there".

Measured 2026-09-17 on PsychSift's Sentry pipeline, three shapes at once in `privacySafeErrorEvent`:

1. **A field dropped changed the meaning of a field kept.** Rebuilding each exception without its
   `mechanism` made Sentry default every event to `handled: true` — including the ones the SDK
   explicitly marks `handled: false`. All 853 events reported `error.handled: 1`. The value was
   not missing; it was _confidently wrong_, so an unhandled rejection and a caught-and-reported
   error were indistinguishable.
2. **An `undefined` grouping key is not "no opinion", it is "use the default".** The fingerprint
   ternary ended `: undefined`, which handed grouping back to Sentry's own algorithm over exactly
   the minified frames the function existed to normalise. One fault opened a new issue per deploy.
3. **The earlier fix's population was 0.5% of the real one.** A 2026-09-16 change fixed the
   splintering for events carrying a `route_path` tag. Only `captureRequestError` sets that tag:
   4 of 853 events had one. The doc, the tests and the code comment all described a solved problem.

**Why:** the people who write a scrubber are thinking about what is unsafe to send. Nobody is
thinking about what the person reading the output in three weeks will need in order to act. Those
are different lists, and only the first one gets reviewed.

**How to apply:** when writing or reviewing any redacting transform, ask separately what the
downstream consumer needs in order to act. For every allowlist branch, get the denominator — what
fraction of real records take this path? Shape 3 was invisible to every test because all the
fixtures carried the tag. And never return a bare `undefined` for a grouping, priority or routing
key: name the fallback out loud in code.

Related: [[compliance-without-coverage]], [[checks-that-cannot-fail]],
[[a-clean-negative-that-measured-nothing]], [[a-measurement-is-scoped-to-what-it-measured]],
[[broken-and-never-worked-look-identical]], [[a-working-safeguard-leaves-no-trace]]
