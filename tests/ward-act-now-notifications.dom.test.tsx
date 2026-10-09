import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ACT_NOW_NOTIFICATIONS_STORAGE_KEY,
  actNowNotificationText,
  enableActNowNotifications,
  getActNowNotificationPreference,
  newActNowItems,
  notificationSupport,
  setActNowNotificationPreference,
  showActNowNotification,
} from "@/components/ward-management/shell/ward-act-now-notifications";
import type { InboxItem } from "@/components/ward-management/ward-derivations";

function item(id: string, tone: InboxItem["tone"], title = `Title ${id}`): InboxItem {
  return {
    id,
    movementId: "movement-1",
    title,
    detail: "Detail",
    owner: "Coordinator",
    tone,
    actions: [],
  } as unknown as InboxItem;
}

type FakeNotificationClass = {
  permission: NotificationPermission;
  requestPermission: ReturnType<typeof vi.fn>;
  shown: { title: string; options: NotificationOptions }[];
};

function installNotification(permission: NotificationPermission, answer: NotificationPermission = permission) {
  const shown: FakeNotificationClass["shown"] = [];
  const Fake = function (
    this: { onclick: (() => void) | null; close: () => void },
    title: string,
    options: NotificationOptions,
  ) {
    shown.push({ title, options });
    this.onclick = null;
    this.close = () => {};
  } as unknown as FakeNotificationClass & (new (title: string, options: NotificationOptions) => unknown);
  Fake.permission = permission;
  Fake.requestPermission = vi.fn(async () => {
    Fake.permission = answer;
    return answer;
  });
  Fake.shown = shown;
  vi.stubGlobal("Notification", Fake);
  return Fake;
}

beforeEach(() => {
  window.localStorage.removeItem(ACT_NOW_NOTIFICATIONS_STORAGE_KEY);
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.removeItem(ACT_NOW_NOTIFICATIONS_STORAGE_KEY);
});

describe("act-now notifications", () => {
  it("is off by default and remembers only an on or off choice", () => {
    expect(getActNowNotificationPreference()).toBe(false);
    setActNowNotificationPreference(true);
    expect(window.localStorage.getItem(ACT_NOW_NOTIFICATIONS_STORAGE_KEY)).toBe("true");
    expect(getActNowNotificationPreference()).toBe(true);
    setActNowNotificationPreference(false);
    expect(getActNowNotificationPreference()).toBe(false);
  });

  it("reports an unsupported browser and stays off when asked to turn on", async () => {
    vi.stubGlobal("Notification", undefined);
    expect(notificationSupport()).toBe("unsupported");
    await expect(enableActNowNotifications()).resolves.toBe("unsupported");
    expect(getActNowNotificationPreference()).toBe(false);
  });

  it("asks once when permission is undecided and turns on only when granted", async () => {
    const granted = installNotification("default", "granted");
    await expect(enableActNowNotifications()).resolves.toBe("granted");
    expect(granted.requestPermission).toHaveBeenCalledTimes(1);
    expect(getActNowNotificationPreference()).toBe(true);
  });

  it("respects a denied answer and an earlier denial without asking again", async () => {
    installNotification("default", "denied");
    await expect(enableActNowNotifications()).resolves.toBe("denied");
    expect(getActNowNotificationPreference()).toBe(false);

    const blocked = installNotification("denied");
    await expect(enableActNowNotifications()).resolves.toBe("denied");
    expect(blocked.requestPermission).not.toHaveBeenCalled();
    expect(getActNowNotificationPreference()).toBe(false);
  });

  it("finds only red rows that were not on the list before", () => {
    const current = [item("a", "danger"), item("b", "warning"), item("c", "danger")];
    expect(newActNowItems(new Set(["a"]), current).map((row) => row.id)).toEqual(["c"]);
    expect(newActNowItems(new Set(["a", "c"]), current)).toEqual([]);
  });

  it("words a notification with the alert title only, never a patient", () => {
    expect(actNowNotificationText([item("a", "danger", "Referral decision overdue")])).toEqual({
      title: "Ward Flow: act now",
      body: "Referral decision overdue. Synthetic demo data.",
    });
    expect(actNowNotificationText([item("a", "danger"), item("b", "danger")]).body).toBe(
      "2 new act-now alerts. Synthetic demo data.",
    );
  });

  it("shows a notification only when granted, and opens Alerts on click", () => {
    const denied = installNotification("denied");
    expect(showActNowNotification([item("a", "danger")], () => {})).toBe(false);
    expect(denied.shown).toHaveLength(0);

    const granted = installNotification("granted");
    const onOpen = vi.fn();
    expect(showActNowNotification([], onOpen)).toBe(false);
    expect(showActNowNotification([item("a", "danger", "Bed pull expiring")], onOpen)).toBe(true);
    expect(granted.shown).toEqual([
      {
        title: "Ward Flow: act now",
        options: { body: "Bed pull expiring. Synthetic demo data.", tag: "ward-flow-act-now" },
      },
    ]);
  });
});
