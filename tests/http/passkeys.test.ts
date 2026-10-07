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
test("logout revokes only the current session and rejects cross-site or CSRF-less requests", async () => {
  const dir = mkdtempSync(join(tmpdir(), "kanban-logout-"));
  const store = openStore(join(dir, "board.sqlite"));
  const server = await startServer(store, { dataDir: dir, port: 0 });
  const origin = server.url.replace("127.0.0.1", "localhost");
  try {
    async function login(token: string) {
      const r = await fetch(origin + "/api/session", {
        method: "POST",
        headers: { Origin: origin, "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      return {
        cookie: r.headers.get("set-cookie")!.split(";")[0]!,
        csrf: (await r.json()).csrf as string,
      };
    }
    const first = await login(new URL(server.bootstrapUrl).hash.slice(1));
    const credential = (await import("node:fs")).readFileSync(
      join(dir, "credential"),
      "utf8",
    );
    const link = await fetch(server.url + "/ops/session", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + credential,
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    const second = await login(new URL((await link.json()).url).hash.slice(1));
    const logout = (csrf: string, from = origin) =>
      fetch(origin + "/api/logout", {
        method: "POST",
        headers: {
          Origin: from,
          Cookie: first.cookie,
          "X-CSRF-Token": csrf,
          "Content-Type": "application/json",
        },
        body: "{}",
      });
    assert.equal((await logout("")).status, 403);
    assert.equal(
      (await logout(first.csrf, "https://evil.example")).status,
      403,
    );
    const result = await logout(first.csrf);
    assert.equal(result.status, 200);
    assert.match(result.headers.get("set-cookie")!, /Max-Age=0/);
    assert.equal(
      (
        await fetch(origin + "/api/projects", {
          headers: { Cookie: first.cookie },
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await fetch(origin + "/api/projects", {
          headers: { Cookie: second.cookie },
        })
      ).status,
      200,
    );
  } finally {
    await server.close();
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
