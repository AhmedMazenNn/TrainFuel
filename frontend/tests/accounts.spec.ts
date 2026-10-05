import { test, expect } from "@playwright/test";

test("account onboarding, profile persistence, logout, and private-route protection", async ({
  page,
}) => {
  const email = `browser-${crypto.randomUUID()}@example.com`;
  await page.goto("/register");
  await page.getByLabel("Email address").fill(email);
  await page
    .getByLabel("Password", { exact: true })
    .fill("Milestone-browser-password!");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page).toHaveURL(/onboarding/);
  await page.getByLabel("What should we call you?").fill("Browser Tester");
  await page.getByLabel("Timezone", { exact: true }).fill("Africa/Cairo");
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(
    page.getByRole("heading", { name: "Good habits start here." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Your profile", exact: true }).click();
  await page.getByLabel("Weight units").selectOption("lb");
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Saved on this device" })
      .first(),
  ).toContainText("Saved on this device");
  await page.reload();
  await expect(page.getByLabel("Weight units")).toHaveValue("lb");
  await expect(page.getByLabel("Timezone", { exact: true })).toHaveValue(
    "Africa/Cairo",
  );
  const secondTab = await page.context().newPage();
  await secondTab.goto("/app/profile");
  await expect(secondTab.getByLabel("What should we call you?")).toHaveValue(
    "Browser Tester",
  );
  await expect(page.locator(".sync-status")).toHaveText("Synced");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/login/);
  await expect(secondTab).toHaveURL(/login/);
  await expect(secondTab.getByText("Browser Tester")).toHaveCount(0);
  await secondTab.close();
  await page.goto("/app/profile");
  await expect(page).toHaveURL(/login/);
  await expect(page.getByText("Browser Tester")).toHaveCount(0);
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("wrong-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "That email and password don’t match.",
  );
  await page
    .getByLabel("Password", { exact: true })
    .fill("Milestone-browser-password!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByText("Welcome, Browser Tester")).toBeVisible();
});

test("Arabic registration and RTL onboarding remain usable without horizontal overflow", async ({
  page,
}) => {
  await page.goto("/register");
  await page.getByRole("button", { name: "العربية", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await page
    .getByLabel("البريد الإلكتروني")
    .fill(`arabic-${crypto.randomUUID()}@example.com`);
  await page
    .getByLabel("كلمة المرور", { exact: true })
    .fill("Arabic-browser-password!");
  await page.getByRole("button", { name: "إنشاء حساب", exact: true }).click();
  await expect(page).toHaveURL(/onboarding/);
  await page.getByLabel("بماذا نناديك؟").fill("أحمد");
  await expect(
    page.getByRole("combobox", { name: "اللغة", exact: true }),
  ).toHaveValue("ar");
  await page.getByRole("button", { name: "حفظ ومتابعة" }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(
    page.getByRole("heading", { name: "العادات الجيدة تبدأ هنا." }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("password recovery is generic and forms support keyboard navigation", async ({
  page,
}) => {
  await page.goto("/login");
  const email = page.getByLabel("Email address");
  await email.focus();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Password", { exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Show password" }).click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
    "type",
    "text",
  );
  await page.getByRole("link", { name: "Forgot your password?" }).click();
  await page
    .getByLabel("Email address")
    .fill(`missing-${crypto.randomUUID()}@example.com`);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("status")).toContainText(
    "If an active account exists",
  );
});
