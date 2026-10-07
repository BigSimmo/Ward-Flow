"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { usePrintableDisclosures } from "@/components/ward-management/use-printable-disclosures";

import {
  CoordinatorAccessDisclaimer,
  SyntheticFiguresDisclaimer,
} from "@/components/ward-management/statistics/statistics-disclaimers";
import type { StatisticsSection } from "@/components/ward-management/statistics/statistics-sections";
import { STATISTICS_HOME_HREF } from "@/components/ward-management/statistics/statistics-sections";

import styles from "./statistics-sections.module.css";
import thirdEditionStyles from "./statistics-section-frame-third-edition.module.css";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";

/**
 * THE CHROME EVERY STATISTICS SECTION PAGE CARRIES, WRITTEN ONCE.
 *
 * ⚠️ **The reason this is a component and not four copies: a reader can land on any one of these
 * pages directly.** The statistics home page states two things before it shows a figure — that
 * every figure in this prototype is invented, and that the coordinator framing is an intention
 * rather than an access control. A reader who follows a link straight to a section page never saw
 * either. Four hand-written copies of those two sentences would be four chances for one of them to
 * be edited, softened or dropped, and no test in this repository can see the difference between a
 * disclaimer that was reworded and one that was weakened.
 *
 * ⚠️ **THE SENTENCES THEMSELVES NOW LIVE IN `statistics-disclaimers.tsx` AND ARE NOT WRITTEN HERE.**
 * They were duplicated from `statistics-screen.tsx` when this frame was built, because Task 1 could
 * not edit that file, and within a day the two copies had diverged in both sentences. The fold was
 * not a delete-one-copy job — neither wording was true of both a page with figures and a page
 * without — so the shared module carries a third wording, true of both, and the reasoning for each
 * clause is recorded there rather than here. What stays here is the MARKUP and the STYLING: this
 * frame's own banner element, its own `data-testid`s, and its own CSS module, exactly as the other
 * ward modules keep theirs, each on its own root. (A count of those modules stood here until
 * 2026-09-01 and disagreed with the count in `statistics-disclaimers.tsx`, which is where the
 * correction and the measurement are recorded.)
 *
 * ⚠️ **`tests/ward-statistics-sections.dom.test.tsx` pins BOTH sentences whole**, not by substring.
 * Fix round 1 found the assertions matched only `"not real figures"` and `"There is no role check on
 * this route."`, so a fold that quietly dropped the rest of either sentence would have stayed green —
 * the exact failure the duplication note this replaces was written to prevent.
 *
 * ⚠️ **THIS FRAME ADDS NO CONTROLS.** The only interactive element the frame itself adds is the
 * link back to the hub, which navigates. It adds no filter, no date picker, no export and no
 * refresh — a control that looks like it would change the figures, on a page with no figures, would
 * be a promise the page cannot keep. `<Link>`, never a raw anchor, for internal navigation.
 *
 * ⚠️ **THE SCOPE IS THE FRAME'S OWN CONTENT, AND NAMING IT IS THE CORRECTION.** This read "NO
 * CONTROLS. The only interactive element HERE is the link back to the hub" until 2026-09-01, when
 * this frame still rendered `ClinicalRail` as its own first child, a couple of dozen lines below
 * this comment. `ClinicalRail` carried a menu button, an icon rail with an expand handler, a
 * sidebar with a collapse handler and a sheet — real controls, one of which mutated persisted UI
 * state. They were the navigation chrome every Ward Flow screen carried, none of them sat on this
 * page's own content and none could change a figure, which is the point the sentence was making.
 * An absolute stated over a scope the sentence never named is not that point, and it is the same
 * unearned "every/no" this surface has now been caught making four times.
 *
 * ⚠️ **TASK 8, 2026-09-11: THE RAIL'S FORMER PER-SCREEN MOUNT DESCRIBED ABOVE IS GONE.** It was a
 * layout SIBLING of `<main>` here, exactly like every other one of its ~26 call sites, not a
 * child this frame's own layout logic depended on — `.main`'s own `grid-column: 2` in
 * `statistics-sections.module.css` places it explicitly, so removing the sibling leaves the empty
 * first column collapsing to zero width rather than leaving `.main` stranded in it. The
 * third-edition shell (`shell/ward-rail.tsx`) now mounts once, in `src/app/mockups/ward-flow/
 * layout.tsx`, in its place.
 */
