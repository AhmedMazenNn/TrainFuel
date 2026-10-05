import { test, expect, type Page } from "@playwright/test";
test.setTimeout(60000);
const password = "Nutrition-browser-password!";
async function register(page: Page) {
  const email = `nutrition-${crypto.randomUUID()}@example.com`;
  await page.goto("/register");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page).toHaveURL(/onboarding/);
  await page.getByLabel("What should we call you?").fill("Nutrition Tester");
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.locator(".sync-status")).toHaveText("Synced", {
    timeout: 15000,
  });
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise<void>((r) =>
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          () => r(),
          { once: true },
        ),
      );
  });
  return email;
}
async function food(
  page: Page,
  name: string,
  calories = "200",
  protein = "30",
) {
  const f = page.locator("#food-form");
  await f.getByLabel("Food or meal name").fill(name);
  await f.getByLabel("Portion weight (g)").fill("150");
  await f.getByLabel("Calories (kcal)").fill(calories);
  await f.getByLabel("Protein (g)").fill(protein);
  await f.getByLabel("Carbohydrates (g)").fill("0");
  await f.getByLabel("Fat (g)").fill("0");
  await f.getByRole("combobox").selectOption("complete");
  await f.getByRole("button", { name: "Save food", exact: true }).click();
  await expect(
    page.locator(".nutrition-entries").getByRole("heading", { name }),
  ).toBeVisible();
}
test("portion totals, targets, historical moves and explicit zero survive offline reload", async ({
  page,
  context,
}) => {
  await register(page);
  await page.goto("/app/nutrition");
  await page.getByRole("button", { name: "Start New Day" }).click();
  const snapshot = page.locator(".snapshot-form");
  await snapshot.getByLabel("Calories (kcal)").fill("2500");
  await snapshot
    .getByRole("button", { name: "Save this day’s targets" })
    .click();
  await expect(page.locator(".sync-status")).toHaveText("Synced", {
    timeout: 15000,
  });
  await context.setOffline(true);
  await food(page, "Lunch");
  await food(page, "Dinner", "300", "0");
  await expect(page.locator(".nutrient-card").first()).toContainText(
    "500 / 2,500",
  );
  await expect(page.locator(".nutrient-card").nth(1)).toContainText("30 /");
  await page.reload();
  await expect(
    page.locator(".nutrition-entries").getByRole("heading", { name: "Lunch" }),
  ).toBeVisible();
  await expect(page.locator(".nutrient-card").first()).toContainText(
    "500 / 2,500",
  );
  await page
    .locator(".nutrition-entries article")
    .filter({ hasText: "Lunch" })
    .getByRole("button", { name: "Edit", exact: true })
    .click();
  await page.locator("#food-form").getByLabel("Entry date").fill("2026-01-01");
  await page
    .locator("#food-form")
    .getByRole("button", { name: "Save food", exact: true })
    .click();
  await expect(page.getByLabel("Selected date")).toHaveValue("2026-01-01");
  await expect(page.locator(".nutrient-card").first()).toContainText("200 /");
  await context.setOffline(false);
  await expect(page.locator(".sync-status")).toHaveText("Synced", {
    timeout: 15000,
  });
  const data = await (await page.request.get("/api/nutrition/entries/")).json();
  expect(data.results).toHaveLength(2);
  expect(
    data.results.find((r: { name: string }) => r.name === "Lunch").protein_g,
  ).toBe("30.000");
});
test("two offline devices canonicalize today and retain both meals", async ({
  page,
  context,
  browser,
}) => {
  const email = await register(page);
  const origin = new URL(page.url()).origin;
  const other = await browser.newContext({ baseURL: origin });
  try {
    const second = await other.newPage();
    await second.goto("/login");
    await second.getByLabel("Email address").fill(email);
    await second.getByLabel("Password", { exact: true }).fill(password);
    await second.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(second).toHaveURL(/\/app$/);
    await expect(second.locator(".sync-status")).toHaveText("Synced", {
      timeout: 15000,
    });
    await page.goto("/app/nutrition");
    await second.goto("/app/nutrition");
    await context.setOffline(true);
    await other.setOffline(true);
    await page.getByRole("button", { name: "Start New Day" }).click();
    await second.getByRole("button", { name: "Start New Day" }).click();
    await food(page, "Device A");
    await food(second, "Device B");
    await context.setOffline(false);
    await expect(page.locator(".sync-status")).toHaveText("Synced", {
      timeout: 15000,
    });
    await other.setOffline(false);
    await expect(second.locator(".sync-status")).toHaveText("Synced", {
      timeout: 15000,
    });
    const days = await (
        await second.request.get("/api/nutrition/days/")
      ).json(),
      entries = await (
        await second.request.get("/api/nutrition/entries/")
      ).json();
    expect(days.results).toHaveLength(1);
    expect(entries.results).toHaveLength(2);
    expect(
      new Set(entries.results.map((e: { day: string }) => e.day)).size,
    ).toBe(1);
    await expect(
      second
        .locator(".nutrition-entries")
        .getByRole("heading", { name: "Device A" }),
    ).toBeVisible();
    await expect(
      second
        .locator(".nutrition-entries")
        .getByRole("heading", { name: "Device B" }),
    ).toBeVisible();
  } finally {
    await other.close();
  }
});
test("unknown draft and Arabic RTL remain usable", async ({ page }) => {
  await register(page);
  await page.goto("/app/nutrition");
  await page.getByRole("button", { name: "Start New Day" }).click();
  const form = page.locator("#food-form");
  await form.getByLabel("Food or meal name").fill("Incomplete");
  await form.getByLabel("Portion weight (g)").fill("100");
  await form.getByLabel("Protein (g)").fill("0");
  await form.getByRole("button", { name: "Save food", exact: true }).click();
  await expect(page.locator(".nutrition-counters")).toContainText(
    "Partial totals",
  );
  await page.getByRole("button", { name: "العربية", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(
    page.getByRole("heading", { name: "التغذية", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(page.locator(".nutrition-history")).toContainText(
    "الأيام المفقودة مستبعدة",
  );
});
test("food conflict shows both versions and explicitly rebases the saved portion", async ({
  page,
  context,
}) => {
  await register(page);
  await page.goto("/app/nutrition");
  await page.getByRole("button", { name: "Start New Day" }).click();
  await food(page, "Conflicted meal");
  await expect(page.locator(".sync-status")).toHaveText("Synced", {
    timeout: 15000,
  });
  const result = await (
    await page.request.get("/api/nutrition/entries/")
  ).json();
  const row = result.results[0];
  const csrf = (await context.cookies()).find(
    (c) => c.name === "csrftoken",
  )!.value;
  await context.setOffline(true);
  await page
    .locator(".nutrition-entries article")
    .getByRole("button", { name: "Edit", exact: true })
    .click();
  await page.locator("#food-form").getByLabel("Calories (kcal)").fill("500");
  await page
    .locator("#food-form")
    .getByRole("button", { name: "Save food", exact: true })
    .click();
  const response = await page.request.patch(
    `/api/nutrition/entries/${row.id}/`,
    {
      headers: { "X-CSRFToken": csrf },
      data: {
        revision: row.revision,
        payload: {
          day: row.day,
          name: row.name,
          portion_g: row.portion_g,
          calories_kcal: "300",
          protein_g: row.protein_g,
          carbs_g: row.carbs_g,
          fat_g: row.fat_g,
          status: row.status,
          brand_source: row.brand_source,
          notes: row.notes,
        },
      },
    },
  );
  expect(response.status()).toBe(200);
  await context.setOffline(false);
  await expect(page.locator(".sync-status")).toHaveText("Needs your attention");
  await page.getByRole("link", { name: "View sync details" }).click();
  await expect(page.locator(".conflict-versions")).toContainText("500");
  await expect(page.locator(".conflict-versions")).toContainText("300.000");
  await page.getByRole("button", { name: "Keep my version" }).click();
  await expect(page.locator(".sync-status")).toHaveText("Synced", {
    timeout: 15000,
  });
  expect(
    (await (await page.request.get(`/api/nutrition/entries/${row.id}/`)).json())
      .calories_kcal,
  ).toBe("500.000");
});
test("schedule edits preserve existing snapshots and apply only to new days", async ({
  page,
}) => {
  await register(page);
  await page.goto("/app/nutrition");
  await page.getByRole("button", { name: "Start New Day" }).click();
  await page.locator(".nutrition-schedule summary").click();
  const schedule = page.locator(".nutrition-schedule form");
  await schedule.getByLabel("Effective date").fill("2025-01-01");
  await schedule.getByLabel("Calories (kcal)").fill("2500");
  await schedule.getByLabel("Protein (g)").fill("150");
  await schedule.getByLabel("Carbohydrates (g)").fill("300");
  await schedule.getByLabel("Fat (g)").fill("60");
  await schedule.getByRole("button", { name: "Save target schedule" }).click();
  await expect(page.locator(".sync-status")).toHaveText("Synced", {
    timeout: 15000,
  });
  await expect(
    page.locator(".snapshot-form").getByLabel("Calories (kcal)"),
  ).toHaveValue("");
  await page.getByLabel("Selected date").fill("2026-01-01");
  await page.getByRole("button", { name: "Open selected day" }).click();
  await expect(
    page.locator(".snapshot-form").getByLabel("Calories (kcal)"),
  ).toHaveValue(/^2500(?:\.000)?$/);
  await schedule.getByLabel("Calories (kcal)").fill("3000");
  await schedule.getByRole("button", { name: "Save target schedule" }).click();
  await expect(page.locator(".sync-status")).toHaveText("Synced", {
    timeout: 15000,
  });
  await expect(
    page.locator(".snapshot-form").getByLabel("Calories (kcal)"),
  ).toHaveValue(/2500/);
  await page.getByLabel("Selected date").fill("2026-01-02");
  await page.getByRole("button", { name: "Open selected day" }).click();
  await expect(
    page.locator(".snapshot-form").getByLabel("Calories (kcal)"),
  ).toHaveValue(/^3000(?:\.000)?$/);
});
