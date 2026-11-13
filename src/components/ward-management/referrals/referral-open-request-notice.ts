/**
 * F-41 (A9-25 a): the referral form's "already open" notice, said whenever the chosen person already
 * has an open bed request, not only an open referral. A bed request raised at this same emergency
 * department used to pass with no notice and start a second, separate request; a request at another
 * department keeps its own "Already on an open ED movement at …" line.
 *
 * The referral form (the only file archived D-19 lets import `referral-duplicate`) passes its own
 * sentence in; the bed-request case reuses that same one sentence (`sameSentence`), so the notice
 * stays place-free, ward-free and count-free. The link opens the person's own page, as the accepted
 * referral case already does. The form passes that link in, so this file never reads the patient
 * link itself (D-14 default-deny guard).
 */
export function openRequestNotice(input: {
  /** The chosen person's own page (`patientHref`), or undefined while no person is chosen. */
  personHref: string | undefined;
  /** The form's archived D-19 sentence and its link, when an open referral was found. */
  referralNotice: { sentence: string | undefined; href: string | undefined };
  /** The one archived D-19 sentence, used for an open bed request too. */
  sameSentence: string;
  /** The person's open ED journey (`openEdJourneyFor`), if any. */
  openJourney: { movementId: string; siteCode: string } | undefined;
  /** The emergency department this form sends from. */
  originSiteCode: string;
  /** The journey this form was opened on, which is never a second request for itself. */
  liveMovementId: string | undefined;
}): { sentence: string; href: string } | undefined {
  const { personHref, referralNotice, openJourney } = input;
  if (!personHref) return undefined;
  if (referralNotice.sentence) {
    return { sentence: referralNotice.sentence, href: referralNotice.href ?? "/ward-flow/referrals" };
  }
  const sameDepartmentRequest =
    openJourney !== undefined &&
    openJourney.movementId !== input.liveMovementId &&
    openJourney.siteCode === input.originSiteCode;
  if (!sameDepartmentRequest) return undefined;
  return {
    sentence: input.sameSentence,
    href: personHref,
  };
}
