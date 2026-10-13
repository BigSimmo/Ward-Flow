// Deliberately authored review observations. No network, app mutation or live-source read on build.
export default {
  date: "13 October 2026",
  comparedWith: {
    deployedUrl: "https://ward-flow-production.up.railway.app/mockups/ward-flow",
    deployedRevision: "Not exposed or verified; do not equate deployed UI with the local commit",
    localCheckout: "D:/Repos/Ward-Flow",
    localBranch: "feat/movement-drawer-audit-and-actions",
    localHead: "5d6ea7ed",
    localDirty: true,
    mode: "Read-only deployed synthetic UI and current local source comparison",
    sourceHashes: {
      "ward-flow-reducer.ts": "94a60b939af079373866bfa8865a13be1c3b378dae28ba02b386aaea08bbb3fc",
      "ward-flow-events.ts": "a5d247e4dece64882d0352821d5d9c2ae0fbed20e9ab066dc0330443dff7800d",
    },
    eventLabels: 98,
    focusedTests:
      "Current local source: 22 tests passed across community-diversion and core-engine files. No provider tests enabled. This is not deployed runtime proof.",
  },
  comparisons: [
    {
      id: "referral-versus-placement",
      nodes: ["raised", "addressed", "armWard", "armEd"],
      status: "Observed live",
      finding:
        "The deployed referral worklist distinguishes a ward-bed request from ED review and community referral. A non-bed referral does not have a ward-bed shortlist. Keep referral acceptance and a subsequent movement/placement separate.",
      limit: "Read-only worklist observation; no referral submission or complete clinical journey executed.",
      route: "/referrals",
      priority: "Keep this distinction",
    },
    {
      id: "community-directory",
      nodes: ["armCommunity", "cmhtFromSearch", "edToCommunity"],
      status: "Live UI + source checked",
      finding:
        "The app has a synthetic community-team directory and suburb/catchment guide. The current local ED diversion screen includes a team selector. The older blanket statement that there is no register to choose from is incomplete.",
      limit:
        "Recorded names and catchment suggestions are not verified operational services; acceptance and care ownership remain separate.",
      route: "/community",
      priority: "Updated diagram wording",
    },
    {
      id: "transport-versus-care",
      nodes: ["booked", "handover", "enroute", "collected", "arrived", "rkDiversion"],
      status: "Observed live",
      finding:
        "The transport board exposes job stages and next actions, including accepted and collected states. A recorded booking, arrival or provider label does not by itself prove external dispatch or transfer of clinical responsibility.",
      limit:
        "No dispatch, booking, delivery or transport mutation performed; regional contracts and authority require separate confirmation.",
      route: "/transport/officer",
      priority: "Keep transport and handover distinct",
    },
    {
      id: "patient-versus-bed",
      nodes: ["ready", "personLeaves", "bedReleased", "bedStuck", "rkDischargePlan"],
      status: "Observed live",
      finding:
        "The deployed discharge view separates anonymous planned bed-release work from admission-record history and displays barriers and release stages. Keep actual patient departure, release record and capacity accounting distinct.",
      limit: "Worklist observation only; no bed release, clinical discharge or activity-coding outcome exercised.",
      route: "/discharges",
      priority: "Updated explanatory wording",
    },
    {
      id: "legal-form-stub",
      nodes: ["dStatutory"],
      status: "Observed live limitation",
      finding:
        "Opening “Record a form” on the deployed legal screen still shows “Not wired in this prototype” and a disabled Save form control. A visible form editor must not be presented as a functioning save pathway.",
      limit:
        "Editor opened and dismissed without input or submission; statutory correctness and other legal-form operations not audited.",
      route: "/legal-forms",
      priority: "App follow-up required",
    },
    {
      id: "repatriation-handoff",
      nodes: ["dRepat"],
      status: "Current source differs",
      finding:
        "Agreed repatriation still creates a placement-requested movement. The current local constructor links the existing admission directly, while the older snapshot used a separate source-admission pointer. The older automatic sending-admission departure block is absent from the current arrival handler.",
      limit:
        "Static difference and constructor tests only. The receiving arrival/sending-bed handoff needs a dedicated scenario; no double-counting or live failure is claimed.",
      route: "/movements",
      priority: "Confirm origin/receiving handoff",
    },
    {
      id: "interward-approval",
      nodes: ["end1"],
      status: "Partial source proof",
      finding:
        "The protected admission-care transfer acceptance path requires the central coordinator. The diagram should record the requesting service, receiving agreement and applicable coordinator approval rather than imply that an end-of-stay label creates a receiving admission.",
      limit:
        "Not all legacy referral/transfer acceptance routes were exercised. A complete inter-ward handoff remains a review item.",
      route: "/wards",
      priority: "Confirm all transfer entry routes",
    },
  ],
  displayOverrides: {
    armCommunity:
      "A named community referral. The current app provides a synthetic directory and catchment guide; ED diversion has a team selector. Verify the actual team and care acceptance.",
    bedReleased:
      "The app separates planned bed-release work and admission-linked history. Patient departure, release status and available capacity remain distinct facts; check the relevant record and policy.",
  },
  waLinks: {
    srcCommunity: "cmh",
    armCommunity: "cmh",
    cmhtAnswers: "cmh",
    cmhtAccepted: "cmh",
    cmhtFromSearch: "cmh",
    edToCommunity: "cmh",
    srcGp: "primary",
    srcEd: "ed",
    edExpected: "ed",
    edArrived: "ed",
    edAnswers: "ed",
    edRaise: "ed",
    occupied: "acute",
    dAway: "leave",
    dRepat: "regional",
    sAbscond: "missing",
    end0: "home",
    end2: "medical",
    end3: "supported",
    end4: "declined",
    end5: "death",
    end6: "custody",
    end7: "missing",
  },
  research: {
    scope:
      "Bounded official-site search and linked-page review of entry, acute/home/virtual, specialist/community, residential, transport, absence, discharge and external handover families. Not the entire internet or a facility-by-facility clinical approval.",
    providers: [
      "WA Health",
      "WACHS",
      "EMHS",
      "Mental Health Commission",
      "WA Primary Health Alliance",
      "headspace",
      "Parkerville",
    ],
    findings: [
      "Adult walk-in access, child/family wellbeing hubs and youth community care need separate entry boxes; a GP referral is not a universal prerequisite.",
      "Ambulance co-response, WAVED, WISH, digital support and HITH are different activities and responsibility models; virtual contact is not a home admission.",
      "MP 0199/26 supersedes the older ambulance handover policy. Booking, vehicle arrival, handover and receiving acceptance remain separate milestones.",
      "Public pages disagree on some centre/transport hours. Avoid universal hours and confirm the actual provider and programme.",
      "The older-adult hub is a community coordination interface with explicit exclusions; a published opening/referral description is not live capacity proof.",
      "Consumer-chosen cultural, ACCHO, interpreter, family and accessibility support must remain available alongside care without automatic routing by identity.",
    ],
    gaps: [
      "Current full statewide mental-health bed-access/escalation policy and site-specific admission rules remain unavailable or unverified.",
      "Private funding, forensic/court/cross-border authority, current statutory forms, emergency plans and bed/activity coding need owner documents and operational review.",
      "The 30 earlier source records retain their original access dates. Twelve newly reviewed records carry 13 October; older publications and partial fetches are labelled.",
      "Deployed UI visibility is not proof that every depicted WA service or guard is implemented. No app/backend changes or operational service actions were made.",
    ],
  },
};
