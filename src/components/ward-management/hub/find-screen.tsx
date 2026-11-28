"use client";

import { useState, type ReactNode } from "react";

import { CommunityIndex } from "@/components/ward-management/community/community-index";
import { EdIndex } from "@/components/ward-management/ed/ed-index";
import { PatientSearchPage } from "@/components/ward-management/search/patient-search";
import { WardIndex } from "@/components/ward-management/wards/ward-index";

import { useReportFindTab } from "./find-active-tab";
import { FindMemoryStrip, useFindMemoryUsed } from "./find-memory-strip";
import { FindHeroTabs, useFindTabs, type FindTab } from "./find-tabs";
import styles from "./find-screen.module.css";

/**
 * Find (mock-up, 26 Nov 2026): one page, five tabs, each the existing page as designed. The tab comes
 * from the address (the route reads `?tab=`); the words typed in a tab's search box are held here, in
 * memory, and handed to the next tab's box. They never go into the address: on People they can be a
 * person's name or UMRN (hard rule 1).
 */
export function FindScreen({ tab: requested }: { tab: FindTab }) {
  const tabs = useFindTabs();
  // A desk that may not open the asked-for tab lands on its first one.
  const tab = tabs.some((item) => item.id === requested) ? requested : (tabs[0]?.id ?? requested);
  const [query, setQuery] = useState("");
  useReportFindTab(tab);
  // The tabs, then Places' pinned and recently opened strip (hidden until used), on every tab.
  const memoryUsed = useFindMemoryUsed();
  const pageSwitch = <FindMemoryStrip />;
  const heroTabs = <FindHeroTabs value={tab} />;
  // Keyed by tab, so each page mounts fresh and reads the carried words once, as it opens.
  let page: ReactNode;
  switch (tab) {
    case "wards":
      page = (
        <WardIndex
          key="wards"
          pageSwitch={pageSwitch}
          heroTabs={heroTabs}
          initialQuery={query}
          onQueryChange={setQuery}
        />
      );
      break;
    case "eds":
      page = <EdIndex key="eds" pageSwitch={pageSwitch} heroTabs={heroTabs} />;
      break;
    case "teams":
    case "suburbs":
      page = (
        <CommunityIndex
          key={tab}
          findView={tab}
          pageSwitch={pageSwitch}
          heroTabs={heroTabs}
          findRow={memoryUsed}
          initialQuery={query}
          onQueryChange={setQuery}
        />
      );
      break;
    default:
      page = (
        <PatientSearchPage
          key="people"
          pageSwitch={pageSwitch}
          heroTabs={heroTabs}
          initialQuery={query}
          onQueryChange={setQuery}
        />
      );
  }
  return <div className={styles.frame}>{page}</div>;
}
