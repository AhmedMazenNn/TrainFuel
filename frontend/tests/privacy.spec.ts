import { expect, test } from "@playwright/test";

test("privacy export creates a receipt and exposes status without photos by default", async ({ page }) => {
  const email = `privacy-${crypto.randomUUID()}@example.com`;
  await page.goto("/register");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("Privacy-browser-password!");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await page.getByLabel("What should we call you?").fill("Privacy Tester");
  await page.getByRole("button", { name: "Save and continue" }).click();
  await page.getByRole("link", { name: "Privacy", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Your data and privacy" })).toBeVisible();
  await expect(page.getByLabel("Include my progress photo originals")).not.toBeChecked();
  await page.getByRole("button", { name: "Prepare export" }).click();
  await expect(page.getByText("Waiting to be processed").first()).toBeVisible();
  await page.getByRole("button", { name: "Check status" }).click();
  await expect(page.locator(".privacy-receipt")).toContainText("Waiting to be processed");
});

test("privacy controls remain localized in Arabic and an invalid deletion password is rejected", async ({ page }) => {
  const email = `privacy-ar-${crypto.randomUUID()}@example.com`;
  await page.goto("/register");
  await page.getByRole("button", { name: "العربية", exact: true }).click();
  await page.getByLabel("البريد الإلكتروني").fill(email);
  await page.getByLabel("كلمة المرور", { exact: true }).fill("Privacy-ar-browser-password!");
  await page.getByRole("button", { name: "إنشاء حساب", exact: true }).click();
  await page.getByLabel("بماذا نناديك؟").fill("مختبر الخصوصية");
  await page.getByRole("button", { name: "حفظ ومتابعة" }).click();
  await page.getByRole("link", { name: "الخصوصية", exact: true }).click();
  await expect(page.getByRole("heading", { name: "بياناتك وخصوصيتك" })).toBeVisible();
  await page.getByLabel("تأكيد بريد الحساب").fill(email);
  await page.getByLabel("كلمة المرور الحالية").fill("wrong-password");
  await page.getByLabel("أفهم أن هذا الإجراء سيحذف حسابي وبياناتي نهائياً.").check();
  await page.getByRole("button", { name: "طلب الحذف النهائي" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page).toHaveURL(/app\/privacy/);
});
