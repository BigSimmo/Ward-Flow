/**
 * Ward Flow design-system primitives (`src/components/wf`). Build every page from these; never copy a primitive into a screen.
 * Contract: `design/v9/design-system-v9.md` (Sections 8–14). Tokens: `src/app/ward-flow-v9-tokens.css`.
 */
export { cx } from "./cx";
export { dur, durMinutes, clk } from "./format";
export { guessPhoneFromRequest, guessTabletFromRequest } from "./phone-guess";
export {
  WfServerPhoneProvider,
  useIsPhone,
  useIsTabletLandscape,
  useIsTabletPortrait,
  useMediaQuery,
  WF_PHONE_QUERY,
  WF_TABLET_LANDSCAPE_QUERY,
  WF_TABLET_PORTRAIT_QUERY,
} from "./use-is-phone";
export { StatusGlyph, Dot, type WfTone } from "./status-glyph";
export { Icon } from "./icon";
export { SrOnly, Kbd, Count, CountBubble, CountCircle, Spinner, IconTile } from "./primitives";
export { Button, DisabledReason, buttonClass, type ButtonSize } from "./button";
export { Badge } from "./badge";
export { Card, CardHead, CardBody, CardFoot } from "./card";
export { Hero, HeroStat } from "./hero";
export { useWfBandActive, useWfBandBleed, registerWfBandHero, WF_BAND_SCROLLED_PX } from "./band";
export {
  CheckingFoot,
  Frac,
  StepsDots,
  OccupancyRing,
  WardCapacityRow,
  WardCapacityRows,
  GroupHead,
  SinceYouLooked,
  type CheckingItem,
  type SinceItem,
} from "./v10-parts";
export {
  HeroChip,
  HeroChips,
  FactGrid,
  StatusPill,
  rowDim,
  TimeRail,
  JourneyStrip,
  type JourneyStage,
} from "./v10-pass2";
export { RowSpark, RowTrend, trendDelta, DeltaTwin } from "./v10-pass4";
export { Meter, StackBar, Legend, type WfFill, type StackSegment, type LegendItem } from "./stat";
export {
  Tabs,
  PillTabs,
  TabPanel,
  Segmented,
  HeroTrack,
  FilterChip,
  AppliedFilter,
  ChipGroup,
  type ChoiceItem,
} from "./choice";
export { DataRow, TierTile, tableClasses } from "./table";
export { Sheet, Drawer } from "./sheet";
export { Menu, Popover, type MenuItem } from "./menu";
export { ToastView } from "./toast";
export { Dialog } from "./dialog";
export { OverlayPortal, OverlayScope } from "./overlay-root";
export { useModalFocus, type UseModalFocusOptions } from "./use-modal-focus";
export { StateLine, type StateKind } from "./state";
export { ToastDeviceSaveContext, ToastProvider, useOptionalToast, useToast, type ToastInput } from "./toast-provider";
export { LiveChip, Timer, publishLiveClock, publishLiveRefresh, useSharedRefreshLate } from "./live";
export {
  Field,
  TextInput,
  Textarea,
  Select,
  Checkbox,
  Radio,
  Switch,
  Stepper,
  ErrorSummary,
  type ErrorSummaryItem,
} from "./form";
export { Timeline, Avatar, EmptyState, StatusLine, type TimelineItem } from "./feed";
export { BarList, ColumnChart, Donut, type BarListRow } from "./chart";
export {
  PhoneSheet,
  PhoneFilterFold,
  PhoneTabBar,
  PhoneListRow,
  PhoneHero,
  ScrollRow,
  PHONE_TAB_LIMIT,
  PHONE_HERO_FIGURE_LIMIT,
  type PhoneRowAction,
} from "./phone";
export { PortraitList, PortraitRail, type PortraitGroup } from "./portrait";

export { RadioGroup } from "./radio-group";
// Kit standard (lane C, from the #1118 mock-ups; Josh, 30-31 October 2026).
export { ShowMoreRow } from "./show-more-row";
export { SearchField, type SearchFieldProps } from "./search-field";
export { TimePresets, timePresetClockText } from "./time-presets";
export { phoneRows } from "./phone-rows";
export { ConfirmHost, hasConfirmHost, requestConfirm, type ConfirmRequest } from "./confirm-dialog";
export { DateField, isoDateAsTyped, parseTypedDate, type DateFieldProps } from "./date-field";
