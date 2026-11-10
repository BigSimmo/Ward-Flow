"use client";

import { Ellipsis, LayoutGrid, List, SlidersHorizontal } from "lucide-react";

import { CountCircle, FolderTabs, Icon, Menu, Segmented, cx, folderTabClasses } from "@/components/wf";

import type { ServiceFilter, ViewMode } from "./ward-index";
import styles from "./ward-index.module.css";

/** All and the first three services fit a phone's tab row; the rest open from its More button. */
const PHONE_TABS = 4;

type ServiceItem = { id: ServiceFilter; label: string; count: number };

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
}) {
  const tabItems = isPhone
    ? serviceItems.filter((item, index) => index < PHONE_TABS || item.id === service)
    : serviceItems;
  const overflowItems = isPhone ? serviceItems.filter((item) => !tabItems.includes(item)) : [];
  return (
    <FolderTabs
      label="Wards by service"
      value={service}
      testId="ward-index-tabs"
      more={
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
          {overflowItems.length > 0 ? (
            <Menu
              label="More services"
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
                  aria-label="More services"
                  data-testid="ward-index-more-services"
                >
                  <Icon icon={Ellipsis} size={16} />
                </button>
              )}
            />
          ) : null}
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
      }
    >
      <Segmented
        className={folderTabClasses.switch}
        label="Health service"
        items={tabItems}
        value={service}
        onChange={onService}
        size="md"
      />
    </FolderTabs>
  );
}
