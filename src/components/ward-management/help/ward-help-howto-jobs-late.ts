/**
 * The later desk jobs in `JOBS` (`ward-help-howto.ts`), kept in their own file to stay under the line
 * limit. Listed in the same order, so search finds them exactly as before.
 */
import type { HowTo } from "./ward-help-howto";
import { deskOpens, EVERY_LOGIN } from "./ward-help-access";
import { EVERY_DESK, CLINICAL_DESKS, setting, tid } from "./ward-help-howto-targets";

export const LATE_JOBS: readonly HowTo[] = [
  {
    id: "alerts-log",
    topic: "Finding your way",
    title: "Find an alert I already cleared",
    keywords: "alerts log history cleared earlier past filter acknowledged",
    answer:
      "Open the Alerts page. Open is what still needs someone, with chips to show one kind at a time. Cleared lists what was acted on this session, newest first. Broadcasts holds bed calls, live and past.",
    desks: EVERY_DESK,
    needs: "alerts",
    go: "alerts",
    showMe: [
      {
        target: [
          { sel: '[data-testid="ward-alerts-filters"]' },
          { sel: '[role="tablist"][aria-label="Alerts views"]' },
        ],
        title: "Open, Cleared and Broadcasts",
        body: "Chips show one kind of open alert at a time. Cleared, beside Open, lists what was acted on this session.",
      },
      {
        target: { sel: '#main-content [role="tab"], #main-content button', text: "Cleared" },
        title: "Cleared",
        body: "What was acted on this session, newest first. Open one to see the record.",
      },
      {
        target: { sel: '#main-content [role="tab"], #main-content button', text: "Broadcasts" },
        title: "Broadcasts",
        body: "Bed calls sent to wards, live and past.",
      },
    ],
  },
  {
    id: "search-patient",
    topic: "Finding your way",
    title: "Find a patient",
    keywords: "search patient name umrn look up lookup",
    answer:
      "Type a name or UMRN in the header search. / or Ctrl+K jumps there on a keyboard. Results show as you type; choose one to open the patient. Questions such as no bed yet also work.",
    desks: CLINICAL_DESKS,
    needs: "search",
    showMe: [
      {
        target: { sel: '[data-testid="ward-global-search-input"]' },
        title: "Search",
        body: "Names, UMRNs, places and a few common questions.",
      },
      {
        target: [{ sel: '[data-testid="ward-global-search"] [role="listbox"]' }, tid("ward-global-search")],
        title: "Choose a result",
        body: "Results show as you type. Choose one to open the patient's page.",
      },
    ],
  },
  {
    id: "patient-safety-facts",
    topic: "Finding your way",
    title: "Check a patient's legal status and risk",
    keywords: "legal form observation obs risk flags alert interpreter diagnosis patient page band",
    answer:
      "Open the patient. The band at the top shows Legal, Obs and Risk, and Alerts when there is one. Legal opens the forms. Risk flags come from the referral, with its date. The working diagnosis is under Details.",
    desks: CLINICAL_DESKS,
    needs: "search",
    showMe: [
      {
        target: [tid("ward-patient-glance"), tid("ward-global-search-input")],
        title: "Safety at a glance",
        body: "On the patient's page. Find the patient with the header search first.",
      },
      {
        target: tid("ward-patient-glance-legal"),
        title: "Legal",
        body: "The legal status and form in force, as recorded. Press it to open the forms.",
      },
      {
        target: tid("ward-patient-glance-obs"),
        title: "Obs",
        body: "The observation level recorded for the patient.",
      },
      {
        target: tid("ward-patient-glance-risk"),
        title: "Risk",
        body: "Risk flags from the referral, with its date.",
      },
      {
        target: [{ sel: "#pntab-details" }, tid("ward-patient-tabs")],
        title: "Details",
        body: "The working diagnosis, interpreter and other details.",
      },
    ],
  },
  {
    id: "pin-ward",
    topic: "Finding your way",
    title: "Pin a ward to my menu",
    keywords: "pin favourite my wards shortcut",
    answer: "Open the ward, then in the side menu choose Pin this ward. It stays under My wards on this device.",
    desks: ["coordinator", "bed_manager"],
    go: "wards",
    showMe: [
      {
        target: { sel: '#main-content a[href^="/bedchart/ward/"]' },
        title: "Open the ward",
        body: "Open the ward you want from the list.",
      },
      {
        target: [{ sel: '[data-testid="ward-my-wards-pin"]' }, { sel: '[data-testid="ward-bar-phone-menu"]' }],
        title: "Pin this ward",
        body: "In the side menu, under My wards (in Menu on a phone). It stays pinned on this device.",
      },
    ],
  },
  {
    id: "theme",
    topic: "Settings and display",
    title: "Use dark mode or the bright light theme",
    keywords: "dark light night glare bright theme colour appearance",
    answer:
      "Settings, Display, Theme: Auto, Light, Dark or Bright light (for a bright room). Auto follows this device. High contrast, in the same section, gives stronger edges and ink. Both change this device only and save at once.",
    desks: EVERY_DESK,
    go: "settings#display",
    showMe: [
      {
        target: setting("theme", "display"),
        title: "Theme",
        body: "In Settings, Display. It saves at once, on this device only.",
      },
      {
        target: [{ sel: '[data-setting="theme"] [role="radiogroup"]' }, setting("theme", "display")],
        title: "Choose a theme",
        body: "Auto follows this device's own setting. Bright light is for a bright room, such as a sunny window.",
      },
      {
        target: setting("high-contrast", "display"),
        title: "High contrast",
        body: "Stronger edges and ink, if text is hard to read in any theme.",
      },
    ],
  },
  {
    id: "density",
    topic: "Settings and display",
    title: "Fit more rows on screen",
    keywords: "compact density smaller rows more on screen",
    answer: "Settings, Display, Row density: Compact fits more rows on each screen. It changes this device only.",
    desks: EVERY_DESK,
    go: "settings#display",
    showMe: [
      {
        target: setting("density", "display"),
        title: "Row density",
        body: "In Settings, Display: Comfortable or Compact.",
      },
      {
        target: [{ sel: '[data-setting="density"] [role="radiogroup"]' }, setting("density", "display")],
        title: "Choose Compact",
        body: "Compact fits more rows on each screen. It saves at once, on this device only.",
      },
    ],
  },
  {
    id: "notifications",
    topic: "Settings and display",
    title: "Get alerts when I am on another screen",
    keywords: "notifications browser phone push alert notify lock screen",
    answer:
      "Settings, Alerts: turn on Alerts on this device. It covers this browser, and your phone where it can, for act-now alerts. Due soon too adds amber ones. Quiet hours holds other alerts overnight; act now always comes through. Will alerts reach you here? counts the ways that are ready, and Send a test alert tries one.",
    desks: EVERY_DESK,
    needs: "alerts",
    go: "settings#alerts",
    showMe: [
      {
        device: "desk",
        target: setting("device-alerts", "alerts"),
        title: "Alerts on this device",
        body: "In Settings, Alerts. One switch for this browser and, where it can, your phone.",
      },
      {
        // The phone keeps one step: its Alerts sheet lists the other switches under this one.
        device: "phone",
        target: setting("device-alerts", "alerts"),
        title: "Alerts on this device",
        body: "One switch for this phone's alerts. Below it: Due soon too, Quiet hours, Will alerts reach you here? and Send a test alert.",
      },
      {
        device: "desk",
        target: setting("alerts-due-soon", "alerts"),
        title: "Due soon too",
        body: "Adds amber alerts as well as act now.",
      },
      {
        device: "desk",
        target: setting("alerts-staff-requests", "alerts"),
        title: "Staff requests",
        body: "Alerts you when a ward logs that it needs more staff.",
      },
      {
        device: "desk",
        target: setting("alerts-quiet-hours", "alerts"),
        title: "Quiet hours",
        body: "Holds other alerts overnight, in the quiet window you set. Act now always comes through.",
      },
      {
        device: "desk",
        target: [tid("ward-settings-alerts-check"), setting("alerts-check", "alerts")],
        title: "Will alerts reach you here?",
        body: "Counts the ways alerts can reach this device and says what to do next.",
      },
      {
        device: "desk",
        target: setting("test-alert", "alerts"),
        title: "Send a test alert",
        body: "Sends one test alert to this device, so you know it works before you need it.",
      },
    ],
  },
  {
    id: "buzz",
    topic: "Settings and display",
    title: "Turn the buzz sound on or off",
    keywords: "sound chime audio noise mute buzz",
    answer:
      "Settings, Alerts, Buzz sound: switch it on or off. It plays a chime on an urgent buzz. On a computer, press Test to hear it. It changes this device only.",
    desks: EVERY_DESK,
    needs: "alerts",
    go: "settings#alerts",
    showMe: [
      {
        target: setting("buzz", "alerts"),
        title: "Buzz sound",
        body: "In Settings, Alerts. A chime on an urgent buzz.",
      },
      {
        device: "desk",
        target: [{ sel: '[data-setting="buzz"] button', text: "Test" }, setting("buzz", "alerts")],
        title: "Test",
        body: "Plays the chime now, so you can check the volume.",
      },
      {
        target: [tid("ward-settings-alerts-check"), setting("alerts-check", "alerts")],
        title: "Will alerts reach you here?",
        body: "Counts the buzz as one of the ways alerts reach this device.",
      },
    ],
  },
  {
    id: "rules",
    topic: "Settings and display",
    title: "Change the pull time limit or ED target",
    keywords: "rules settings pull time limit ed target wards asked morning count warning surge",
    answer:
      "Only the statewide coordinator may change global settings. In Settings, Rules, change the value, then press Save and check the review before it saves. Each save is recorded in the audit and changes what every screen shows. Timing set: Surge switches the timings to the busy-day set.",
    desks: ["coordinator"],
    acts: ["SET_CONFIGURATION"],
    requiresWholeNetwork: true,
    go: "settings#rules",
    showMe: [
      {
        target: setting("pull-hold", "rules"),
        title: "Pull time limit",
        body: "In Settings, Rules. How long a pulled bed is kept for the patient.",
      },
      {
        target: setting("ed-target", "rules"),
        title: "ED wait target",
        body: "In Settings, Rules. An access measure only.",
      },
      {
        target: setting("surge", "rules"),
        title: "Timing set",
        body: "Standard or Surge. The card says which rules Surge moves, and to what.",
      },
      {
        target: [tid("btn-save-draft"), tid("ward-settings-save-bar")],
        title: "Changes wait for Save",
        body: "Nothing applies until you save. Once a rule changes, Save shows how many changes wait.",
      },
      {
        target: [tid("ward-settings-review"), tid("ward-settings-save-bar")],
        title: "Check, then save",
        body: "Save lists each change, old value to new. Press Save change to apply it to every screen.",
      },
      {
        target: [tid("ward-settings-recent-changes"), setting("recent-changes", "rules")],
        title: "Recent changes",
        body: "The last save, who made it and what moved.",
      },
    ],
  },
  {
    id: "mha-times",
    topic: "Handover and reports",
    title: "How form times and warnings work",
    keywords: "mha legal form time expiry due calculate detention",
    answer:
      "Type each form time from the paper form. BedChart shows that time and warns before it, using the form warnings in Settings.",
    desks: EVERY_DESK,
  },
  {
    id: "undo",
    topic: "Finding your way",
    title: "Undo something I just did",
    keywords: "undo mistake wrong reverse back",
    answer:
      "Many saves show Undo in the message at the foot of the screen, and Undo works until the time shown (up to 5 minutes). After that, change the record back yourself; the history keeps both. Undo on Arrived can reverse a recent arrival if the usual checks pass. If the person really has gone back, record that as its own step.",
    desks: EVERY_DESK,
  },
  {
    id: "downtime",
    topic: "Handover and reports",
    title: "What to do if BedChart is down",
    keywords: "down offline outage paper downtime not working broken support help",
    answer:
      "Switch to the paper process. The downtime pack on Handover prints what you need; print it before you need it. The app shows when it last saved, and says so when it is offline.",
    desks: EVERY_DESK,
    go: "handover",
    computerOnly: true,
    showMe: [
      {
        target: { sel: '#main-content a[href="/bedchart/reports/downtime"]' },
        title: "Downtime pack",
        body: "Print it before you need it.",
      },
    ],
  },
  {
    // The same question for a login that cannot open Handover, so no answer sends it there.
    id: "downtime-paper",
    topic: "Handover and reports",
    title: "What to do if BedChart is down",
    keywords: "down offline outage paper downtime not working broken support help",
    answer:
      "Tell the bed coordinator on shift, who decides when everyone switches to paper and keeps the printed downtime pack. Work from paper until the coordinator says BedChart is back.",
    desks: EVERY_LOGIN.filter((role) => !deskOpens(role, "handover")),
  },
  {
    id: "tour",
    topic: "Finding your way",
    title: "Take the tour again",
    keywords: "tour tutorial guide walkthrough learn start",
    answer:
      "Open Help. Under Learn BedChart, Tour of your desk shows its chapters: press Start, or Resume where you stopped. Show me around this screen, at the top of Help, walks the screen you are on.",
    desks: EVERY_DESK,
    showMe: [
      {
        target: [{ sel: '[data-testid="ward-rail-help"]' }, { sel: '[data-testid="ward-bar-phone-menu"]' }],
        title: "Help",
        body: "Help is in the side menu (in Menu on a phone).",
      },
    ],
  },
  {
    id: "statistics",
    topic: "Handover and reports",
    title: "See the statistics",
    keywords: "statistics stats trends reports figures numbers",
    answer:
      "Open Statistics for the network's trends. Choose a view: Network, Compare, Services, Wards, EDs, Teams or Weekly. On a computer, Export in the Share menu downloads the figures at the top of the page. Every figure is from synthetic records.",
    desks: ["executive", "coordinator", "bed_manager"],
    go: "statistics",
    showMe: [
      {
        // The index's folder tabs carry ward-statistics-index (page tops, 9 Nov 2026).
        target: { sel: '[data-testid="ward-statistics-nav"], [data-testid="ward-statistics-index"]' },
        title: "Choose a view",
        body: "Network, Compare, Services, Wards, EDs, Teams and Weekly. Every figure is from synthetic records.",
      },
      {
        target: {
          sel: '[data-testid="ward-statistics-share"], [data-testid="ward-statistics-export"], [data-testid="ward-statistics-tools-menu"]',
        },
        title: "Export the figures",
        body: "Export, in the Share menu, saves the figures at the top of the page as a spreadsheet file, on a computer.",
      },
    ],
  },
  {
    id: "give-access",
    topic: "Settings and display",
    title: "Give or remove someone's access",
    keywords: "access account user role permission admin",
    answer:
      "Settings, Access. Under Give a role, choose the Person, Role, Place and Ends, then press Give role. Requests for access lists people waiting: give or decline each. Everyone with a role lists each role with Remove, which asks you to confirm. Each change is recorded.",
    desks: ["admin"],
    go: "settings#access",
    showMe: [
      {
        target: [
          { sel: '[data-testid="ward-access-grant"]' },
          { sel: '[data-testid="ward-settings-phone-area-access"]' },
        ],
        title: "Give a role",
        body: "Every role has an end date. Fill in the four choices in order.",
      },
      {
        target: [
          { sel: '[data-testid="ward-access-grant"] label', text: "Person", up: 2 },
          { sel: '[data-testid="ward-access-grant"] label', text: "Account id", up: 2 },
        ],
        title: "Person",
        body: "Choose the person, or type their account id.",
      },
      {
        target: { sel: '[data-testid="ward-access-grant"] label', text: "Role", up: 2 },
        title: "Role, then Place",
        body: "Choose the role first. Place then lists the wards, EDs, teams or services that role can hold.",
      },
      {
        target: { sel: '[data-testid="ward-access-grant"] label', text: "Ends", up: 2 },
        title: "Ends",
        body: "When the role ends. Every role has one.",
      },
      {
        target: tid("ward-access-grant-submit"),
        title: "Give role",
        body: "Gives the role once all four are chosen. The result shows at the top, and the change is recorded.",
      },
      {
        target: { sel: '[data-testid="ward-access-requests"]' },
        title: "Requests for access",
        body: "People who asked for access wait here. Give for the days shown, or Decline.",
      },
      {
        target: [tid("ward-access-role-remove"), tid("ward-access-roles")],
        title: "Remove a role",
        body: "Everyone with a role, with when it ends and was last used. Remove asks you to confirm, then ends it straight away.",
      },
    ],
  },
];
