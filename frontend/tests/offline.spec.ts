import { test, expect, type Page } from "@playwright/test";

test("expired session pauses replay without losing a local save", async ({
  page,
  context,
}) => {
  const email = await register(page);
  await page.goto("/app/profile");
  await context.setOffline(true);
  await page.getByLabel("What should we call you?").fill("Saved after expiry");
  await page.getByRole("button", { name: "Save preferences" }).click();
  await context.clearCookies({ name: "sessionid" });
  await context.setOffline(false);
  await page.getByRole("link", { name: "View sync details" }).click();
  await expect(
    page.getByText("Local access · sign in online to resume sync", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Sign in again" }).click();
  await page.getByLabel("Email address").fill(email);
  await page
    .getByLabel("Password", { exact: true })
    .fill("Offline-browser-password!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.locator(".sync-status")).toHaveText("Synced");
  const profile = await (await page.request.get("/api/profile/")).json();
  expect(profile.display_name).toBe("Saved after expiry");
});
async function register(page: Page) {
  const email = `offline-${crypto.randomUUID()}@example.com`;
  await page.goto("/register");
  await page.getByLabel("Email address").fill(email);
  await page
    .getByLabel("Password", { exact: true })
    .fill("Offline-browser-password!");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page).toHaveURL(/onboarding/);
  await page.getByLabel("What should we call you?").fill("Offline Tester");
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
  return email;
}
test("offline reload preserves durable changes, conflict retains both versions, then rebases once", async ({
  page,
  context,
}) => {
  await register(page);
  await page.goto("/app/profile");
  await context.setOffline(true);
  await page.getByLabel("What should we call you?").fill("Offline changed");
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expect(page.locator(".sync-status")).toContainText("pending sync");
  await page.reload();
  await expect(page.getByLabel("What should we call you?")).toHaveValue(
    "Offline changed",
  );
  const cookies = await context.cookies();
  const csrf = cookies.find((cookie) => cookie.name === "csrftoken")!.value;
  const profile = await page.request.get("/api/profile/");
  const current = await profile.json();
  const patch = await page.request.patch("/api/profile/", {
    headers: { "X-CSRFToken": csrf },
    data: { revision: current.revision, display_name: "Other device" },
  });
  expect(patch.status()).toBe(200);
  await context.setOffline(false);
  await page.getByRole("link", { name: "View sync details" }).click();
  await expect(
    page.getByRole("heading", { name: "Your version" }),
  ).toBeVisible();
  await expect(
    page.getByText("Other device", { exact: false }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Keep my version" }).click();
  await expect(page.locator(".sync-status")).toHaveText("Synced");
  await expect(
    page.getByRole("heading", { name: /Recovered drafts/ }),
  ).toBeVisible();
  const synced = await (await page.request.get("/api/profile/")).json();
  expect(synced.display_name).toBe("Offline changed");
  expect(synced.revision).toBe(current.revision + 2);
});
test("offline logout locks retained work and another account never sees it", async ({
  page,
  context,
}) => {
  const email = await register(page);
  await page.goto("/app/profile");
  await context.setOffline(true);
  await page
    .getByLabel("What should we call you?")
    .fill("Retained private name");
  await page.getByRole("button", { name: "Save preferences" }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page
    .getByRole("button", { name: "Keep on this device and sign out" })
    .click();
  await expect(page).toHaveURL(/login/);
  await page.reload();
  await expect(page).toHaveURL(/login/);
  await expect(page.getByText("Retained private name")).toHaveCount(0);
  await context.setOffline(false);
  await page.reload();
  await page.goto("/register");
  await page
    .getByLabel("Email address")
    .fill(`other-${crypto.randomUUID()}@example.com`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("Other-browser-password!");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page).toHaveURL(/onboarding/);
  await expect(page.getByLabel("What should we call you?")).toHaveValue("");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/login/);
  await page.getByLabel("Email address").fill(email);
  await page
    .getByLabel("Password", { exact: true })
    .fill("Offline-browser-password!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByText("Welcome, Retained private name")).toBeVisible();
});
