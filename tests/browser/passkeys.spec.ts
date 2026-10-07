import { test, expect } from "@playwright/test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openStore } from "../../src/storage/database.js";
import { startServer } from "../../src/http/server.js";
test("owner enrolls then signs in after cookies expire and service restarts", async ({
  page,
  context,
}) => {
  const dir = mkdtempSync(join(tmpdir(), "passkey-browser-"));
  let store = openStore(join(dir, "board.sqlite"));
  let server = await startServer(store, { dataDir: dir, port: 0 });
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
  try {
    await page.goto(server.bootstrapUrl);
    await expect(page.locator("#passkey-onboarding")).toBeVisible();
    await page
      .getByRole("button", { name: "Create passkey", exact: true })
      .click();
    await expect(
      page.getByText("Passkey created.", { exact: false }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Log out", exact: true }).click();
    await expect(page.locator("#login-panel")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Log out", exact: true }),
    ).toBeHidden();
    expect(store.db.prepare("SELECT id FROM passkeys").all()).toHaveLength(1);
    await page
      .getByRole("button", { name: "Sign in with passkey", exact: true })
      .click();
    await expect(page.locator("#workspace")).toBeVisible();
    const port = Number(new URL(server.url).port);
    await server.close();
    store.close();
    store = openStore(join(dir, "board.sqlite"));
    server = await startServer(store, { dataDir: dir, port });
    await page.reload();
    await page
      .getByRole("button", { name: "Sign in with passkey", exact: true })
      .click();
    await expect(page.locator("#workspace")).toBeVisible();
    if ((await page.locator("#passkey-settings").getAttribute("open")) === null)
      await page.getByText("Passkeys", { exact: true }).click();
    await page
      .getByRole("button", { name: "Remove passkey", exact: true })
      .click();
    await expect(page.locator("#login-panel")).toBeVisible();
    expect(store.db.prepare("SELECT id FROM passkeys").all()).toHaveLength(0);
  } finally {
    await server.close();
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
test("signed ceremonies reject tampered owner, origin, RP data and replay", async ({
  page,
  context,
}) => {
  const dir = mkdtempSync(join(tmpdir(), "passkey-attacks-"));
  const store = openStore(join(dir, "board.sqlite"));
  const server = await startServer(store, { dataDir: dir, port: 0 });
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
  try {
    await page.goto(server.bootstrapUrl);
    if ((await page.locator("#passkey-settings").getAttribute("open")) === null)
      await page.getByText("Passkeys", { exact: true }).click();
    await page
      .getByRole("button", { name: "Create passkey", exact: true })
      .click();
    await expect(
      page.getByText("Passkey created.", { exact: false }),
    ).toBeVisible();
    await context.clearCookies();
    await page.reload();
    for (const mode of ["owner", "origin", "rp", "verification", "signature"]) {
      const status = await page.evaluate(`(async()=>{
    const optionsJSON=await (await fetch('/api/passkeys/authenticate/options',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).json();
    const response=await window.SimpleWebAuthnBrowser.startAuthentication({optionsJSON});
    const mode=${JSON.stringify(mode)};
    if(mode==='owner') response.response.userHandle='d3Jvbmc';
    if(mode==='origin') { const data=JSON.parse(atob(response.response.clientDataJSON.replace(/-/g,'+').replace(/_/g,'/')));data.origin='https://evil.example';response.response.clientDataJSON=btoa(JSON.stringify(data)).replace(/=/g,'').replace(/\\+/g,'-').replace(/\\//g,'_'); }
    if(mode==='rp'||mode==='verification') { const raw=Uint8Array.from(atob(response.response.authenticatorData.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));if(mode==='rp')raw[0]^=1;else raw[32]&=~4;response.response.authenticatorData=btoa(String.fromCharCode(...raw)).replace(/=/g,'').replace(/\\+/g,'-').replace(/\\//g,'_'); }
    if(mode==='signature') response.response.signature='AA';
    return (await fetch('/api/passkeys/authenticate/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(response)})).status;
   })()`);
      expect(status).toBe(401);
      expect(
        (
          await page.request.get(
            server.url.replace("127.0.0.1", "localhost") + "/api/projects",
          )
        ).status(),
      ).toBe(401);
    }
    const response = await page.evaluate(
      `(async()=>{const optionsJSON=await (await fetch('/api/passkeys/authenticate/options',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).json();return window.SimpleWebAuthnBrowser.startAuthentication({optionsJSON});})()`,
    );
    const origin = server.url.replace("127.0.0.1", "localhost");
    const cookie = (await context.cookies()).find(
      (c) => c.name === "kanban_preauth",
    )!;
    const valid = await page.request.post(
      origin + "/api/passkeys/authenticate/verify",
      { headers: { Origin: origin }, data: response },
    );
    expect(valid.status()).toBe(200);
    await context.clearCookies();
    await context.addCookies([cookie]);
    expect(
      (
        await page.request.post(origin + "/api/passkeys/authenticate/verify", {
          headers: { Origin: origin },
          data: response,
        })
      ).status(),
    ).toBe(401);
    expect((await page.request.get(origin + "/api/projects")).status()).toBe(
      401,
    );
  } finally {
    await server.close();
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
test("unsupported browsers keep CLI recovery visible without exposing board data", async ({
  page,
}) => {
  const dir = mkdtempSync(join(tmpdir(), "passkey-fallback-"));
  const store = openStore(join(dir, "board.sqlite"));
  const server = await startServer(store, { dataDir: dir, port: 0 });
  try {
    await page.addInitScript(() => {
      Object.defineProperty(window, "PublicKeyCredential", {
        value: undefined,
      });
    });
    await page.goto(server.url.replace("127.0.0.1", "localhost"));
    await expect(
      page.getByRole("button", { name: "Sign in with passkey", exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByText(
        "Passkeys are unavailable in this browser. Open Chrome or use CLI recovery.",
      ),
    ).toBeVisible();
    await expect(page.locator("#workspace")).toBeHidden();
    await page.getByText("First-time setup", { exact: true }).click();
    await expect(page.locator("#setup-command")).toContainText(
      "kanban-lite open --data-dir",
    );
    await expect(
      page.getByRole("button", { name: "Check connection", exact: true }),
    ).toBeVisible();
    await page.getByText("Need help?", { exact: true }).click();
    await expect(page.locator("#login-help")).toContainText("private key");
  } finally {
    await server.close();
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("first-time users can cancel enrollment and defer it without losing board access", async ({
  page,
}) => {
  const dir = mkdtempSync(join(tmpdir(), "passkey-onboarding-"));
  const store = openStore(join(dir, "board.sqlite"));
  const server = await startServer(store, { dataDir: dir, port: 0 });
  try {
    await page.goto(server.bootstrapUrl);
    await expect(page.locator("#passkey-onboarding")).toBeVisible();
    await page.evaluate(() => {
      (
        window as unknown as {
          SimpleWebAuthnBrowser: { startRegistration: () => Promise<never> };
        }
      ).SimpleWebAuthnBrowser.startRegistration = async () => {
        throw new DOMException("Canceled", "NotAllowedError");
      };
    });
    await page
      .getByRole("button", { name: "Create passkey", exact: true })
      .click();
    await expect(page.locator("#passkey-message")).toContainText(
      "canceled or timed out",
    );
    await expect(page.locator("#workspace")).toBeVisible();
    await page
      .getByRole("button", { name: "Do this later", exact: true })
      .click();
    await expect(page.locator("#passkey-onboarding")).toBeHidden();
    await page.reload();
    await expect(page.locator("#workspace")).toBeVisible();
    await expect(page.locator("#passkey-onboarding")).toBeHidden();
  } finally {
    await server.close();
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
