import { test, expect, type Page } from "@playwright/test";
import { mkdtempSync, rmSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { openStore, type Store } from "../../src/storage/database.js";
import { startServer, type RunningServer } from "../../src/http/server.js";
let dir: string, store: Store, server: RunningServer;
test.beforeEach(async ({ page }) => {
  dir = realpathSync(mkdtempSync(join(tmpdir(), "kanban-browser-")));
  store = openStore(join(dir, "board.sqlite"));
  server = await startServer(store, { dataDir: dir, port: 0 });
  await page.goto(server.bootstrapUrl);
});
test.afterEach(async () => {
  await server.close();
  store.close();
  rmSync(dir, { recursive: true, force: true });
});
async function project(page: Page, name: string) {
  const root = join(dir, name);
  execFileSync("git", ["init", "--quiet", root]);
  await page.getByRole("button", { name: "Add project", exact: true }).click();
  await page.getByLabel("Project name").fill(name);
  await page.getByLabel("Repository path").fill(root);
  await page.getByRole("button", { name: "Register project" }).click();
  return root;
}
async function card(page: Page, title: string) {
  await page.getByRole("button", { name: "New card" }).click();
  await page.getByRole("textbox", { name: "Title", exact: true }).fill(title);
  await page.getByRole("button", { name: "Create card" }).click();
}
async function open(page: Page, title: string) {
  await page.getByRole("button", { name: title, exact: true }).click();
}
test("projects filter and keyboard controls manage workflow", async ({
  page,
}) => {
  await project(page, "Alpha");
  await card(page, "Build local board");
  await project(page, "Beta");
  await card(page, "Beta task");
  await page.getByLabel("Project filter").selectOption({ label: "Alpha" });
  await expect(
    page.getByRole("button", { name: "Beta task", exact: true }),
  ).toHaveCount(0);
  await open(page, "Build local board");
  await page.getByLabel("Owner", { exact: true }).fill("Claude");
  await page.getByLabel("Blocker reason").fill("Need design input");
  await page.getByLabel("Phase", { exact: true }).selectOption("Design");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Changes saved.", { exact: true })).toBeVisible();
  await page.getByLabel("Move to").selectOption("Ready");
  await page.getByRole("button", { name: "Move card", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByText("Moved to Ready.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close card" }).click();
  await expect(
    page
      .getByRole("region", { name: "Ready", exact: true })
      .getByRole("button", { name: "Build local board", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Need design input", { exact: true }),
  ).toBeVisible();
});
test("evidence, completion override, history and WIP warnings", async ({
  page,
}) => {
  await project(page, "Alpha");
  await page.getByRole("button", { name: "Project settings" }).click();
  await page.getByLabel("WIP limit").fill("1");
  await page.getByRole("button", { name: "Save project" }).click();
  await card(page, "First");
  await open(page, "First");
  await page.getByLabel("Move to").selectOption("In Progress");
  await page.getByRole("button", { name: "Move card", exact: true }).click();
  await page.getByRole("button", { name: "Close card" }).click();
  await card(page, "Second");
  await open(page, "Second");
  await page.getByLabel("Move to").selectOption("In Progress");
  await page.getByRole("button", { name: "Move card", exact: true }).click();
  await expect(page.getByText(/WIP limit 1 exceeded/)).toBeVisible();
  await page.getByLabel("Move to").selectOption("Done");
  await page.getByRole("button", { name: "Move card", exact: true }).click();
  await expect(page.getByText(/Record passing verification/)).toBeVisible();
  await page.getByLabel("Check name").fill("Tests");
  await page.getByLabel("Evidence summary").fill("All checks passed");
  await page.getByRole("button", { name: "Record evidence" }).click();
  await page.getByRole("button", { name: "Move card", exact: true }).click();
  await expect(page.getByText("Moved to Done.", { exact: true })).toBeVisible();
  await expect(
    page.getByText("evidence.recorded", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close card" }).click();
  await open(page, "First");
  await page.getByLabel("Move to").selectOption("Done");
  await page.getByRole("button", { name: "Completion override" }).click();
  await expect(
    page.getByRole("button", { name: "Confirm override" }),
  ).toBeDisabled();
  await page.getByLabel("Override reason").fill("Manual acceptance");
  await page.getByRole("button", { name: "Confirm override" }).click();
  await expect(page.getByText("Moved to Done.", { exact: true })).toBeVisible();
});
test("two tabs surface conflicts and preserve edits", async ({
  page,
  context,
}) => {
  await project(page, "Alpha");
  await card(page, "Shared card");
  const second = await context.newPage();
  await second.goto(server.url);
  await open(page, "Shared card");
  await open(second, "Shared card");
  await page
    .getByRole("textbox", { name: "Title", exact: true })
    .fill("First edit");
  await page.getByRole("button", { name: "Save changes" }).click();
  await second
    .getByRole("textbox", { name: "Title", exact: true })
    .fill("Lost edit");
  await second.getByRole("button", { name: "Save changes" }).click();
  await expect(second.getByText(/This item changed/)).toBeVisible();
  await expect(
    second.getByRole("textbox", { name: "Title", exact: true }),
  ).toHaveValue("Lost edit");
  await second.getByRole("button", { name: "Reload card" }).click();
  await expect(
    second.getByRole("textbox", { name: "Title", exact: true }),
  ).toHaveValue("First edit");
});
test("stored HTML remains text and narrow viewport remains usable", async ({
  page,
}) => {
  await project(page, "Alpha");
  const title = '<img src=x onerror="window.injected=true">';
  await card(page, title);
  await expect(
    page.getByRole("button", { name: title, exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => "injected" in window)).toBe(false);
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, title);
  await expect(
    page.getByRole("button", { name: "Save changes" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close card" }).click();
  await expect(page.getByRole("button", { name: "New card" })).toBeVisible();
});
