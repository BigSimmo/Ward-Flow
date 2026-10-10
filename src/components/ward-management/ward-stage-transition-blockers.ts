/**
 * WHAT THE REDUCER ITSELF WRITES INTO `Movement.blocker` WHEN A MOVEMENT'S SITUATION CHANGES.
 *
 * ⚠️ **`Movement.blocker` — the free-prose one. NOT `BedRelease.blocker`**, which is a
 * `BedReleaseBlocker` enum about a bed being freed and is written by `BLOCK_BED_RELEASE` /
 * `CLEAR_BED_RELEASE_BLOCK`. Two fields, one name; nothing here goes near the other.
 *
 * **Why the reducer writes anything at all.** Until 2026-09-01 this field was set once, at
 * creation, to `"Awaiting coordinator referral"`, and no transition ever touched it. That sentence
 * stopped being true the moment a coordinator referred, and it stayed on screen through
 * acceptance, transport and collection — the movement console renders it as **Response** and
 * **Current blocker**, so somebody chased a patient whose ambulance was already moving. A blocker
 * describing an earlier stage is wrong BY CONSTRUCTION, not merely out of date, so the reducer
 * restates it wherever it has just been told something the standing sentence CONTRADICTS.
 *
 * ⚠️ **THE PROPERTY IS "NEVER CONTRADICTED BY THE RECORD BESIDE IT", NOT "NEVER OLDER THAN THE
 * STAGE BESIDE IT"** — this comment claimed the second until 2026-09-01 and the code never held it.
 * `PULL_PATIENT` moves the stage to `pulled` and leaves `"Awaiting a bed at the accepting ward"`
 * standing, which falsifies the stage version outright; `HANDOVER_READY` does the same with
 * `"Awaiting a transport provider response"`. Both are CORRECT, and that is the point: a pull
 * allocates a bed without making one ready — the seed's own three `pulled` movements say "Awaiting
 * single-room clean", "Ward finalising bed clean" and "Escort provider organising secure
 * transport" — and a handover being ready does not make a provider answer. Neither event is told
 * anything that contradicts the sentence it inherits, so writing one there would overwrite a
 * ward's real observation with a vaguer machine one. The two transport legs below ARE told such a
 * thing (`acceptedAt`, then `enRouteAt`), which is why they restate and these two do not. State
 * the property that holds; do not restore the one that reads more strongly and is false.
 *
 * **What these sentences are allowed to be.** Restatements of what the model has been told, and
 * nothing more. `"Awaiting a bed at the accepting ward"` says the stage is `accepted_awaiting_bed`;
 * `"None — in transit"` says the patient has been collected. None of them invents a fact about a
 * ward, a person or a provider — the richer sentences the seed carries ("Awaiting single-room
 * clean", "Escort provider organising secure transport") are things only a human knows, and only
 * `RECORD_MOVEMENT_BLOCKER` may write those.
 *
 * ⚠️ **A HUMAN'S PROSE IS OVERWRITTEN BY THE NEXT TRANSITION, AND THAT IS THE DESIGN.** A ward
 * that recorded "Awaiting single-room clean" while the patient was pulled will see that replaced
 * when transport is booked. The situation genuinely changed; a note about the old one is exactly
 * the staleness this table exists to end. If it is still true, it is recorded again — the same way
 * a handover note is repeated at handover rather than assumed to still hold.
 *
 * ⚠️ **THE SEED IS NOT DERIVED FROM THIS TABLE AND MUST NOT BE.** The twenty-one hand-authored
 * values (`ward-movements.ts`) stay exactly as written; two of them sit at the same stage with
 * different words ("Transport escort confirming departure time" and "Awaiting transport escort",
 * both `handover_ready` with a transport job), which is direct evidence that a stage does NOT
 * determine this field. That is why deriving it was refused and why only these nine sentences are
 * ever written (across ten events — `didNotProceed` covers both closures that are not an arrival):
 * the points where the previous sentence is provably false, not merely possibly stale.
 *
 * `hasActiveBlocker` (ward-priority.ts) must recognise every "nothing is blocking" phrasing here
 * as inactive, or a settled movement scores ten points for an obstruction it does not have. The
 * three below all use the `"None — …"` shape it already matches.
 */
