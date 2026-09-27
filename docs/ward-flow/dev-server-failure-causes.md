# The dev server will not serve a ward page — four causes, one symptom

**Written 2026-09-08 by Ward Verifier, from a measured session, at `9add828165`.**

Every cause below ends with the same thing on screen: a blank or 500 page on every ward route. Two
chats have now stopped at the first cause they recognised and been wrong. **A correct diagnosis for
the noise can sit on top of a real defect underneath.** So this file is organised around the
DISCRIMINATOR — the one observation that separates each cause from the others — not around the
symptom, which is useless for telling them apart.

## Run these three first. They separate all four causes in about six seconds.

```bash
tail -40 dev-server.log                 # what the server actually says
curl -s -o /dev/null -w "%{http_code} in %{time_total}s\n" http://localhost:<port>/api/local-project-id
node -e "const p=require('postcss'),f=require('fs'),t=require('@tailwindcss/postcss');const c=f.readFileSync('src/app/globals.css','utf8');const s=Date.now();p([t()]).process(c,{from:'src/app/globals.css'}).then(r=>console.log('OK',r.css.length,'bytes in',Date.now()-s,'ms'))"
```

⚠️ **The response TIME is the most under-used signal here and it is nearly free.** A live
stylesheet compile takes seconds — the hand-compile above took 5.2s to SUCCEED. A route that fails
in ~27ms did not try. That single number separates cause 3 from cause 2, and nothing else does.

---

## 1. A forward `composes` in a ward CSS module

**Discriminator:** the log names the stylesheet and the class; the route 500s from the first request
after the edit; no memory message anywhere.

A rule composing a class declared BELOW it. `composes` forbids that, and it returned 500 on every
ward page. **A presence grep cannot find this** — `grep composes` matches whether or not the order
is legal, so a green grep and a broken stylesheet are indistinguishable. The defect is the ORDER of
two lines.

Use the instrument, not a grep: `node docs/ward-flow/tools/check-forward-composes.mjs`. It reports
FORWARD and MISSING separately and always prints the population it walked. **Verified absent
tree-wide on 2026-09-08: 64 css modules, 20 local composes declarations, 0 problems.**

## 2. The machine is genuinely out of memory

**Discriminator:** the crash is happening NOW — the failing request takes seconds, not
milliseconds, and the hand-compile above ALSO fails.

`dev-server.log` carries a Rust allocator abort from the PostCSS subprocess:

```
Node.js process exited with exit code: 0xc0000409
  Recent process stderr:
  memory allocation of 3336984 bytes failed
```

`0xc0000409` is a Rust abort, and the allocator lives in `@tailwindcss/postcss`'s native module, so
this message means the Tailwind subprocess died — not that Node ran out of heap. **The byte count is
not a severity signal**: 124,221,634 bytes on 2026-09-07 and 3,336,984 bytes on 2026-09-08 were the
same condition. Check free memory and the Node process count (48 were running when this last fired);
this machine accumulates abandoned sessions until it starves. Restarting Windows fixes it and ends
every other live chat, so confirm with the owner before proposing it.

## 3. 🔴 A crash from cause 2 that Turbopack has PERSISTED TO DISK — and this is the one that fools people

**Discriminator, and it is decisive: the failure survives a full server restart, returns in ~27ms,
and the same stylesheet hand-compiles successfully in ~5s.**

The PostCSS subprocess crashes once under memory pressure. Turbopack writes that failure into
`.next/dev/cache` and **replays it forever**. The machine recovers, memory is free again, and the
server still 500s on every route — because it is not recompiling, it is reading a stored error.

This looks exactly like cause 2 and is not cause 2, and it defeats the obvious remedy: **restarting
the dev server does not clear it**, because the cache is on disk and the fresh process reads it.
Measured on 2026-09-08: restarted, fresh "Ready in 952ms", eleven successful health checks, then the
identical stored error on the first page request. 14 error blocks, byte-identical every time — a
live OOM varies, a replay does not.

**Fix:** stop the server, delete `.next/dev/cache`, start it again. The route then served HTTP 200 in
4.4s.

⚠️ The `protect-ward-flow.sh` hook BLOCKS that delete, because the path sits inside a worktree and
the hook cannot tell a rebuild cache from real work. **That refusal is correct and must not be
edited around.** Ask the owner, state plainly that `.next/` is git-ignored build scratch and that no
Ward Flow work, document, branch or worktree is involved, and on approval prefix the command with
`CLAUDE_ALLOW_PROTECTED_DELETE=1` — **as the first token of the command**, not after a `cd &&`, or
the hook still refuses.

## 4. The cache directory deleted from under a running server

**Discriminator:** `os error 3` naming a specific `.sst` file, plus a turbo-tasks panic.

```
failed to open file `\?\...\.next\dev\cache\turbopack\v16.3.0-...\00000674.sst`:
The system cannot find the path specified. (os error 3)
turbo-tasks: an internal panic occurred outside the per-task panic boundary.
```

Reported by Ward Lead's subagent on 2026-09-08: something removed the cache while the server held it
open. Same remedy as cause 3 — stop the server first, then clear, then start.

---

## Two things that look like defects here and are not

- **`⨯ ReferenceError: <symbol> is not defined` immediately after `Fast Refresh had to perform a full
reload`.** A Fast Refresh artefact. On 2026-09-08 `wardsConfirmedLabel is not defined` appeared
  with the import present at `ward-chrome-header.tsx:13`, the export present at
  `ward-morning-rollup.ts:302`, and the next requests returning 200. Check both ends before
  reopening it.
- **`⨯ Another next dev server is already running.`** Not an error in this repo's workflow — it is
  `npm run ensure` finding the server it was asked to verify. Never assume a port; use the one it
  prints.
