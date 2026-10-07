import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/mockups/ward-flow",
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { ReferralIntakeForm, UNANSWERED_VALUE } from "@/components/ward-management/referrals/referral-intake";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { REFERRAL_SOURCES } from "@/components/ward-management/ward-model";
import { allEmergencyDepartments } from "@/components/ward-management/ward-sites";

/**
 * THE INTAKE FORM READS THE QUERY CONTRACT — LANE C TASK 14.
 *
 * The contract is `RaiseReferralTarget` in `shell/ward-facade.ts`, built by `raiseReferralHref` and
 * by nothing else. **Lane C reads it; lanes A and B write it.** Until this task the form read
 * `patientId` and nothing else, so every link built through the facade landed on an empty form —
 * a well-formed link that arrives pre-filled with nothing, which the facade's own comment already
 * warned about in writing.
 *
 * 🔴 **THE CONTRACT'S FOUR PARAMETERS DO NOT ALL HAVE SOMEWHERE TO LAND, AND THAT IS MEASURED
 * RATHER THAN ASSUMED.**
 *
 *     patientId    → already read
 *     source       → the form's own `source` question. Model values (D-18).
 *     originEdId   → resolves through the ED's own `siteCode` to the form's ORIGIN SITE question
 *     teamId       → 🔴 NOWHERE. See the last case in this file.
 *
 * ⚠️ **`originEdId` IS NOT `edId`, AND CONFUSING THEM WOULD INVERT THE REFERRAL.** The contract
 * documents `originEdId` as *"the emergency department the person is being referred FROM"*. The
 * form's `edId` question is the DESTINATION — it renders only when the referrer has chosen an
 * emergency department under `destinationKinds`. **Prefilling `edId` from `originEdId` would
 * address the referral TO the department that sent it**, silently, on a clinical form, and every
 * existing suite would stay green.
 */

function renderWithQuery(query: Record<string, string>) {
  const search = new URLSearchParams(query).toString();
  window.history.replaceState({}, "", `/mockups/ward-flow/referrals/new?${search}`);
  return render(
    <WardFlowProvider>
      <ReferralIntakeForm />
    </WardFlowProvider>,
  );
}

/**
 * v6 (7 Oct 2026): Age band and Sex are segmented radio groups, named by their visible label like
 * the selects. These read and answer either kind by that same name.
 */
function answerOf(label: RegExp): string {
  const control = screen.getByLabelText(label);
  if (control instanceof HTMLSelectElement) return control.value;
  const checked = control.querySelector<HTMLInputElement>('input[type="radio"]:checked');
  return checked?.value ?? UNANSWERED_VALUE;
}

function choose(label: RegExp, value: string) {
  const control = screen.getByLabelText(label);
  if (control instanceof HTMLSelectElement) {
    fireEvent.change(control, { target: { value } });
    return;
  }
  const radio = control.querySelector<HTMLInputElement>(`input[type="radio"][value="${value}"]`);
  expect(radio, `no "${value}" answer`).not.toBeNull();
  fireEvent.click(radio!);
}

