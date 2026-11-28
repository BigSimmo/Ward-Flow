"use client";

import type { ReactNode } from "react";
import { Ellipsis, LayoutGrid, List, SlidersHorizontal } from "lucide-react";

import { CountCircle, FolderTabs, Icon, Menu, Segmented, cx, folderTabClasses } from "@/components/wf";

import type { ServiceFilter, ViewMode } from "./ward-index";
import styles from "./ward-index.module.css";

/** All and the first three services fit a phone's tab row; the rest open from its More button. */
const PHONE_TABS = 4;

type ServiceItem = { id: ServiceFilter; label: string; count: number };

/**
 * Filters and the Cards or Table switch: at the right of All wards' service tabs, and at the right
 * of Capacity's page tabs on its Wards tab (area 3 item 1).
 */
export function WardDirectoryActions({
  isPhone,
  filtersOpen,
  onToggleFilters,
  filterCount,
  searching,
  view,
  onView,
  children,
}: {
  isPhone: boolean;
  filtersOpen: boolean;
  onToggleFilters: () => void;
  filterCount: number;
  searching: boolean;
  view: ViewMode;
  onView: (view: ViewMode) => void;
  /** Drawn between Filters and the view switch (the phone's More services). */
  children?: ReactNode;
}) {
  return (
    <div className={styles.tabActions}>
      <button
        type="button"
        className={cx(folderTabClasses.more, styles.tabControl)}
        aria-expanded={filtersOpen}
        aria-controls="ward-index-more-filters"
        aria-label={isPhone ? `Filters${filterCount > 0 ? `, ${filterCount} set` : ""}` : undefined}
        data-active={filterCount > 0 || searching ? "true" : undefined}
        onClick={onToggleFilters}
        data-testid="ward-index-filters-toggle"
      >
        <Icon icon={SlidersHorizontal} size={16} />
        {isPhone ? null : "Filters"}
        {filterCount > 0 ? <CountCircle n={filterCount} /> : null}
      </button>
      {children}
      {isPhone ? null : (
        <button
          type="button"
          className={cx(folderTabClasses.more, styles.tabControl)}
          // The words name the view it switches to, so it is an action, not a pressed toggle.
          onClick={() => onView(view === "table" ? "cards" : "table")}
          data-testid="ward-index-view-toggle"
        >
          <Icon icon={view === "table" ? LayoutGrid : List} size={16} />
          {view === "table" ? "Card view" : "Table view"}
        </button>
      )}
    </div>
  );
}

/**
 * All wards' tabs (page tops, Josh 9 Nov 2026): the health service choice as the page tabs, with
 * Filters and the view switch at the row's right end. On a phone a chosen service past the first
 * three joins the tabs while it is chosen.
 */
export function WardIndexTabs({
  isPhone,
  service,
  onService,
  serviceItems,
  filtersOpen,
  onToggleFilters,
  filterCount,
  searching,
  view,
  onView,
  pageSwitch,
}: {
  isPhone: boolean;
  service: ServiceFilter;
  onService: (service: ServiceFilter) => void;
  serviceItems: ServiceItem[];
  filtersOpen: boolean;
  onToggleFilters: () => void;
  /** Filters set behind the Filters button (status, cohort); the search is not counted. */
  filterCount: number;
  searching: boolean;
  view: ViewMode;
  onView: (view: ViewMode) => void;
  /** Find (mock-up, 26 Nov 2026): the page-level switch leads the row; the services follow as its filters. */
  pageSwitch?: ReactNode;
}) {
  // Find, phone: every service is a pill in the scrolling strip (no More menu), and Filters and the view
  // switch sit on the sheet in the "Every ward" line (ward-index.tsx).
  // Desktop (audit three #63, mock-up): the hero's "In use by service" band is the service picker, so the
  // tab row keeps only All and, while one is chosen, that service. The phone keeps every service tab (D-116).
  const tabItems =
    isPhone && pageSwitch === undefined
      ? serviceItems.filter((item, index) => index < PHONE_TABS || item.id === service)
      : !isPhone && pageSwitch === undefined
        ? serviceItems.filter((item) => item.id === "all" || item.id === service)
        : serviceItems;
  const overflowItems =
    isPhone && pageSwitch === undefined ? serviceItems.filter((item) => !tabItems.includes(item)) : [];
  // Find: Filters and the view switch end the service pills' row, not a row of their own.
  const actionsInServiceRow = pageSwitch !== undefined && !isPhone;
  const more = (
    <WardDirectoryActions
      isPhone={isPhone}
      filtersOpen={filtersOpen}
      onToggleFilters={onToggleFilters}
      filterCount={filterCount}
      searching={searching}
      view={view}
      onView={onView}
    >
      {overflowItems.length > 0 ? (
        <Menu
          label="More"
          align="end"
          items={overflowItems.map((item) => ({
            id: item.id,
            label: `${item.label} · ${item.count}`,
            onSelect: () => onService(item.id),
          }))}
          trigger={(props) => (
            <button
              type="button"
              {...props}
              className={cx(folderTabClasses.more, styles.tabControl)}
              aria-label="More"
              data-testid="ward-index-more-services"
            >
              <Icon icon={Ellipsis} size={16} />
            </button>
          )}
        />
      ) : null}
    </WardDirectoryActions>
  );
  return (
    <FolderTabs
      label="Wards by service"
      value={service}
      testId="ward-index-tabs"
      more={actionsInServiceRow || (isPhone && pageSwitch !== undefined) ? undefined : more}
    >
      {pageSwitch ? (
        <>
          {pageSwitch}
          {/* Find: the services take their own row under the tabs, so the tab row is not crowded. */}
          <div className={cx(folderTabClasses.filters, styles.findServices)}>
            <Segmented label="Health service" items={tabItems} value={service} onChange={onService} size="md" />
            {actionsInServiceRow ? <div className={styles.findActions}>{more}</div> : null}
          </div>
        </>
      ) : tabItems.length === 1 ? (
        // Audit three review: a lone All tab has nothing to switch to, so the row shows a plain count.
        <p className={styles.tabCount} data-testid="ward-index-tab-count">
          <b className={styles.num}>{tabItems[0].count}</b> wards
        </p>
      ) : (
        <Segmented
          className={folderTabClasses.switch}
          label="Health service"
          items={tabItems}
          value={service}
          onChange={onService}
          size="md"
        />
      )}
    </FolderTabs>
  );
}
