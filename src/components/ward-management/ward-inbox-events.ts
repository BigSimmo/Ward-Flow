import type { Instant } from "./ward-clock";
import type { WardFlowRole } from "./ward-flow-roles";
import type { InboxSnoozeReason } from "./ward-inbox-snooze";

/** The action inbox's events, moved unchanged from `ward-flow-events.ts` for its line cap (H-0283). */
export type InboxWardFlowEvent =
  | {
      /**
       * THE ACTION INBOX GAINS A WAY TO SAY "I AM ON THIS" — ward-lead task, 2026-09-06. The owner
       * asked for the coordinator's action inbox (`buildActionInbox`, `ward-derivations.ts`) to
       * become a real to-do list, in the same sentence as *"care must be taken to tick off"*. That
       * sentence is why this is a SEPARATE event from `COMPLETE_INBOX_ITEM` below rather than one
       * generic "handle this row" action — see that event's own doc comment for the distinction.
       *
       * 🔴 **THIS EVENT NEVER REMOVES OR HIDES THE ROW, AND NOTHING MAY BE CHANGED TO MAKE IT DO
       * SO.** `buildActionInbox` computes its list from `movements` and `units` alone
       * (`ward-derivations.ts`); the reducer case for this event touches neither. A breached
       * statutory form or an accepted destination that is no longer lawful is a live FACT about the
       * world, and a coordinator saying "I've seen this" does not make the fact stop being true — it
       * records that a person is now answerable for it, which is a different thing entirely from the
       * fact being resolved. See `tests/ward-inbox-events.test.ts` for the proof: the row set
       * `buildActionInbox` returns is asserted byte-for-byte identical before and after this event.
       *
       * Records WHO and WHEN, never a boolean — see `InboxAcknowledgement` in `ward-flow-reducer.ts`.
       *
       * ⚠️ **APPEND-ONLY, AND DELIBERATELY NOT IDEMPOTENT.** A second coordinator acknowledging the
       * same row after the first is a real, distinct fact (a second person is now also aware of it),
       * not a duplicate to be collapsed — the same discipline `Override[]`/`StageChange[]`
       * (`ward-model.ts`) already hold to. There is no un-acknowledge event, on purpose: an
       * acknowledgement is a historical record of who looked at something, and unlike a completion
       * (below) there is nothing about it to undo.
       *
       * ⚠️ **CARRIES NO CATEGORY, AND CANNOT.** Which inbox rows are FACTS that only resolve
       * themselves and which are COMMITMENTS a human can finish is a clinical judgement this task
       * does not make (see this file's own module-level context, if one exists, or the task brief —
       * the classification is being decided separately). `inboxItemId` is `InboxItem.id`
       * (`ward-derivations.ts`), opaque here: nothing in this event or its reducer case inspects it
       * to decide what kind of row it names. Enforcing "this category may only ever be acknowledged,
       * never completed" belongs to whichever layer is handed that classification later.
       */
      type: "ACKNOWLEDGE_INBOX_ITEM";
      role: WardFlowRole;
      now: Instant;
      /** `InboxItem.id` (`ward-derivations.ts`) — opaque here, see the comment above. */
      inboxItemId: string;
    }
  | {
      /**
       * THE ROW GETS TICKED OFF — a human COMMITMENT is done (rang the ward, booked transport,
       * wrote the handover). Ward-lead task, 2026-09-06, alongside `ACKNOWLEDGE_INBOX_ITEM` above.
       *
       * ⚠️ **THIS EVENT DOES NOT TOUCH `movements` OR `units` EITHER — THE ONLY TWO INPUTS
       * `buildActionInbox` READS.** Completing a row records that a PERSON finished a task; it does
       * not and cannot change the underlying fact `buildActionInbox` computes from live state. If
       * that fact still holds the next time the inbox is built, the row reappears — ticking this off
       * is a statement about the human task, never a way to make the computation stop reporting.
       *
       * ⚠️ **UNDOABLE, AND THE REVERSAL (`REOPEN_INBOX_ITEM` below) IS ITSELF RECORDED, NEVER A
       * DELETE.** A completion recorded in error, or a commitment that turned out not to have
       * happened after all, must be correctable without erasing the fact that it was once marked
       * done — see `REOPEN_INBOX_ITEM`'s own doc comment and `InboxCompletionEntry`
       * (`ward-flow-reducer.ts`).
       *
       * Refused when the row is already complete — the same discipline `FLAG_MOVEMENT_URGENT`
       * refuses a second flag with: ticking an already-ticked box is not a new fact, and recording it
       * as one would double-count a single piece of work.
       *
       * Same "no hard-coded category" discipline as `ACKNOWLEDGE_INBOX_ITEM` above: `inboxItemId` is
       * opaque, and nothing here or in the reducer decides which rows may be completed at all.
       */
      type: "COMPLETE_INBOX_ITEM";
      role: WardFlowRole;
      now: Instant;
      /** `InboxItem.id` (`ward-derivations.ts`) — opaque here, see `ACKNOWLEDGE_INBOX_ITEM`'s comment. */
      inboxItemId: string;
    }
  | {
      /**
       * THE UNDO `COMPLETE_INBOX_ITEM` REQUIRES — a completion is one human's account of what they
       * did, and a human can be wrong or can act too soon. Mirrors
       * `FLAG_MOVEMENT_URGENT`/`CLEAR_MOVEMENT_URGENT_FLAG` and
       * `BLOCK_BED_RELEASE`/`CLEAR_BED_RELEASE_BLOCK`: a state that can only ever be SET is not a
       * real state, it is a one-way door with a flag painted on it.
       *
       * Appends its OWN entry to the same append-only history `COMPLETE_INBOX_ITEM` writes to
       * (`InboxCompletionEntry[]`, keyed by `inboxItemId` on `WardFlowState.inboxCompletions`)
       * rather than deleting the completion it reverses — the same discipline `STEP_BACK_STAGE`
       * holds to for `stageChanges` and `WITHDRAW_ACCEPTANCE` holds to for `acceptedAt`: correcting a
       * record is itself a recorded act, never a silent rewrite of history.
       *
       * Refused when the row is not currently complete — there is nothing to reopen, the same
       * precondition `CLEAR_MOVEMENT_URGENT_FLAG` checks before clearing a flag that was never set.
       *
       * Same role list as `COMPLETE_INBOX_ITEM` (see `EVENT_ROLE` below): whoever may tick a row off
       * may take that back, on the same reasoning `CLEAR_MOVEMENT_URGENT_FLAG`'s own comment gives
       * for why a clearing permission narrower than the raising one is how mistakes become
       * permanent.
       */
      type: "REOPEN_INBOX_ITEM";
      role: WardFlowRole;
      now: Instant;
      /** `InboxItem.id` (`ward-derivations.ts`) — opaque here, see `ACKNOWLEDGE_INBOX_ITEM`'s comment. */
      inboxItemId: string;
    }
  | {
      /**
       * Stream A, 9 Oct 2026: the acting role takes ownership of an inbox row. Recorded as the
       * role's label (`WARD_FLOW_ROLE_LABELS`), never a person. Append-only history on
       * `WardFlowState.inboxOwnership`; refused when the same role already owns the row.
       */
      type: "TAKE_INBOX_ITEM_OWNERSHIP";
      role: WardFlowRole;
      now: Instant;
      inboxItemId: string;
    }
  | {
      /**
       * Stream A, 9 Oct 2026: hides an inbox row from the active list until `until`, with a
       * reason from the closed `SNOOZE_REASONS` list. The row returns by itself when `until`
       * passes. An act-now (red) row may not be snoozed past `RED_ROW_SNOOZE_CAP_MINUTES`; the
       * reducer refuses it. Snoozing never resolves the fact behind the row.
       */
      type: "SNOOZE_INBOX_ITEM";
      role: WardFlowRole;
      now: Instant;
      inboxItemId: string;
      until: Instant;
      reason: InboxSnoozeReason;
    }
  | {
      /** The undo for `SNOOZE_INBOX_ITEM`: returns a snoozed row to the active list now. Recorded, never a delete. */
      type: "UNSNOOZE_INBOX_ITEM";
      role: WardFlowRole;
      now: Instant;
      inboxItemId: string;
    };
