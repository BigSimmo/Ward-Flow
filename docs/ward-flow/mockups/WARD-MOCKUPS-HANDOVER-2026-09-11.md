# Ward Mockups — handover, 11 September 2026

**Written at the owner's instruction to hand over everything and ask Ward Lead for the next task.**
Supersedes the head figures of `FOLD-READY-2026-09-10.md` and `WARD-MOCKUPS-STATUS-2026-09-10.md`,
which were true when written.

    worktree      D:/Worktrees/Database/ward-mockups
    branch        ward/mockups-20260910
    tip           a89a0fa157a36e1aeb18d05a5c112614caadd84b
    line tip      cfb963f23ceb4688e500f1536803284635a9386c
    vs the line   155 behind, 14 AHEAD
    uncommitted   NONE

🔴 **These figures age. Re-measure before folding:**

    git -C D:/Worktrees/Database/ward-mockups rev-list --left-right --count codex/task-ward-flow-live-state-20260831...HEAD

**Already folded, confirmed by `merge-base --is-ancestor`:** `61f757ba5c`, `4b92d03e87`,
`66000a388a`. Nothing below duplicates them.

---

## 1 · The fourteen unfolded commits, oldest first

| SHA          | What it is                                                                     |
| ------------ | ------------------------------------------------------------------------------ |
| `a5508f96b6` | **Service statistics** — the fourth of the statistics family                   |
| `0f8aa136e3` | **Add a patient** — the front door, duplicate check running on every keystroke |
| `5184daa3e8` | **Out of area** — states two facts and joins them with nothing                 |
| `c60ae69ceb` | **Referrals** — the triage board, built to §14 no. 8                           |
| `032d204525` | **Sign in and role** — no shell, and no input element at all                   |
| `ab6305d299` | **Alerts** — reuses the register rather than inventing a notice                |
| `1210b9b0d9` | **Transport officer** — phone-first and desktop in one file                    |
| `820a17ceba` | **fix** — the Triage control was 34px on a phone against a 48px floor          |
| `9fd57bb582` | **Settings**, and **On-call** with three sentences false about their own table |
| `71ecd98aab` | **Governance** — the override register, the last of the eleven                 |
| `ce359a6537` | **fix** — D-4, the Access record header note                                   |
| `80a0559987` | **docs** — §8.6 now binds the whole screen, not one component                  |
| `6c748e3a95` | **fix** — Handover alone asserted its figures reconciled regardless            |
| `a89a0fa157` | **docs** — the eleven published, URLs recorded in the README                   |

**Fold the tip.** These are for reading, not cherry-picking.

---

## 2 · What was asked for, and what exists

**All eleven pages the owner asked for are built, proved and committed.** Twenty-eight third-edition
drawings now exist; every one passes `check.mjs` ALL GREEN at eight widths in both themes, re-run by
this chat rather than taken from any agent's report.

Handover · Add a patient · Service statistics · Out of area · Transport officer · Referrals ·
Governance · Settings · Sign in and role · Alerts · On-call and contacts

**All eleven are published as artifacts and their URLs are in
[`README.md`](README.md)**, so a later chat republishes to the same artifact instead of making a
second one the owner never opens.

**Two are deliberately unlike the rest.** **Sign in** has no rail and no bar, because a rail reading
_"Signed in as Bed coordinator"_ cannot appear before anybody has signed in — and it holds **no
input element of any kind**, so it can never become somewhere a real password is typed.
**Transport officer** is designed for a phone beside a van and holds at desk width in one file.

---

## 3 · 🔴 Defects found in already-committed work, and what each taught

**1 · The Triage control was 34px on a phone, against a 48px floor.** Found by the Transport officer
agent while building its own page. **Measured in a browser before and after**, not reasoned from CSS.
It shipped ALL GREEN because tap height is one of **exactly three lines §10 records as not gated by
the harness**. A page can be fully green and still wrong in precisely the three places the standard
already names.

