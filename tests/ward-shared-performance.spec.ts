import { test } from "playwright/test";
import { accounts, openDesk } from "./helpers/ward-shared-desk";
import { attachBusyPhoneBaseline } from "./helpers/ward-slow-phone";

/** A separate advisory measurement: neither missing timings nor slow timings fail a release journey. */
test("advisory busy-phone baseline: record a bounded 4x CPU and slow-4G measurement", async ({ browser }, info) => {
  const desk = await openDesk(browser, accounts[0]!);
  try {
    await attachBusyPhoneBaseline(desk.page, info);
  } finally {
    await desk.context.close();
  }
});
