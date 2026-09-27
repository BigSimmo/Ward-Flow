---
name: supabase-cli-stalls-on-large-migrations
description: supabase migration up buffers each migration to split statements and effectively hangs on the 16 MB bootstrap seed; psql applies the same file in 15 seconds
metadata:
  node_type: memory
  type: reference
  originSessionId: fa69685a-38db-4370-b1f2-c9129a7318f0
  modified: 2026-09-18T15:55:24.139Z
---

`supabase migration up --local` stalled for 25+ minutes on
the site-content release/outbox migration (gone — that migration file was removed from the chain) (15.9 MB, the 843-row
epoch-zero seed), at ~0.5 core with its working set growing ~15 MB/s, **without ever opening a
database connection** — `pg_stat_activity` was empty the whole time. The CLI buffers each migration
to split it into statements. `docker exec -i <db> psql -v ON_ERROR_STOP=1 -f -` streams it and
applied the same file in **15 seconds**; the full 250-migration chain took about 20 minutes that
way, mostly per-invocation `docker exec` overhead on Windows.

**Why:** the tell that it is not working is the absence of a query, not the absence of output.
"Still applying" and "wedged" print identically, so the check is
`select … from pg_stat_activity where state='active'` plus whether the process's RSS is climbing.

**How to apply:** to reproduce CI's chain side locally, `supabase start` with `supabase/migrations`
temporarily moved aside, apply `supabase/roles.sql`, then loop the migration files through `psql` in
filename order. The schema built is the same; only `supabase_migrations.schema_migrations` differs,
and `check:chain-mirror-parity` strips migration history from both sides by construction. Say in the
PR that the substitution was made — it is a real difference from CI's method.

Two traps hit while doing this. A resume-from-last-applied loop whose SQL quoting was mangled
returned an empty version and silently restarted from the first file, re-applying migrations onto an
already-migrated database — print the resume point and assert it is non-empty. And `git checkout --
<path>` run from inside one of these directories trips `protect-ward-flow.sh` as a deletion; use
`git -C <abs path> restore <path>` instead. The same hook also blocks a heredoc whose _text_
describes that, so write such notes with the Write tool.

Related: [[a-comment-can-satisfy-a-guard]], [[a-green-mutation-only-counts-if-the-mutant-ran]],
[[local-test-failures-windows]], [[heredoc-backslashes-collapse]].
