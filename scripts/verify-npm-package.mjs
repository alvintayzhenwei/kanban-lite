import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, posix } from "node:path";
import { pathToFileURL } from "node:url";

const temporary = mkdtempSync(join(tmpdir(), "kanban-lite-package-"));
const manifest = JSON.parse(readFileSync("package.json", "utf8"));
try {
  const [packed] = JSON.parse(
    execFileSync("npm", ["pack", "--json", "--pack-destination", temporary], {
      encoding: "utf8",
    }),
  );
  const files = packed.files.map((file) => file.path);
  for (const file of files) {
    assert(
      /^(dist\/src\/.*\.js|public\/[^/]+|docs\/(?:README\.md|publishing\.md|mcp-setup\.md|setup-prompts\.md|(?:getting-started|guides)\/[^/]+\.md|assets\/[^/]+\.png)|package\.json|README\.md|CHANGELOG\.md|LICENSE|SECURITY\.md)$/.test(
        file,
      ),
      `Unexpected package file: ${file}`,
    );
  }
  for (const required of [
    "dist/src/cli.js",
    "public/index.html",
    "LICENSE",
    "CHANGELOG.md",
    "docs/README.md",
    "docs/getting-started/browser-login.md",
    "docs/guides/auto-start.md",
    "docs/assets/onboarding-desktop.png",
  ])
    assert(files.includes(required), `Missing package file: ${required}`);
  for (const file of files.filter((name) => name.endsWith(".md"))) {
    const markdown = readFileSync(file, "utf8");
    for (const [, target] of markdown.matchAll(/\]\(([^)\s]+)\)/g)) {
      if (/^(?:https?:|#)/.test(target)) continue;
      const linkedFile = posix.normalize(
        posix.join(posix.dirname(file), target.split("#")[0]),
      );
      assert(
        files.includes(linkedFile),
        `Missing packaged documentation link: ${file} → ${target}`,
      );
    }
  }
  execFileSync(
    "npm",
    [
      "install",
      "--prefix",
      temporary,
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      join(temporary, packed.filename),
    ],
    { stdio: "pipe" },
  );
  const help = execFileSync(
    join(temporary, "node_modules/.bin/kanban-lite"),
    ["--help"],
    { encoding: "utf8" },
  );
  assert(help.includes("kanban-lite start"));
  assert(help.includes("kanban-lite open"));
  const installed = resolve(temporary, "node_modules", manifest.name);
  const { startApplication, requestBrowserLogin } = await import(
    pathToFileURL(join(installed, "dist/src/cli.js"))
  );
  const app = await startApplication({
    port: 0,
    dataDir: join(temporary, "data"),
  });
  try {
    const health = await fetch(`${app.url}/health`);
    assert.equal(health.status, 200);
    assert.equal((await health.json()).version, manifest.version);
    const loginUrl = await requestBrowserLogin(join(temporary, "data"));
    const login = await fetch(`${app.url}/api/session`, {
      method: "POST",
      headers: { Origin: app.url, "Content-Type": "application/json" },
      body: JSON.stringify({ token: new URL(loginUrl).hash.slice(1) }),
    });
    assert.equal(login.status, 200);
    const cookie = login.headers.get("set-cookie").split(";")[0];
    assert.equal(
      (
        await fetch(`${app.url}/api/projects`, {
          headers: { Cookie: cookie },
        })
      ).status,
      200,
    );
    const browser = await chromium.launch();
    try {
      const context = await browser.newContext();
      const page = await context.newPage();
      const cdp = await context.newCDPSession(page);
      await cdp.send("WebAuthn.enable");
      await cdp.send("WebAuthn.addVirtualAuthenticator", {
        options: {
          protocol: "ctap2",
          transport: "internal",
          hasResidentKey: true,
          hasUserVerification: true,
          isUserVerified: true,
          automaticPresenceSimulation: true,
        },
      });
      await page.goto(await requestBrowserLogin(join(temporary, "data")));
      await page.locator("#passkey-onboarding").waitFor({ state: "visible" });
      await page
        .getByRole("button", { name: "Create passkey", exact: true })
        .click();
      await page
        .locator("#passkey-message")
        .filter({ hasText: "Passkey created." })
        .waitFor();
      await context.clearCookies();
      await page.reload();
      await page
        .getByRole("button", { name: "Sign in with passkey", exact: true })
        .click();
      await page.locator("#workspace").waitFor({ state: "visible" });
    } finally {
      await browser.close();
    }
    for (const path of [
      "/health",
      "/",
      "/app.js",
      "/styles.css",
      "/passkeys.js",
      "/webauthn.js",
    ]) {
      const response = await fetch(`${app.url}${path}`);
      assert.equal(response.status, 200, path);
      assert((await response.text()).length > 0, path);
    }
  } finally {
    await app.close();
  }
  console.log(
    `Verified ${packed.name}@${packed.version}: ${files.length} files, installed CLI and HTTP assets.`,
  );
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