describe("the intake form reads the query contract", () => {
  /** The anti-vacuity floor: every case below depends on these two populations being real. */
  it("has real sources and real emergency departments to prefill from", () => {
    expect(REFERRAL_SOURCES.length, "no referral sources — these cases would prove nothing").toBeGreaterThan(3);
    expect(allEmergencyDepartments().length, "no emergency departments in the seed").toBeGreaterThan(0);
  });

  /**
   * ⚠️ **EVERY SOURCE THE MODEL HAS, NOT A HAND-PICKED TWO.** A prefill that works for the two the
   * menu currently offers and silently does nothing for the other five passes any test that only
   * tries the two — and the menu's membership is a product decision that changes.
   */
  it.each(REFERRAL_SOURCES.map((source) => [source] as const))("prefills source=%s", (source) => {
    renderWithQuery({ source });
    expect(screen.getByLabelText(/referral source/i)).toHaveValue(source);
  });

  /**
   * 🔴 AN UNRECOGNISED SOURCE LEAVES THE QUESTION UNANSWERED — IT NEVER MAPS ONTO A DEFAULT.
   *
   * A default here is a definite clinical answer nobody gave, which is the defect `UNANSWERED_VALUE`
   * exists to prevent.
   *
   * ⚠️ **`gp` MOVED OUT OF THIS LIST, OWNER ANSWER 25 (2026-09-17).** It used to be the specimen
   * here — a live menu entry on six routes until 2026-09-11 while never a member of
   * `REFERRAL_SOURCES`, surviving because the menu never consulted the real list. The owner has
   * since ruled, verbatim: *"GP referrals: the GP is told by phone or letter for now; add 'GP' as
   * a referral source."* `gp` is now a real `REFERRAL_SOURCES` member and prefills like any other
   * — see the `it.each(REFERRAL_SOURCES...)` case above — so it belongs there, not here. `"ed"`
   * stays: it was never a real source (`"ed_medical"` is) and still is not one; no menu entry ever
   * offers a bare `gp` either, so this case is exercised only by an old link, a bookmark or a
   * pasted URL, same as `"ed"` and `"not-a-source"`.
   */
  it.each([["ed"], ["not-a-source"], [""]])("leaves source unanswered for %s", (source) => {
    renderWithQuery({ source });

    /*
     * 🔴 THE RENDERED SELECT IS NOT THE ASSERTION, AND MY FIRST DRAFT MADE IT ONE. A mutation that
     * deleted the membership check entirely SURVIVED all sixteen cases.
     *
     * The reason is the select's own markup: `UNANSWERED_VALUE` is its FIRST option, and a
     * controlled `<select>` whose value matches no option falls back to the first. **So an
     * unvalidated `gp` renders as "Choose one" whether or not anything validated it** — the DOM
     * masks the defect perfectly.
     *
     * ⚠️ AND THE DRAFT WOULD STILL HOLD `gp`. Invisible on screen, carried into the submission, and
     * refused by the reducer — which validates against `REFERRAL_SOURCES` — leaving a referrer
     * staring at a rejection naming a source they never chose and cannot see on the form.
     *
     * So the assertion is that the question is genuinely OUTSTANDING: it appears in the Send
     * button's own reason, which is computed from `fieldIsUnanswered` over the draft rather than
     * from anything rendered.
     */
    expect(screen.getByTestId("ward-referral-intake-unavailable").textContent).toContain("Referral source");
  });

  /**
   * `originEdId` names an emergency department; the form asks for the ORIGIN SITE. The ED carries
   * its own `siteCode`, so the resolution is a lookup rather than a guess — and an id that resolves
   * to nothing leaves the question unanswered rather than picking a site.
   */
  it("prefills the origin site from the emergency department the person was referred from", () => {
    const department = allEmergencyDepartments()[0]!;
    renderWithQuery({ source: "ed_medical", originEdId: department.id });
    expect(screen.getByLabelText(/origin site/i)).toHaveValue(department.siteCode);
  });

  it("leaves the origin site unanswered for an emergency department id that names nothing", () => {
    renderWithQuery({ source: "ed_medical", originEdId: "ED-does-not-exist" });
    /*
     * 🔴 THE SAME MASKING AS THE SOURCE CASES ABOVE, AND I FIXED ONE FIELD AND NOT ITS SIBLING.
     *
     * `"ED-does-not-exist"` is not a member of the origin-site select's option list either, so a
     * `prefilledOriginSite` that stopped resolving the id and passed it straight through would
     * render as "Choose one" exactly as a correct refusal does. The sibling case above (a valid id
     * prefilling a real site) kills a wholesale deletion of the resolver, but NOT the narrower
     * "stop checking existence" mutation — that one needs the draft.
     */
    expect(screen.getByTestId("ward-referral-intake-unavailable").textContent).toContain("Origin site");
    expect(screen.getByLabelText(/origin site/i)).toHaveValue(UNANSWERED_VALUE);
  });

  /**
   * 🔴 **`originEdId` MUST NOT REACH THE DESTINATION QUESTION.** The destination ED control only
   * renders once the referrer chooses an emergency department as a destination; arriving with an
   * origin must not choose one for them, and must not answer it if they do.
   */
  it("never treats the origin department as a destination", () => {
    const department = allEmergencyDepartments()[0]!;
    renderWithQuery({ source: "ed_medical", originEdId: department.id });
    // The destination ED question is not even asked yet — nothing has chosen a destination kind.
    expect(screen.queryByLabelText(/which emergency department/i)).not.toBeInTheDocument();
  });

  /**
   * 🔴 **`teamId` IS ACCEPTED BY THE CONTRACT AND HAS NOWHERE TO LAND. THIS CASE RECORDS THAT.**
   *
   * The contract documents it as *"the community team the person is being referred FROM"*. The form
   * asks for an ORIGIN SITE, and `wardSites` are hospitals — **a community team is not one**. There
   * is no question on this form that a team id answers.
   *
   * ⚠️ **THE MODEL GAP THIS PARAGRAPH DESCRIBED IS CLOSED AS OF 2026-09-12 — `e00718f281`.** It
   * said a referral records the hospital it came from and never the community team. The owner was
   * asked directly and answered *"Yes it should"*, so `Referral.sendingTeamName` now exists.
   *
   * 🔴 **THE CASE BELOW IS UNAFFECTED AND ITS REFUSAL IS SHARPER, WHICH IS WHY THIS IS REWRITTEN
   * RATHER THAN DELETED.** What the model gained is a NAME. `teamId` is an **ID**, and this
   * application still holds no registry to mint one from — so the query parameter is not a value
   * with nowhere to land any more, it is a value of the one KIND the model refuses to hold.
   *
   * ⚠️ **This sentence outlived its own correction by an hour.** The same claim was fixed in
   * `referral-intake.tsx` and this copy was not swept for — a retraction that does not travel gets
   * read back as current by whoever opens the other file.
   *
   * **So `teamId` is deliberately not consumed, and the form must not invent a landing place for
   * it.** This case fails if somebody makes it prefill something — which would be a guess about
   * where a referral came from, on the screen where guessing that is exactly what
   * `referralReferrer` refuses to do.
   */
  it("does not consume teamId, because the form has no question a team id answers", () => {
    renderWithQuery({ source: "community", teamId: "CT-07" });
    /*
     * 🔴 BOTH OF THIS CASE'S ORIGINAL ASSERTIONS WERE SATISFIED BY THE DEFECT THEY GUARD AGAINST.
     *
     * A field-mapping slip that wrote `teamId` into the origin-site slot would set the draft to
     * `"CT-07"`. That is not a member of the site-code option list, so the select falls back to its
     * first option and reads as `UNANSWERED_VALUE` — satisfying the first assertion. And because
     * nothing then DISPLAYS the string anywhere, `queryByDisplayValue("CT-07")` finds nothing —
     * satisfying the second. ⚠️ **Two assertions, both green, with the id swallowed into state.**
     * A second assertion is not a second kind of evidence when both read the rendering.
     */
    expect(screen.getByTestId("ward-referral-intake-unavailable").textContent).toContain("Origin site");
    expect(screen.getByLabelText(/origin site/i)).toHaveValue(UNANSWERED_VALUE);
    expect(screen.queryByDisplayValue("CT-07")).not.toBeInTheDocument();
  });

  /** A form opened with no query at all still opens, with every question unanswered. */
  it("opens with everything unanswered when the link carries no contract at all", () => {
    renderWithQuery({});
    expect(screen.getByLabelText(/referral source/i)).toHaveValue(UNANSWERED_VALUE);
    expect(screen.getByLabelText(/origin site/i)).toHaveValue(UNANSWERED_VALUE);
    expect(answerOf(/^age band$/i)).toBe(UNANSWERED_VALUE);
    expect(answerOf(/^sex$/i)).toBe(UNANSWERED_VALUE);
    expect(screen.getByTestId("ward-referral-intake-gender")).toHaveValue(UNANSWERED_VALUE);
    expect(screen.getByLabelText(/^suburb$/i)).toHaveValue(UNANSWERED_VALUE);
  });

  it("prefills only compatible facts already held on the linked patient record and labels them editable", () => {
    renderWithQuery({ patientId: "PT-001" });

    expect(answerOf(/^age band$/i)).toBe(UNANSWERED_VALUE);
    expect(answerOf(/^sex$/i)).toBe("Female");
    // T11 (item 8): PT-001 carries `gender: "Female"` on the patient record — a SEPARATE fact
    // from `sex` above, prefilled from `Patient.gender`, never from `Patient.sex`.
    expect(screen.getByTestId("ward-referral-intake-gender")).toHaveValue("Female");
    expect(screen.getByLabelText(/^suburb$/i)).toHaveValue("Ashfield");
    expect(screen.getByLabelText(/^home region$/i)).toHaveValue(UNANSWERED_VALUE);
    expect(screen.queryByTestId("ward-referral-intake-ageBand-source")).not.toBeInTheDocument();
    expect(screen.getByTestId("ward-referral-intake-sex-source")).toHaveTextContent(/patient record.*editable/i);
    expect(screen.getByTestId("ward-referral-intake-gender-source")).toHaveTextContent(/patient record.*editable/i);
    expect(screen.getByTestId("ward-referral-intake-suburb-source")).toHaveTextContent(/patient record.*editable/i);
  });

  it("never answers gender from sex: a recorded sex prefills sex only, and gender stays unanswered", () => {
    renderWithQuery({ patientId: "PT-007" });

    expect(answerOf(/^age band$/i)).toBe(UNANSWERED_VALUE);
    // R7 (owner ruling, 2026-09-25): PT-007's record holds sex "Female" and NO gender. Sex prefills
    // from the record; the GENDER question stays genuinely unchosen (blocks "Raise referral"), never
    // answered from sex and never pre-answered "not yet recorded" on the clinician's behalf.
    expect(answerOf(/^sex$/i)).toBe("Female");
    expect(screen.getByTestId("ward-referral-intake-sex-source")).toHaveTextContent(/patient record.*editable/i);
    expect(screen.getByTestId("ward-referral-intake-gender")).toHaveValue(UNANSWERED_VALUE);
    expect(screen.queryByTestId("ward-referral-intake-gender-source")).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^suburb$/i)).toHaveValue("Como");
  });

  it("does not reapply linked-record defaults over the clinician's edits when the query changes", () => {
    const rendered = renderWithQuery({ patientId: "PT-001" });
    choose(/^age band$/i, "Youth");
    choose(/^sex$/i, "Male");
    fireEvent.change(screen.getByLabelText(/^suburb$/i), { target: { value: "Bassendean" } });
    fireEvent.change(screen.getByLabelText(/referral source/i), { target: { value: "ambulance" } });

    window.history.replaceState({}, "", "/mockups/ward-flow/referrals/new?patientId=PT-001&source=police");
    rendered.rerender(
      <WardFlowProvider>
        <ReferralIntakeForm />
      </WardFlowProvider>,
    );

    expect(answerOf(/^age band$/i)).toBe("Youth");
    expect(answerOf(/^sex$/i)).toBe("Male");
    expect(screen.getByLabelText(/^suburb$/i)).toHaveValue("Bassendean");
    expect(screen.getByLabelText(/referral source/i)).toHaveValue("ambulance");
  });

  it("starts a fresh linked draft when the patient changes", async () => {
    const rendered = renderWithQuery({ patientId: "PT-001" });
    expect(answerOf(/^sex$/i)).toBe("Female");
    expect(screen.getByLabelText(/^suburb$/i)).toHaveValue("Ashfield");
    // v6: a segmented answer cannot be cleared, so the clinician's edit is a different answer.
    choose(/^sex$/i, "Another term");
    fireEvent.change(screen.getByLabelText(/^suburb$/i), { target: { value: UNANSWERED_VALUE } });

    window.history.replaceState({}, "", "/mockups/ward-flow/referrals/new?patientId=PT-002");
    rendered.rerender(
      <WardFlowProvider>
        <ReferralIntakeForm />
      </WardFlowProvider>,
    );

    await waitFor(() => {
      expect(answerOf(/^sex$/i)).toBe("Male");
      expect(screen.getByLabelText(/^suburb$/i)).toHaveValue("Bassendean");
    });
    expect(screen.getByLabelText(/^home region$/i)).toHaveValue(UNANSWERED_VALUE);
  });
});
