import { chromium } from "@playwright/test";
import { mkdtempSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { openStore } from "../dist/src/storage/database.js";
import { startServer } from "../dist/src/http/server.js";
import { registerProject } from "../dist/src/domain/projects.js";
import { createCard, updateCard, moveCard } from "../dist/src/domain/cards.js";
import { recordEvidence } from "../dist/src/domain/evidence.js";
const dir = mkdtempSync(join(tmpdir(), "kanban-preview-"));
const store = openStore(join(dir, "board.sqlite"));
const actor = { client: "browser", humanSession: true };
let server, browser;
try {
  const projects = [];
  for (const name of ["Kanban Lite", "Plugin integration"]) {
    const root = join(dir, name);
    execFileSync("git", ["init", "--quiet", root]);
    projects.push(await registerProject(store, { name, root }, actor));
  }
  for (const [index, title, column, phase, owner, blockedReason] of [
    [0, "Build localhost board", "Done", "Verification", "Codex", null],
    [
      0,
      "Validate backup and recovery",
      "Review",
      "Verification",
      "Codex",
      null,
    ],
    [1, "Package Claude + Codex adapters", "Ready", "Planning", null, null],
    [1, "Connect OpenSpec task progress", "Backlog", "Discovery", null, null],
    [
      1,
      "Review SDLC handoffs",
      "In Progress",
      "Design",
      "Claude",
      "Waiting for design review",
    ],
  ]) {
    let c = createCard(
      store,
      { projectId: projects[index].id, title },
      0,
      actor,
    );
    c = updateCard(
      store,
      c.id,
      c.revision,
      { phase, owner, blockedReason, priority: index ? "normal" : "high" },
      actor,
    );
    if (column === "Done")
      c = recordEvidence(
        store,
        c.id,
        c.revision,
        {
          name: "Sample verification",
          outcome: "passed",
          summary: "Illustrative sample data",
        },
        actor,
      );
    moveCard(store, c.id, c.revision, column, actor);
  }
  server = await startServer(store, { dataDir: dir, port: 0 });
  browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1540, height: 960 },
  });
  await page.goto(server.bootstrapUrl);
  await page
    .getByRole("button", { name: "Build localhost board", exact: true })
    .waitFor();
  mkdirSync("docs/assets", { recursive: true });
  await page
    .getByRole("button", { name: "Do this later", exact: true })
    .click();
  await page.screenshot({
    path: "docs/assets/board-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "docs/assets/board-mobile.png",
    fullPage: true,
  });
  const loggedOut = await browser.newPage({
    viewport: { width: 1280, height: 900 },
  });
  await loggedOut.goto(server.url.replace("127.0.0.1", "localhost"));
  await loggedOut.getByText("First-time setup", { exact: true }).click();
  await loggedOut
    .getByRole("button", { name: "Copy setup prompt", exact: true })
    .waitFor();
  await loggedOut.screenshot({
    path: "docs/assets/onboarding-desktop.png",
    fullPage: true,
  });
  await loggedOut.setViewportSize({ width: 390, height: 844 });
  await loggedOut.screenshot({
    path: "docs/assets/onboarding-mobile.png",
    fullPage: true,
  });
  console.log(
    "Captured desktop and narrow-screen board previews with illustrative sample data.",
  );
} finally {
  await browser?.close();
  await server?.close();
  store.close();
  rmSync(dir, { recursive: true, force: true });
}
