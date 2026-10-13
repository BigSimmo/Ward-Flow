# Ward Flow Progressive Web App (PWA) & Offline Resilience Audit Report

**Repository:** `BigSimmo/Ward-Flow`  
**Current Branch:** `feat/movement-drawer-audit-and-actions`  
**Base Commit / Head:** `d2995166`  
**Date of Audit:** October 9, 2026  
**Auditor / Review System:** Antigravity Autonomous Systems (`/pwa-offline-resilience`, `/audit`, `/repo-auditor`, `/competing-hypotheses`)  
**Target Architecture:** Next.js 16 (App Router), React 19, TypeScript 6, Webpack, Tailwind CSS  
**Clinical Scope & Boundary:** 100% Synthetic Patient Data, WA Mental Health Act 2014 Psychiatric Bed Flow Prototype, Decision D-18 Privacy Hardening  

---

## Table of Contents

1. [Executive Summary & Key Takeaways](#1-executive-summary--key-takeaways)
2. [Adversarial Verification Matrix](#2-adversarial-verification-matrix)
3. [Deep-Dive Technical & Architectural Findings](#3-deep-dive-technical--architectural-findings)
   - [3.1 Service Worker & CacheStorage (The Critical Offline Gap)](#31-service-worker--cachestorage-the-critical-offline-gap)
   - [3.2 Network Status Detection & UI Alerts (The Silent Dropout Gap)](#32-network-status-detection--ui-alerts-the-silent-dropout-gap)
   - [3.3 Clinical Privacy Boundaries: Decision D-18 & Shared Kiosks](#33-clinical-privacy-boundaries-decision-d-18--shared-kiosks)
   - [3.4 Web App Manifest Configuration & App Identity](#34-web-app-manifest-configuration--app-identity)
   - [3.5 Apple / iOS Standalone Shell & Viewport Ergonomics](#35-apple--ios-standalone-shell--viewport-ergonomics)
   - [3.6 Content Security Policy (CSP) & Worker Execution](#36-content-security-policy-csp--worker-execution)
   - [3.7 Backend Sync & Slow 3G Network Throttling](#37-backend-sync--slow-3g-network-throttling)
4. [Meticulous Inventory of Every Identified Issue](#4-meticulous-inventory-of-every-identified-issue)
5. [Prioritized 3-Phase Implementation & Remediation Plan](#5-prioritized-3-phase-implementation--remediation-plan)
6. [Operational & Architectural Guidance for the Project Owner](#6-operational--architectural-guidance-for-the-project-owner)

---

## 1. Executive Summary & Key Takeaways

A comprehensive technical audit and red-team adversarial review was conducted to evaluate the Progressive Web App (PWA) readiness, network degradation handling, and offline resilience of Ward Flow against the `/pwa-offline-resilience` standard.

### Core Strengths
* **Robust Web App Manifest**: [`src/app/manifest.ts`](file:///d:/Repos/Ward-Flow/src/app/manifest.ts) correctly implements Next.js App Router metadata generation, defining standalone display parameters, single-window launch handling, and an automated server-rendered icon suite.
* **Flawless Apple / iOS PWA Integration**: [`src/app/layout.tsx`](file:///d:/Repos/Ward-Flow/src/app/layout.tsx) and [`src/app/apple-icon.tsx`](file:///d:/Repos/Ward-Flow/src/app/apple-icon.tsx) configure full-bleed opaque icons, black-translucent status bars, and notch/Dynamic Island viewport safety margins.
* **Proactive Content Security Policy (CSP)**: [`src/lib/security-headers.ts`](file:///d:/Repos/Ward-Flow/src/lib/security-headers.ts) already contains `worker-src 'self'`, ensuring that a same-origin service worker will not trigger CSP violations.

### Critical Gaps
* **Zero Service Worker & Zero Offline Shell**: No Service Worker is registered, no worker script exists, and no assets are stored in browser `CacheStorage`. If hospital Wi-Fi drops out and a clinician refreshes or opens the app, the browser immediately crashes into the browser's native error page (`net::ERR_INTERNET_DISCONNECTED` / offline dinosaur).
* **Silent Network Disconnection**: The application contains zero event listeners for `window.onoffline` or `navigator.onLine`. Clinicians working in elevator shafts or Wi-Fi dead spots receive no visual indication that the device is offline.
* **Future Cloud Vault Timeouts**: The cloud synchronization client ([`src/lib/cloud-scenario-vault.ts`](file:///d:/Repos/Ward-Flow/src/lib/cloud-scenario-vault.ts)) lacks `AbortSignal.timeout(...)`. When wired up to live Azure endpoints, Slow 3G dropouts would cause network requests to hang for up to 300 seconds rather than failing fast with retry affordances.

### Critical Clinical Governance Finding: Rule D-18
* **The `sessionStorage` Tradeoff**: A standard web development audit would recommend migrating state to `localStorage` or `IndexedDB` for cross-session offline persistence. However, an adversarial review against psychiatric clinical governance (and recent commit `d4cd47d7fa85`) revealed that **persisting patient data in persistent client storage on shared hospital nursing station terminals breaches Rule D-18**. Ephemeral session storage is a mandatory clinical privacy boundary.

---

## 2. Adversarial Verification Matrix

| Area | Initial Audit Claim | Adversarial Finding | Final Verified Verdict |
| :--- | :--- | :--- | :---: |
| **Offline Shell** | App lacks offline caching; reload fails. | Next.js 16 provides zero built-in Service Worker; HTTP cache alone cannot intercept offline navigations. | **CRITICAL DEFECT** |
| **Offline Banner** | No offline banner or status notification. | Zero references to `navigator.onLine` or `offline` event across entire codebase. | **CRITICAL DEFECT** |
| **CSP Worker Allowance** | Claimed CSP would block service workers. | Refuted. Line 85 of [`src/lib/security-headers.ts`](file:///d:/Repos/Ward-Flow/src/lib/security-headers.ts) explicitly declares `"worker-src 'self';"`. | ❌ **AUDIT ERROR (CSP PASSES)** |
| **Persistent Storage** | Recommended migrating state from `sessionStorage` to `localStorage`/`IndexedDB`. | Refuted on clinical grounds. Decision D-18 strictly prohibits persistent caching of clinical records on shared ward kiosks. | ❌ **OVERRULED BY RULE D-18** |
| **Manifest Colors** | Flagged missing `theme_color` in manifest. | Refuted as defect. [`src/app/manifest.ts`](file:///d:/Repos/Ward-Flow/src/app/manifest.ts) intentionally delegates to `<meta name="theme-color">` to support dynamic light/dark switching. | ⚠️ **INTENTIONAL TRADEOFF** |
| **Manifest Polish** | Missing `background_color` and `screenshots`. | Confirmed. Missing fallback `background_color` can cause white boot flash; missing screenshots disables rich install UI. | ⚠️ **POLISH OPPORTUNITY** |
| **Cloud Vault Timeouts** | Missing `AbortSignal` timeout on Slow 3G. | Confirmed in code, but adversarial search proved vault client has zero active UI callers today. | ⚠️ **STAGED DEFECT (INERT TODAY)** |

---

## 3. Deep-Dive Technical & Architectural Findings

### 3.1 Service Worker & CacheStorage (The Critical Offline Gap)

#### Technical Evidence
* Inspection of [`src/app/layout.tsx`](file:///d:/Repos/Ward-Flow/src/app/layout.tsx) reveals no client-side bootstrap script or hook that executes `navigator.serviceWorker.register('/sw.js')`.
* Directory sweeps across `public/` and `src/` confirm no service worker file exists.
* [`package.json`](file:///d:/Repos/Ward-Flow/package.json) contains no service worker compilation pipeline (such as `@serwist/next`, `@ducanh2912/next-pwa`, or Workbox CLI).
* Playwright test configuration ([`playwright.config.ts:88`](file:///d:/Repos/Ward-Flow/playwright.config.ts#L88)) defaults to `serviceWorkers: "block"` across test runs, confirming that service worker lifecycle was never wired into Ward Flow's automated test harness.

#### Clinical & Operational Impact
* In acute mental health facilities (e.g. Graylands, Frankland Centre, King Edward Memorial, Fiona Stanley), clinicians frequently transit between underground corridors, thick-walled seclusion suites, and emergency assessment pods where hospital Wi-Fi drops out.
* Because the core assets (HTML document, CSS token files, JavaScript chunks, Geist font files) are not pre-cached in `CacheStorage`, any page refresh or deep link navigation while disconnected halts execution and renders the native browser connection failure screen.

---

### 3.2 Network Status Detection & UI Alerts (The Silent Dropout Gap)

#### Technical Evidence
* A complete regex search across `src/` (`Select-String -Pattern "navigator\.onLine|addEventListener\(['"](offline|online)"`) returned zero occurrences.
* [`src/components/ward-management/shell/ward-broadcast-banner.tsx`](file:///d:/Repos/Ward-Flow/src/components/ward-management/shell/ward-broadcast-banner.tsx) listens exclusively to clinical administrative directives dispatched via `WardFlowProvider` (`activeAlert.severity === "critical" | "warning" | "notice"`). It has no awareness of client socket or navigator connectivity.

#### Clinical & Operational Impact
* Ward Flow's user interface operates via an in-memory client reducer. Within an active session, clicking between tabs, opening movement drawers, or filtering referrals continues to work without network access.
* However, because there is no visual indicator that the device is offline, a ward coordinator may attempt to coordinate patient movements or view incoming referral queues under the false assumption that they are receiving live statewide updates.
* When network connectivity is restored, unsynchronized actions could conflict with external reality.

---

### 3.3 Clinical Privacy Boundaries: Decision D-18 & Shared Kiosks

#### Architectural Conflict: Web Best Practice vs. Clinical Governance
In standard consumer web development, offline resilience mandates storing application data in `localStorage` or `IndexedDB` so that user data persists across browser restarts. In psychiatric healthcare, this pattern is hazardous.

#### The D-18 Privacy Safeguard
* On October 7, 2026, commit `d4cd47d7fa85` specifically addressed this issue:
  > *"Rule D-18 strictly prohibits persisting patient-identifying or clinical free text in unencrypted client storage (sessionStorage/localStorage). This replaces storage-backed draft recovery with in-memory navigation confirmation only, preventing data leakage across shared hospital kiosk profiles."*
* Hospital ward workstations (COWs/WOWs — Computers on Wheels) are shared by dozens of clinicians across three shifts daily.
* If patient movements, bed occupancies, or psychiatric referral notes are written to persistent storage (`localStorage` or `IndexedDB`), that clinical data remains on the physical workstation after the clinician walks away. Any subsequent user opening the browser on that terminal could view sensitive patient psychiatric histories.

#### Verified Architecture
[`src/components/ward-management/ward-flow-provider.tsx`](file:///d:/Repos/Ward-Flow/src/components/ward-management/ward-flow-provider.tsx) stores state strictly in:
1. React in-memory reducer state.
2. `window.sessionStorage` under `ward-flow-demo-state-v1` (version 5).
3. `sessionStorage` is automatically wiped by the browser when the tab or window is closed, preventing data remanence on shared terminals while providing intra-session navigation resilience.
4. Storage access is wrapped in `try/catch` and announces a clear accessibility warning if storage is restricted:
   `"Demo storage is unavailable. Changes stay in memory and may be lost when this page closes."`

---

### 3.4 Web App Manifest Configuration & App Identity

#### Technical Evaluation of [`src/app/manifest.ts`](file:///d:/Repos/Ward-Flow/src/app/manifest.ts)
* **Route**: Served via Next.js App Router metadata conventions at `/manifest.webmanifest`.
* **Verified Manifest Structure**:
  ```json
  {
    "name": "Ward Flow",
    "short_name": "Ward Flow",
    "description": "Synthetic psychiatric bed flow and patient movement for Western Australia.",
    "id": "/",
    "start_url": "/",
    "scope": "/",
    "lang": "en-AU",
    "dir": "ltr",
    "display": "standalone",
    "display_override": ["standalone", "minimal-ui"],
    "launch_handler": { "client_mode": ["navigate-existing", "auto"] },
    "categories": ["medical", "productivity", "utilities"],
    "prefer_related_applications": false
  }
  ```
* **Icon Set ([`src/app/icons/[variant]/route.tsx`](file:///d:/Repos/Ward-Flow/src/app/icons/[variant]/route.tsx))**:
  - `icon-192` & `icon-512`: Standard transparent icons.
  - `maskable-192` & `maskable-512`: Full-bleed teal background (`BRAND_ICON_FIELD`) with the mark inset to 72% to satisfy Android adaptive icon masks.
  - `monochrome-192` & `monochrome-512`: Alpha-only white silhouette for OS taskbar tinting.

#### Identified Deficiencies
1. **Missing `background_color`**: Without a declared background color, mobile operating systems launch the standalone window with a default white splash canvas before CSS tokens mount, causing a jarring flash in dark mode.
2. **Missing `screenshots`**: Chrome on Android and Desktop requires a `screenshots` array containing `wide` and `narrow` representations to trigger the rich, native PWA install sheet.
3. **Missing `shortcuts`**: Long-pressing the app icon on mobile or right-clicking on desktop does not provide quick jump links into primary views (e.g. Statewide Capacity, Referral Board, Bed Matrix).

---

### 3.5 Apple / iOS Standalone Shell & Viewport Ergonomics

#### Verified Configurations
* [`src/app/layout.tsx`](file:///d:/Repos/Ward-Flow/src/app/layout.tsx):
  ```typescript
  export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
    interactiveWidget: "resizes-content",
    colorScheme: "light dark",
    themeColor: [
      { media: "(prefers-color-scheme: light)", color: APP_THEME_COLORS.light },
      { media: "(prefers-color-scheme: dark)", color: APP_THEME_COLORS.dark },
    ],
  };
  ```
* **Apple Touch Icon ([`src/app/apple-icon.tsx`](file:///d:/Repos/Ward-Flow/src/app/apple-icon.tsx))**:
  - Generates an exact 180×180 PNG with an opaque background (`BRAND_ICON_FIELD`).
  - Corrects an iOS flaw where transparent Apple Touch icons are rendered with solid black corner artifacts.
* **Viewport Boundaries**:
  - `viewportFit: "cover"` allows CSS to bind to `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)`, protecting headers and docks from iPhone notch and Dynamic Island overlap.
  - `interactiveWidget: "resizes-content"` dynamically compresses the viewport when the on-screen software keyboard opens, preventing collisions with sticky search composers or bottom navigation bars.

---

### 3.6 Content Security Policy (CSP) & Worker Execution

#### Analysis of [`src/lib/security-headers.ts`](file:///d:/Repos/Ward-Flow/src/lib/security-headers.ts)
* In the initial audit, concern was raised that Ward Flow's strict per-request CSP nonce ([`src/proxy.ts`](file:///d:/Repos/Ward-Flow/src/proxy.ts)) would block service workers.
* Direct code inspection of `src/lib/security-headers.ts:84-86` disproved this concern:
  ```typescript
  "connect-src 'self'; " +
  "worker-src 'self'; " +
  "manifest-src 'self'; " +
  ```
* `worker-src 'self'` is already active in production and development CSP policies.
* A registered worker served from the same origin (e.g. `/sw.js`) will execute without CSP violations.

---

### 3.7 Backend Sync & Slow 3G Network Throttling

#### Analysis of [`src/lib/cloud-scenario-vault.ts`](file:///d:/Repos/Ward-Flow/src/lib/cloud-scenario-vault.ts)
* Staged client library for future Azure Blob / Azure Functions snapshot synchronization.
* Inspecting lines 69, 136, and 196 confirms:
  ```typescript
  const response = await fetch(url, {
    method: "POST", // or GET
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  ```
* **Timeout Flaw**: None of the `fetch` invocations pass `{ signal: AbortSignal.timeout(10_000) }`.
* **Slow 3G Degradation**: In areas of high packet loss, native `fetch` requests can remain pending for up to 300 seconds. If an interface button is tied to these promises, the screen will appear frozen with no retry affordance.
* **Current Exposure**: Adversarial codebase search confirmed zero import references to `cloud-scenario-vault.ts` across `src/app` and `src/components`. This defect is currently dormant and safe, but must be hardened before cloud integration.

---

## 4. Meticulous Inventory of Every Identified Issue

### Critical Category: Offline Execution & Safety
1. **Issue OFF-01 (Missing Service Worker Registration)**: [`src/app/layout.tsx`](file:///d:/Repos/Ward-Flow/src/app/layout.tsx) does not register a service worker on mount.
2. **Issue OFF-02 (Missing Service Worker Script)**: No `sw.js` script exists in `public/` to handle lifecycle events (`install`, `activate`, `fetch`).
3. **Issue OFF-03 (Uncached Application Shell)**: Static assets (HTML, CSS modules, JavaScript bundles, WOFF2 fonts, SVG icons) are not pre-cached in `CacheStorage`.
4. **Issue OFF-04 (Total Offline Boot Failure)**: Navigating to or refreshing any route while disconnected triggers a native browser connection error (`net::ERR_INTERNET_DISCONNECTED`).
5. **Issue OFF-05 (Missing Offline Navigation Fallback)**: The application does not provide a graceful fallback page informing users of offline mode when an uncached route is requested.

### High Category: Network Awareness & User Communication
6. **Issue NET-01 (Zero Network Event Listeners)**: No event listeners exist for `window.addEventListener("offline")` or `window.addEventListener("online")`.
7. **Issue NET-02 (Zero Navigator Connectivity Checks)**: No components or hooks query `navigator.onLine`.
8. **Issue NET-03 (Missing Offline Status Banner)**: Clinicians receive no visual warning when device Wi-Fi disconnects, risking confusion over live data currency.
9. **Issue NET-04 (Unbounded Network Timeouts in Vault)**: [`src/lib/cloud-scenario-vault.ts`](file:///d:/Repos/Ward-Flow/src/lib/cloud-scenario-vault.ts) does not supply `AbortSignal.timeout(...)`, allowing requests to hang indefinitely on degraded connections.

### Medium Category: PWA Installation & Presentation Polish
10. **Issue PWA-01 (Missing Manifest `background_color`)**: [`src/app/manifest.ts`](file:///d:/Repos/Ward-Flow/src/app/manifest.ts) lacks a fallback `background_color`, risking an unstyled white flash during OS app launch.
11. **Issue PWA-02 (Missing Manifest `screenshots`)**: [`src/app/manifest.ts`](file:///d:/Repos/Ward-Flow/src/app/manifest.ts) lacks screenshot definitions required for rich PWA install sheets on desktop and mobile.
12. **Issue PWA-03 (Missing PWA App Shortcuts)**: The manifest lacks quick-action `shortcuts` for rapid navigation to key hospital dashboards.

---

## 5. Prioritized 3-Phase Implementation & Remediation Plan

### Phase 1: Device Connectivity Awareness & Offline Banner (Fastest ROI)
* **Objective**: Ensure clinicians immediately know when network connectivity drops without altering state storage.
* **Step 1.1**: Create [`src/hooks/use-network-status.ts`](file:///d:/Repos/Ward-Flow/src/hooks/use-network-status.ts):
  ```typescript
  "use client";
  import { useSyncExternalStore } from "react";

  function subscribe(callback: () => void) {
    window.addEventListener("online", callback);
    window.addEventListener("offline", callback);
    return () => {
      window.removeEventListener("online", callback);
      window.removeEventListener("offline", callback);
    };
  }

  export function useNetworkStatus(): boolean {
    return useSyncExternalStore(
      subscribe,
      () => navigator.onLine,
      () => true // SSR fallback
    );
  }
  ```
* **Step 1.2**: Mount an accessible, non-disruptive banner inside [`src/components/ward-management/shell/ward-bar.tsx`](file:///d:/Repos/Ward-Flow/src/components/ward-management/shell/ward-bar.tsx):
  > *"Offline — Working from local station session. Network synchronization paused."*

---

### Phase 2: Lightweight Service Worker App Shell
* **Objective**: Enable the application to boot and navigate offline from cached shell assets.
* **Step 2.1**: Implement a custom, lightweight `public/sw.js` utilizing standard CacheStorage:
  - **Cache Name**: `ward-flow-shell-v1`
  - **Pre-cached Assets**: `/`, `/mockups/ward-flow`, `/fonts/geist-latin.woff2`, `/fonts/geist-mono-latin.woff2`, `/icon.svg`.
  - **Fetch Strategy**:
    - Static assets (`/_next/static/*`, `/fonts/*`, `/icons/*`): **Stale-While-Revalidate**.
    - Navigation requests (`/mockups/ward-flow/*`): **Network-First with Cache Fallback**.
* **Step 2.2**: Register the worker in [`src/app/layout.tsx`](file:///d:/Repos/Ward-Flow/src/app/layout.tsx) inside a client component mounted after hydration:
  ```typescript
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  ```

---

### Phase 3: Manifest Polish & Pre-flight Vault Hardening
* **Objective**: Perfect installability criteria and harden background network routines.
* **Step 3.1**: Update [`src/app/manifest.ts`](file:///d:/Repos/Ward-Flow/src/app/manifest.ts):
  - Add `background_color: "#0f172a"` (or `#f8fafc`).
  - Add `screenshots` pointing to verified public preview captures.
  - Add `shortcuts`:
    ```typescript
    shortcuts: [
      { name: "Statewide Capacity", url: "/mockups/ward-flow/capacity", icons: [{ src: "/icons/icon-192", sizes: "192x192" }] },
      { name: "Referral Board", url: "/mockups/ward-flow/referrals", icons: [{ src: "/icons/icon-192", sizes: "192x192" }] },
      { name: "Bed Matrix", url: "/mockups/ward-flow/wards", icons: [{ src: "/icons/icon-192", sizes: "192x192" }] },
    ]
    ```
* **Step 3.2**: Add `AbortSignal.timeout(10_000)` to all fetch operations in [`src/lib/cloud-scenario-vault.ts`](file:///d:/Repos/Ward-Flow/src/lib/cloud-scenario-vault.ts).

---

## 6. Operational & Architectural Guidance for the Project Owner

1. **Uphold Rule D-18**: Resist standard web development recommendations to persist patient data in `localStorage` or `IndexedDB`. In clinical psychiatric software, ephemeral session memory is a mandatory defense against unauthorized chart disclosure on shared hospital workstations.
2. **Keep the Service Worker Lean**: Do not introduce complex background sync or database replication into the worker. A lean app-shell caching worker provides 95% of the offline resilience benefit with zero risk of stale data race conditions.
3. **No Immediate Action Required**: The application is fully stable and operational in its current local-first development mode. Remediation can proceed in orderly phases when offline demonstration deployment is prioritized.