**2 · On-call rendered placeholder extensions and addresses — which the standard REQUIRES — while
three sentences beside them said the screen held none.** Same shape as the Live-reconciled defect.
🔴 **The cause was this chat's own brief**, which forbade even a placeholder and so contradicted
§8.7. The agent followed the standard for the data and the brief for the prose. **The sentences were
fixed, not the table.** ⚠️ **Its own verification could not have caught it** — it grepped for
phone-number shapes and truthfully reported zero, while its page rendered extensions and addresses
its pattern never looked at.

**3 · Handover alone still asserted its figures reconciled whether they did or not**, painting a
fixed green dot. Every other page turns it danger and says how many do not. Handover predates the
plan branch's shell fixes. **Found by a probe that looked catastrophically broken and was not**: a
sweep for the ruled sentence returned zero on all twenty-four pages, because since the merge the
sentence is **assembled at runtime from three pieces**, so a search for the literal phrase cannot
find it. **The artefact searched is not the artefact that runs.**

---

## 4 · A measured class, reported and NOT chased

**Every visible control on all 28 pages measured at 390px wide.** Five pages carry controls under
48px: **capacity, command, design-system, movement, statistics**. Some are SVG diagram nodes and some
are links inside scrolling regions, **so a blanket fix would be wrong**. None is a page this run
created. Left for a decision rather than swept.

---

## 5 · What is queued and NOT started

**From Ward Lead, awaiting its word:**

- **Q-10** — the seven missing §14 screens index entries. Owner said YES; assigned here by name.
- **Q-13** — the Raise a referral prose redraw against the 2026-08-30 one-story-field ruling.
- **Q-11** — remove the rail brass bar and the flow-map ED-node bars, keep the brand stripe.
  ⚠️ **This is a SHARED-LAYER change.** The rail lives in the shell, so it is made on Command and
  applied to every page by script, never page by page. Doing it per page is how shells drift.
- **D-1** — the patient screen is called **Patient**, not "Patient Now". The filename is a separate
  question.

**Four design-system corrections relayed 11 September (D-6, D-8, D-9, D-10),** each to be verified
against the file before editing because a relayed measurement loses its attribution in transit:

1. §8.6 / §7.4 — the invented-data marker in **announced** text; the standard under-describes its own
   announcements, because both page-level markers are visual and a screen-reader user reaches neither.
2. §8.6 — the marker noun on a patient search is **names**, never people.
3. §5.8 — the overflow affordance. `--edge-shade` resolves to nothing outside the shell-chrome files
   and paints **silently**; the sentence is the affordance and ward tables use the measured border.
4. Two drawing-versus-code conflicts ruled for the code. ⚠️ **Ward Lead said explicitly: do not go
   looking yet**, it will send the specific files after re-measuring.

---

## 6 · Open with the owner, unanswered

- **One wait format, or days for long waits.** The standard fixes the compact form (`25h 10m`); the
  built board renders whole days, because on real records the compact form produced figures nobody
  could read. **Both cannot be right.**
- **What a coordinator on call may actually do.** A strict reading of the screens index gives them 4
  of 13 actions, which looks wrong against the data contract.
- **Governance is two different screens** — the standard's override register, or the built page's AI
  assurance view.
- **Notices.** §6 has no component for _"the system told somebody something"_. If notices become
  real, that is a new component and the owner's to approve.
- **Whether home-area bed allocation is a real WA rule**, which decides whether Out of area's note
  ever becomes a check.

---

## 7 · Beliefs, not measurements

Recorded because false claims about other chats' state have circulated repeatedly.

- **That Lane C has fixed the live-region contradiction.** Ward Lead's account. **The contradicting
  sentences are still present in `src/components/ward-management/` in this checkout** — which may
  simply mean this checkout predates their fix. Not a claim that Lane C failed.
- **That errata §U and the D-rulings say what was relayed.** §U's commit `fbb1b6d7ca` was confirmed
  to exist and its subject matches; the four corrections of §5 above are **summaries and have not
  yet been read at source.**

---

## 8 · House rules observed throughout

Nothing pushed. `main` untouched. No `git add -A`, no bare stash, no worktree removed. No whole-tree
format pass — every file formatted individually. The `.prettierignore` entry for
`docs/ward-flow/design/prototypes/` is intact. No `src/` or `tests/` file was touched: those are the
build line's.