export const STAGE_TRANSITION_BLOCKERS = {
  /** `REFER_TO_UNITS`: referrals are live and nobody has answered yet. */
  referred: "Awaiting destination response",
  /** `ACCEPT_IN_PRINCIPLE`: a unit has accepted; the bed itself is what is outstanding. */
  accepted: "Awaiting a bed at the accepting ward",
  /** `BOOK_TRANSPORT`: a job exists and the provider has not accepted it. */
  transportBooked: "Awaiting a transport provider response",
  /** `CANCEL_TRANSPORT`, bed-held branch only — owner answer 30 (2026-09-17), build plan item 30:
   *  "no automatic rebooking; a person books again." The job is removed, not replaced, so this
   *  reads the fact the record now supports instead of `transportBooked` (false, the job is gone)
   *  or `accepted` (also false — the bed IS still held here, unlike the no-bed-held branch, which
   *  keeps writing `accepted`). An ACTIVE blocker: somebody still has to book again. */
  transportCancelled: "Transport cancelled; not booked again yet",
  /** `TRANSPORT_ACCEPTED`: the provider ANSWERED — `transport.acceptedAt` is set — and has not set
   *  off. Restates `acceptedAt` and nothing else: which provider and whether an escort was asked
   *  for are on the job itself and `transportStatusLabel` already renders them. */
  transportAccepted: "Awaiting the transport provider's departure",
  /** `TRANSPORT_EN_ROUTE`: `transport.enRouteAt` is set and `collectedAt` is not. The vehicle is
   *  moving and the patient is still where they were; an ACTIVE blocker, deliberately, because
   *  nobody has been collected yet — `collected` below is the first value that says otherwise. */
  transportEnRoute: "Awaiting collection — transport is en route",
  /** `PATIENT_COLLECTED`. One of the two "absence with its reason" values the seed already
   *  carries, reused verbatim rather than reworded — the fixture and the reducer must not describe
   *  one situation with two sentences. */
  collected: "None — in transit",
  /** `PATIENT_ARRIVED`. The seed's other absence-with-reason value, again verbatim. */
  arrived: "None — handover complete",
  /** `RECORD_EXAMINATION` and `WITHDRAW_REFERRAL`, the two closures that are not an arrival.
   *  Nothing is blocking because there is no longer anything to block. */
  didNotProceed: "None — the movement did not proceed",
  /**
   * `RECORD_EXAMINATION` (`community_order`/`revoked`) at `handover_ready` or `moving` — owner
   * ruling WLQ-4 (2026-09-15). Not "did not proceed": the movement is deliberately NOT closed at
   * these two stages, so this sentence describes an open, active situation rather than a settled
   * one, and it is the only value in this table written by an event that leaves the movement open.
   */
  examinationRevokedAwaitingRelease: "Awaiting a coordinator to release the bed, because the examination was revoked",
  /**
   * `WITHDRAW_WARD_REQUEST` (RA1, item 18), and only when it empties `referredUnitIds` — a
   * different active situation from `referred` above (which says referrals ARE live), so it is a
   * SECOND value rather than a restatement. `acceptedUnitId` is never set here (that is `accepted`'s
   * job), and the movement stays open — a coordinator must refer again before anyone is asked.
   * Deliberately not "None — …": something IS outstanding here (a fresh REFER_TO_UNITS), so
   * `hasActiveBlocker` (ward-priority.ts) must keep scoring it as active. Withdrawing one ward while
   * others stay live does not touch `blocker` at all — `referred` above is still true.
   */
  wardRequestWithdrawn: "No ward is being asked",
  /**
   * `STOP_TRANSPORT` — owner answer 8 (second round, 2026-09-17): *"A stop after collection keeps
   * the bed held until the coordinator, the ward or the referrer releases it."* Before this, a stop
   * gave the bed back automatically (the same `releasePulledBedAndAdmission` call `RELEASE_PULL`
   * uses) and wrote `didNotProceed`. That call is now skipped: the movement still closes
   * `did_not_proceed` (the journey itself is over), but `acceptedUnitId`/`admissionId` are left
   * exactly as they were, so the bed stays reserved. An ACTIVE blocker, deliberately not
   * "None — …": a decision is still outstanding (who releases it), even though the journey has
   * ended — `RELEASE_HELD_BED` is the event that clears it, and only it clears it.
   */
  transportStoppedAwaitingRelease:
    "Awaiting the coordinator, the ward or the referrer to release the bed, because transport was stopped",
  /**
   * `RECORD_DIVERSION` — build plan item 29 (T4a, 2026-09-17) / OA-29: a collected journey was
   * diverted; the bed stays held and the movement stays OPEN until `RELEASE_DIVERTED_BED`. An
   * ACTIVE blocker, deliberately not "None — …": a release decision is still outstanding.
   */
  divertedAwaitingRelease:
    "Awaiting the coordinator, the ward or the referrer to release the bed, because the patient was diverted",
} as const;
