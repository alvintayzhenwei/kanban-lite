import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openStore } from "../../src/storage/database.js";
import { startServer } from "../../src/http/server.js";
test("public passkey options cannot enroll or read board data", async () => {
  const dir = mkdtempSync(join(tmpdir(), "kanban-passkey-"));
  const store = openStore(join(dir, "board.sqlite"));
  const server = await startServer(store, { dataDir: dir, port: 0 });
  const origin = server.url.replace("127.0.0.1", "localhost");
  try {
    const options = await fetch(origin + "/api/passkeys/authenticate/options", {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: "{}",
    });
    assert.equal(options.status, 200);
    assert.equal((await options.json()).rpId, "localhost");
    assert.equal((await fetch(origin + "/api/projects")).status, 401);
    const post = (path: string, body: unknown = {}, from = origin) =>
      fetch(origin + path, {
        method: "POST",
        headers: { Origin: from, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    assert.equal((await post("/api/passkeys/register/options")).status, 401);
    assert.equal(
      (
        await post(
          "/api/passkeys/authenticate/options",
          {},
          "http://evil.example",
        )
      ).status,
      403,
    );
    assert.equal(
      (await post("/api/passkeys/authenticate/verify", {})).status,
      401,
    );
  } finally {
    await server.close();
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
test("enrollment requires fresh authenticated session and CSRF; ceremonies are bounded", async () => {
  const dir = mkdtempSync(join(tmpdir(), "kanban-passkey-"));
  const store = openStore(join(dir, "board.sqlite"));
  const server = await startServer(store, { dataDir: dir, port: 0 });
  const origin = server.url.replace("127.0.0.1", "localhost");
  const realNow = Date.now;
  try {
    const login = await fetch(origin + "/api/session", {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify({
        token: new URL(server.bootstrapUrl).hash.slice(1),
      }),
    });
    let cookie = login.headers.get("set-cookie")!.split(";")[0]!;
    const { csrf } = await login.json();
    const post = (path: string, body: unknown, token = csrf) =>
      fetch(origin + path, {
        method: "POST",
        headers: {
          Origin: origin,
          "Content-Type": "application/json",
          Cookie: cookie,
          "X-CSRF-Token": token,
        },
        body: JSON.stringify(body),
      });
    assert.equal(
      (await post("/api/passkeys/register/options", {}, "wrong")).status,
      403,
    );
    const opts = await post("/api/passkeys/register/options", {});
    assert.equal(opts.status, 200);
    assert.equal(
      (await opts.json()).authenticatorSelection.userVerification,
      "required",
    );
    assert.equal((await post("/api/passkeys/register/verify", {})).status, 401);
    assert.equal(store.db.prepare("SELECT id FROM passkeys").all().length, 0);
    const now = realNow();
    Date.now = () => now + 300001;
    assert.equal(
      (await post("/api/passkeys/register/options", {})).status,
      401,
    );
    Date.now = realNow;
    const first = await post("/api/passkeys/authenticate/options", {});
    cookie += "; " + first.headers.get("set-cookie")!.split(";")[0]!;
    for (let i = 0; i < 22; i++) {
      const r = await post("/api/passkeys/authenticate/options", {});
      if (i === 21) assert.equal(r.status, 429);
    }
    assert.equal(
      (
        await post("/api/passkeys/authenticate/verify", {
          payload: "x".repeat(66000),
        })
      ).status,
      413,
    );
  } finally {
    Date.now = realNow;
    await server.close();
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
