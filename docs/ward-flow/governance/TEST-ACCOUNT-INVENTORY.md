# Test account inventory

_Created 2026-11-10 - audit item M47 (source B78), for the [real-data go/no-go](REAL-DATA-GO-NO-GO.md). Drafted on branch `claude/project-thread-bnphlk` (from `main` `29352cd0`). Documentation owns._

**Status:** draft, blank record. **Nobody has listed the live accounts yet.** The item is done
when the record below is filled in, dated and signed at go/no-go.

## Why this exists

The shared workspace runs on one Supabase project. Today it holds eight synthetic test accounts
and one synthetic monitor account (the one the **Backend uptime** workflow signs in with). If the
same project later holds real data, every one of these accounts is a way in. Each must be kept on
purpose, with a role and an owner, or removed first.

The accounts are not in the repository: the code, seed data and docs hold no account address or
password ([retention and backup, item 12](../RETENTION-AND-BACKUP.md)). So the list has to be read
from Supabase **Authentication, Users** and Ward Flow **Settings > Access > Everyone with a role**.
That is a read-only provider look and needs Josh's yes (AGENTS.md rule 3).

The test half of this item is automatic: `tests/ward-audit-m47-fixtures-synthetic.test.ts` fails
when a fixture or data file is not on its reviewed register, when a test file holds an email
address that could reach a real person, or when a workflow that uploads CI artifacts reads a
secret.

## How to fill it in

1. Write each account by **role and purpose only**, for example "Synthetic ward desk, Ward 3B".
   Never write an email address, password, token or user id here.
2. Mark it **keep** or **remove**. Keep only with a named owner (by role) and a reason that still
   holds once real data is in the project.
3. Removing an account is a live change: it needs Josh's yes at the time.
4. Before real data, either move real data to a new project with no test accounts, or keep this
   list current at every [access review](ACCESS-REVIEW.md).

## Record

### Inventory on \_\_\_\_\_\_\_ (date)

- Read by (role): \_\_\_\_\_\_\_ Read from: Supabase Authentication users / Ward Flow Access (circle)
- Data in the project at the time: synthetic only / real (circle)

| #   | Account (role and purpose only) | Ward Flow role and place | Keep or remove | Owner (role) | Reason |
| --- | ------------------------------- | ------------------------ | -------------- | ------------ | ------ |
| 1   |                                 |                          |                |              |        |
| 2   |                                 |                          |                |              |        |
| 3   |                                 |                          |                |              |        |
| 4   |                                 |                          |                |              |        |
| 5   |                                 |                          |                |              |        |
| 6   |                                 |                          |                |              |        |
| 7   |                                 |                          |                |              |        |
| 8   |                                 |                          |                |              |        |
| M   | Synthetic uptime monitor        | One executive role       |                |              |        |

Any account found that is not on this list: \_\_\_\_\_\_\_

Signed at go/no-go (role and date): \_\_\_\_\_\_\_
