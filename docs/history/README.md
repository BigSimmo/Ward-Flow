# Ward Flow history

**Historical records. Not current guidance.** Audience: anyone tracing why something was decided.
Owner: Documentation. Moved here on 8 November 2026 with Josh's approval (documentation audit of
7 November 2026).

Nothing here describes the app as it is now. For current work start at
[`docs/README.md`](../README.md), [`AGENTS.md`](../../AGENTS.md) and the
[status page](../ward-flow/STATUS.md).

## What is here

| Folder or file                       | What it is                                                                                                            |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| [`lessons/`](lessons/README.md)      | 207 lessons imported from the former Database project. `docs/ward-flow/RULES.md` is still generated from them.        |
| [`archive/`](archive/)               | Dated notes, owner-ruling dumps and registers. `docs/ward-flow/OWNER-RULINGS.md` is still generated partly from them. |
| `ward-flow-*.md`                     | Superseded top-level files: old ledger, phase handovers and decisions, provisional values, remaining-work list.       |
| [`ARCHIVE-NOTE.md`](ARCHIVE-NOTE.md) | The former archive note. Its record of earlier trims is now in [`docs/ARCHIVE.md`](../ARCHIVE.md).                    |

## How to use it

- **Search skips this folder by default.** The repository's `.ignore` file tells ripgrep and editors
  that read it to leave `docs/history/` out. Search it on purpose with
  `rg --no-ignore-dot <words> docs/history`.
- **The checks still run here.** Links, control characters and the two generated indexes above keep
  checking these files, so a move or edit that breaks them still fails.
- **Do not update these files** except to fix a broken link or a generator input. Record new
  decisions in [`decisions.md`](../ward-flow/decisions.md).
- **The tree before the move** is `main` commit `6b1352c9` (`git show 6b1352c9:<path>` reads any old file).
