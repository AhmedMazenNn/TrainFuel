import { test, expect, type Page } from "@playwright/test";
import path from "node:path";

async function setup(page: Page) {
  await page.goto("/register");
  await page
    .getByLabel("Email address")
    .fill(`training-${crypto.randomUUID()}@example.com`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("Training-browser-password!");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page).toHaveURL(/onboarding/);
  await page.getByLabel("What should we call you?").fill("Training Tester");
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(page.locator(".sync-status")).toHaveText("Synced");
  await page.goto("/app/training");
  await page
    .getByRole("button", { name: "Create exercise", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Name · English", { exact: true })
    .fill("Private row");
  await dialog
    .getByLabel("Instructions (one step per line) · English")
    .fill("Brace your trunk\nPull smoothly");
  await dialog.getByLabel("Name · العربية", { exact: true }).fill("سحب خاص");
  await dialog
    .getByLabel("Instructions (one step per line) · العربية")
    .fill("ثبّت الجذع\nاسحب بهدوء");
  await dialog.getByRole("button", { name: "Save on this device" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Private row" }),
  ).toBeVisible();
  await expect(page.locator(".sync-status")).toHaveText("Synced");
  await page
    .getByRole("button", { name: "Workout folders", exact: true })
    .click();
  await page.getByRole("button", { name: "New folder", exact: true }).click();
  await dialog.getByLabel("Folder name").fill("Pull day");
  await dialog
    .getByLabel("Add exercise", { exact: true })
    .selectOption({ label: "Private row" });
  await dialog
    .getByRole("button", { name: "Add exercise", exact: true })
    .click();
  await dialog.getByLabel("Weight (kg)").fill("20");
  await dialog.getByLabel("Repetitions").fill("12");
  await dialog.getByRole("button", { name: "Add set" }).click();
  await dialog.getByLabel("Weight (kg)").nth(1).fill("22");
  await dialog.getByLabel("Repetitions").nth(1).fill("10");
  await dialog.getByRole("button", { name: "Add set" }).click();
  await dialog.getByLabel("Weight (kg)").nth(2).fill("22");
  await dialog.getByLabel("Repetitions").nth(2).fill("8");
  await dialog.getByRole("button", { name: "Save on this device" }).click();
  await expect(dialog).not.toBeVisible();
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

test("offline prescriptions and records survive reload; folder deletion preserves history", async ({
  page,
  context,
}) => {
  await setup(page);
  await expect(page.getByText("20 kg × 12", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Download for offline" }).click();
  await expect(page.getByText(/Downloaded · Offline storage/)).toBeVisible();
  await context.setOffline(true);
  await page.getByRole("button", { name: "Record sets", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Weight (kg)").first().fill("24");
  await dialog.getByLabel("Notes").fill("Offline performed record");
  await dialog.getByRole("button", { name: "Save on this device" }).click();
  await expect(dialog).not.toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Lift history", exact: true }).click();
  await expect(
    page.getByText("Offline performed record", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("24 kg × 12", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Workout folders", exact: true })
    .click();
  await expect(page.getByText("20 kg × 12", { exact: true })).toBeVisible();
  await context.setOffline(false);
  await expect(page.locator(".sync-status")).toHaveText("Synced");
  const records = await (
    await page.request.get("/api/training/records/")
  ).json();
  expect(records.results[0].sets[0].weight_kg).toBe("24.000");
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await dialog.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator(".sync-status")).toHaveText("Synced");
  expect(
    (await (await page.request.get("/api/training/records/")).json()).results[0]
      .folder_exercise_id,
  ).toBeNull();
  await page.getByRole("button", { name: "Lift history", exact: true }).click();
  await expect(
    page.getByText("Offline performed record", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "العربية", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(
    page.getByRole("heading", { name: "سحب خاص", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("folder conflict preserves local prescription and authoritative server version", async ({
  page,
  context,
}) => {
  await setup(page);
  const folder = (
    await (await page.request.get("/api/training/folders/")).json()
  ).results[0];
  await context.setOffline(true);
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Folder name").fill("Offline plan");
  await dialog.getByRole("button", { name: "Save on this device" }).click();
  await expect(dialog).not.toBeVisible();
  const cookies = await context.cookies(),
    csrf = cookies.find((c) => c.name === "csrftoken")!.value;
  const { id, revision, ...body } = folder;
  const strip = (set: any) => ({
    id: set.id,
    weight_kg: set.weight_kg,
    reps: set.reps,
  });
  const response = await page.request.put(`/api/training/folders/${id}/`, {
    headers: { "X-CSRFToken": csrf },
    data: {
      ...body,
      revision,
      name: "Other device plan",
      entries: body.entries.map((e: any) => ({
        id: e.id,
        exercise_id: e.exercise_id,
        sets: e.sets.map(strip),
      })),
    },
  });
  expect(response.status()).toBe(200);
  await context.setOffline(false);
  await expect(page.locator(".sync-status")).toHaveText("Needs your attention");
  await page.getByRole("link", { name: "View sync details" }).click();
  await expect(
    page.getByRole("heading", { name: "Offline plan", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Other device plan", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Keep my version" }).click();
  await expect(page.locator(".sync-status")).toHaveText("Synced");
  expect(
    (await (await page.request.get(`/api/training/folders/${id}/`)).json())
      .name,
  ).toBe("Offline plan");
});

test("explicit media download works offline and folder ordering replays atomically", async ({
  page,
  context,
}) => {
  await setup(page);
  await page.getByRole("button", { name: "Exercises", exact: true }).click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Optional image or GIF")
    .setInputFiles(path.join(import.meta.dirname, "fixtures/exercise.png"));
  await dialog.getByRole("button", { name: "Save on this device" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator(".sync-status")).toHaveText("Synced");
  await page
    .getByRole("button", { name: "Upload and attach", exact: true })
    .click();
  await expect(page.locator(".sync-status")).toHaveText("Synced");
  await expect(page.locator(".exercise-image")).toBeVisible();
  await page
    .getByRole("button", { name: "Workout folders", exact: true })
    .click();
  await page.getByRole("button", { name: "Download for offline" }).click();
  await expect(page.getByText(/Downloaded · Offline storage/)).toBeVisible();
  await page.getByRole("button", { name: "Duplicate", exact: true }).click();
  await dialog.getByRole("button", { name: "Save on this device" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator(".sync-status")).toHaveText("Synced");
  await context.setOffline(true);
  await page
    .getByRole("button", { name: "Move up Pull day (Duplicate)", exact: true })
    .click();
  await expect(page.locator(".folder-card h2").first()).toHaveText(
    "Pull day (Duplicate)",
  );
  await page.reload();
  await page
    .getByRole("button", { name: "Workout folders", exact: true })
    .click();
  await expect(page.locator(".folder-card h2").first()).toHaveText(
    "Pull day (Duplicate)",
  );
  await page.getByRole("button", { name: "Exercises", exact: true }).click();
  await expect(page.locator(".exercise-image")).toBeVisible();
  await context.setOffline(false);
  await expect(page.locator(".sync-status")).toHaveText("Synced");
  const folders = await (
    await page.request.get("/api/training/folders/")
  ).json();
  expect(folders.results[0].name).toBe("Pull day (Duplicate)");
  expect(folders.results.map((f: any) => f.position)).toEqual([1, 2]);
  await page
    .getByRole("button", { name: "Workout folders", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Remove offline download", exact: true })
    .click();
  await page.reload();
  await expect(page.locator(".exercise-image")).toBeVisible(); // Online delivery remains available after cache removal.
});
