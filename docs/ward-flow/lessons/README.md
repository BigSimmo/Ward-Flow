# Ward Flow lesson store — versioned copy

This directory is a **versioned copy** of the lesson store at
`~/.claude/projects/D--Repos-Database/memory/` (machine-local, outside git). The store is the
**working source** — every lesson is written and edited there, the day something went wrong, not
here. This copy exists because the store itself carries no history and no recovery: until this
copy existed, 160+ accumulated lessons were the most valuable thing this project had produced and
the only part of it with nothing behind it.

## Keeping the two in step

```
node scripts/ward-flow/sync-lessons.mjs          # copy store -> repo
node scripts/ward-flow/sync-lessons.mjs --check  # exit 1 if they differ, naming the files
```

Run the plain command after adding or editing a lesson in the store, then commit the result. Run
`--check` as a gate; it fails (and names every affected file) if a lesson in the store has no
match here, or if content has drifted.

The sync compares file **content**, not timestamps, so a fresh copy with a new mtime still reads
as matching. It never deletes from this directory — if a lesson disappears from the store, that is
exactly the moment this copy is for, so it is reported and left in place, never removed.

## What this copy proves, and what it does not

**This copy proves the lessons existed, in this exact form, at whatever commit you are reading.**
It does not prove any lesson is still current — the store's own first recorded theme is that a
true statement stops being true and nothing announces it. Treat every lesson here the way its own
text asks to be treated: re-derive a cited fact before acting on it, rather than trusting either
copy of the words that describe it.

On a machine that has never had the store, this directory is still fully usable on its own — read,
search, grep — even though the sync script has nothing to compare it against there.
