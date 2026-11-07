---
name: rsc-boundary-invisible-to-gates
description: Server/Client boundary violations in this Next repo are invisible to typecheck and vitest; only a real build or a live request catches them
metadata:
  node_type: memory
  type: project
  originSessionId: 843b5f08-01ae-4513-bc35-74dd82b6ebe5
  modified: 2026-08-21T23:55:38.665Z
---

Two Server/Client boundary defects shipped past every automated gate on the developer-hub
Phase 1 branch (2026-08-22). Both classes are invisible to `typecheck` (which does not model
the RSC boundary) and to Vitest (which has no boundary at all — jsdom renders a page as an
ordinary client tree).

**Class 1 — a handler serialised into the flight stream.** A component rendering
`<button onClick={…}>` without `"use client"`, mounted inside a Server Component, throws
"Event handlers cannot be passed to Client Component props" on _every request_. `next build`
does **not** catch it when the route is Dynamic — the build compiles the page and never renders
it. Only a live request does: `npm run ensure`, then fetch the route and grep the HTML.

**Class 2 — a Server Component reading data from a `"use client"` module.** Next replaces such
an export with a client-reference proxy, so array/object methods are undefined. Fails at
`next build` with "Failed to collect configuration for /route". Importing a _component_ from a
client module is fine; importing and operating on its _data_ is not.

**Why:** the repo has no lint rule for either. 12 of 13 modules importing
`ignoreUnavailableActivation` already carry `"use client"`, so a static rule would be cheap.
Filed as a P2 `/issues` inbox request on that branch.
_(Updated 2026-09-12: The population of modules importing `ignoreUnavailableActivation` grew from 13 to 36, with 34 carrying `"use client"` and 2 remaining on server boundaries)._

**How to apply:** when a change adds a component under a Server Component page, run a real
`npm run build` _and_ a dev-server fetch of the route before believing green tests. See
[[gate-wrappers-mask-exit-codes]].
