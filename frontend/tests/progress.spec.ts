import { test, expect, type Page } from "@playwright/test";
async function register(page: Page) {
  await page.goto("/register");
  await page
    .getByLabel("Email address")
    .fill(`progress-${crypto.randomUUID()}@example.com`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("Progress-browser-password!");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page).toHaveURL(/onboarding/);
  await page.getByLabel("What should we call you?").fill("Progress Tester");
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.locator(".sync-status")).toHaveText("Synced");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          () => resolve(),
          { once: true },
        ),
      );
  });
}
test("offline weight survives restart and syncs once with readable history", async ({
  page,
  context,
}) => {
  await register(page);
  await page.goto("/app/progress");
  await context.setOffline(true);
  await page.getByLabel("Recorded date", { exact: true }).fill("2026-10-05");
  await page.getByLabel("Weight (kg)", { exact: true }).fill("80.125");
  await page
    .getByLabel("Notes", { exact: true })
    .first()
    .fill("Durable private measurement");
  await page
    .getByRole("button", { name: "Save on this device", exact: true })
    .click();
  await expect(page.getByText("80.13 kg", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("80.13 kg", { exact: true })).toBeVisible();
  await context.setOffline(false);
  await expect(page.locator(".sync-status")).toHaveText("Synced");
  const result = await (
    await page.request.get("/api/progress/weights/")
  ).json();
  expect(result.count).toBe(1);
  expect(result.results[0].weight_kg).toBe("80.125");
  await page.getByRole("button", { name: "العربية", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});
test("private photo staging survives offline restart and accepts after reconnect", async ({
  page,
  context,
}) => {
  await register(page);
  await page.goto("/app/progress");
  await context.setOffline(true);
  await page.getByLabel("Assigned week (Monday)").fill("2026-10-05");
  await page.getByLabel("Capture date").fill("2026-10-06");
  await page.getByLabel("Optional label").fill("Front");
  await page.getByLabel("Photo (JPEG, PNG or WebP)").setInputFiles({
    name: "private.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await page.getByRole("button", { name: "Stage photo", exact: true }).click();
  await expect(page.locator(".progress-gallery img")).toBeVisible();
  await page.reload();
  await expect(page.locator(".progress-gallery img")).toBeVisible();
  await context.setOffline(false);
  await expect(page.locator(".sync-status")).toHaveText("Synced");
  const result = await (await page.request.get("/api/progress/photos/")).json();
  expect(result.count).toBe(1);
  expect(result.results[0].label).toBe("Front");
  await expect(
    page.getByText("No weight observations for this week").first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Zoom original" }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("slider").fill("2");
  await expect(page.getByRole("slider")).toHaveValue("2");
  await page.getByRole("button", { name: "Close", exact: true }).click();
});
test("reminders stay editable and disabled settings survive reload", async ({
  page,
}) => {
  await register(page);
  await page.goto("/app/reminders");
  await expect(
    page.getByText("Browser-closed delivery is not guaranteed.", {
      exact: false,
    }),
  ).toBeVisible();
  await page.getByLabel("Weekdays (1 Monday–7 Sunday)").fill("1,3,5");
  await page.getByRole("button", { name: "Save on this device" }).click();
  await expect(page.locator(".sync-status")).toHaveText("Synced");
  await page.reload();
  await expect(page.locator(".progress-history")).toContainText("1,3,5");
  const result = await (
    await page.request.get("/api/progress/reminders/")
  ).json();
  expect(result.results[0].enabled).toBe(false);
});
test("accepted private photo cache is opt-in and disappears after explicit clear", async ({
  page,
  context,
}) => {
  await register(page);
  await page.goto("/app/progress");
  await page.getByLabel("Optional label").fill("Cached private view");
  await page.getByLabel("Photo (JPEG, PNG or WebP)").setInputFiles({
    name: "private.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await page.getByRole("button", { name: "Stage photo", exact: true }).click();
  await expect(page.locator(".sync-status")).toHaveText("Synced");
  await page
    .getByLabel("Cache private photos on this trusted device (up to 50 MB)")
    .check();
  await page.reload();
  await expect(page.locator(".progress-gallery img")).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator(".progress-gallery img")).toBeVisible();
  await page
    .getByRole("button", { name: "Clear cached photos", exact: true })
    .click();
  await expect(
    page.getByText("Cached photos cleared", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator(".progress-gallery img")).toHaveCount(0);
  await expect(page.locator(".progress-gallery")).toContainText(
    "Photo unavailable offline",
  );
});
test("fifth photo remains recoverable and can be reassigned to a free week", async ({
  page,
}) => {
  await register(page);
  await page.goto("/app/progress");
  for (let i = 1; i <= 5; i++) {
    await page.getByLabel("Assigned week (Monday)").fill("2026-10-05");
    await page.getByLabel("Optional label").fill(`Photo ${i}`);
    await page.getByLabel("Photo (JPEG, PNG or WebP)").setInputFiles({
      name: `private-${i}.png`,
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        "base64",
      ),
    });
    await page
      .getByRole("button", { name: "Stage photo", exact: true })
      .click();
    await expect(page.locator(".sync-status")).toHaveText(
      i === 5 ? "Needs your attention" : "Synced",
    );
  }
  let result = await (await page.request.get("/api/progress/photos/")).json();
  expect(result.count).toBe(4);
  const draft = page
    .locator(".progress-gallery article")
    .filter({ hasText: "Photo 5" });
  await expect(draft.locator("img")).toBeVisible();
  await draft
    .getByRole("button", { name: "Edit / Replace existing photo" })
    .click();
  await page.getByLabel("Assigned week (Monday)").fill("2026-10-12");
  await page
    .getByRole("button", { name: "Save on this device", exact: true })
    .last()
    .click();
  await expect(page.locator(".sync-status")).toHaveText("Synced");
  result = await (await page.request.get("/api/progress/photos/")).json();
  expect(result.count).toBe(5);
  expect(
    result.results.find((r: { label: string }) => r.label === "Photo 5")
      .week_start,
  ).toBe("2026-10-12");
});
test("denied notification permission leaves progress usable", async ({
  page,
}) => {
  await page.addInitScript(() => {
    if ("Notification" in window)
      Object.defineProperty(Notification, "permission", {
        get: () => "denied",
        configurable: true,
      });
  });
  await register(page);
  await page.goto("/app/reminders");
  await page.getByLabel("Enable reminder").check();
  await expect(
    page.getByText(
      "Notifications are denied. Other features remain available.",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save on this device" }).click();
  await expect(page.locator(".sync-status")).toHaveText("Synced");
  await page.getByRole("link", { name: "Progress", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your progress", exact: true }),
  ).toBeVisible();
});