export function StatisticsSectionFrame({
  section,
  title,
  subtitle,
  testId,
  design,
  children,
}: {
  /** Which of the three named sections this page belongs to. Shown above the title. */
  section: StatisticsSection;
  /** The page's own heading. Defaults to the section's label, which is right for a section that
   *  has exactly one page; the per-unit pages pass the unit's own name instead. */
  title?: string;
  /** One line under the heading saying what this page is for. */
  subtitle: string;
  testId: string;
  /** Opts only this frame subtree into the third-edition token and presentation contract. */
  design?: "third-edition";
  children: ReactNode;
}) {
  const isThirdEdition = design === "third-edition";

  if (isThirdEdition) {
    return (
      <ThirdEditionFrame section={section} title={title} subtitle={subtitle} testId={testId}>
        {children}
      </ThirdEditionFrame>
    );
  }

  return (
    <div
      className={isThirdEdition ? `${styles.screen} ${thirdEditionStyles.screen}` : styles.screen}
      data-ward-design={design}
      data-testid={testId}
    >
      <main id="main-content" className={isThirdEdition ? `${styles.main} ${thirdEditionStyles.main}` : styles.main}>
        <div
          className={
            isThirdEdition
              ? `${styles.governanceBanner} ${thirdEditionStyles.governanceBanner}`
              : styles.governanceBanner
          }
          data-testid="ward-statistics-section-governance"
        >
          <p>
            <SyntheticFiguresDisclaimer />
          </p>
        </div>

        <Link
          href={STATISTICS_HOME_HREF}
          className={isThirdEdition ? `${styles.backLink} ${thirdEditionStyles.backLink}` : styles.backLink}
          data-testid="ward-statistics-section-back"
        >
          Back to statistics
        </Link>

        <header
          className={isThirdEdition ? `${styles.pageHeader} ${thirdEditionStyles.pageHeader}` : styles.pageHeader}
        >
          <p
            className={isThirdEdition ? `${styles.eyebrow} ${thirdEditionStyles.eyebrow}` : styles.eyebrow}
            data-testid="ward-statistics-section-eyebrow"
          >
            {section.label}
          </p>
          <h1 className={isThirdEdition ? `${styles.pageTitle} ${thirdEditionStyles.pageTitle}` : styles.pageTitle}>
            {title ?? section.label}
          </h1>
          <p
            className={
              isThirdEdition ? `${styles.pageSubtitle} ${thirdEditionStyles.pageSubtitle}` : styles.pageSubtitle
            }
          >
            {subtitle}
          </p>
        </header>

        {/* The access claim and the fact that nothing enforces it. The sentence is shared with the
            statistics home page; the reason it reads the way it does is in `statistics-disclaimers.tsx`. */}
        <p
          className={isThirdEdition ? `${styles.notice} ${thirdEditionStyles.notice}` : styles.notice}
          data-testid="ward-statistics-section-access"
        >
          <CoordinatorAccessDisclaimer />
        </p>

        {children}
        <WardPrototypeFooter testId="ward-statistics-section-footer" />
      </main>
    </div>
  );
}

function ThirdEditionFrame({
  section,
  title,
  subtitle,
  testId,
  children,
}: {
  section: StatisticsSection;
  title?: string;
  subtitle: string;
  testId: string;
  children: ReactNode;
}) {
  usePrintableDisclosures();

  return (
    <div
      className={`${styles.screen} ${thirdEditionStyles.screen}`}
      data-ward-design="third-edition"
      data-testid={testId}
    >
      <main id="main-content" className={`${styles.main} ${thirdEditionStyles.main}`}>
        <div className={thirdEditionStyles.executiveHeader}>
          <div className={thirdEditionStyles.topUtilityBar}>
            <Link
              href={STATISTICS_HOME_HREF}
              className={thirdEditionStyles.backLink}
              data-testid="ward-statistics-section-back"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className={thirdEditionStyles.backIcon}
              >
                <path d="M10 12L6 8l4-4" />
              </svg>
              <span>Back to statistics</span>
            </Link>

            <div className={thirdEditionStyles.contextBody} data-testid="ward-statistics-section-governance">
              <strong>Synthetic prototype</strong>
              <p>
                <SyntheticFiguresDisclaimer />
              </p>
              <p data-testid="ward-statistics-section-access">
                <CoordinatorAccessDisclaimer />
              </p>
              {subtitle && <p>{subtitle}</p>}
            </div>
          </div>

          <header className={thirdEditionStyles.semanticHeader}>
            <p
              className={thirdEditionStyles.eyebrowTag}
              data-testid="ward-statistics-section-eyebrow"
              hidden={!title || title === section.label}
            >
              {section.label}
            </p>
            <h1 className={thirdEditionStyles.headerTitle}>{title ?? section.label}</h1>
          </header>
        </div>
        {children}
        <WardPrototypeFooter testId="ward-statistics-section-footer" />
      </main>
    </div>
  );
}
