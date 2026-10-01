import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createServer } from "node:http";
import { startApplication } from "../../src/cli.js";
import { backupStore, restoreStore } from "../../src/storage/backup.js";
import { openStore } from "../../src/storage/database.js";

test("CLI restart preserves data and prevents a second writer", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "kanban-cli-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const config = { dataDir: dir, port: 0 };
  const app = await startApplication(config);
  await assert.rejects(startApplication(config), /running|lock/i);
  await assert.rejects(
    restoreStore(dir, join(dir, "missing.sqlite")),
    /running|lock/i,
  );
  await app.close();
  const s = openStore(join(dir, "board.sqlite"));
  s.db
    .prepare(
      "INSERT INTO projects(id,name,root,revision,created_at) VALUES(?,?,?,?,?)",
    )
    .run("p", "Persist", "/tmp/p", 1, "2026-10-01");
  const backup = join(dir, "saved.sqlite");
  await backupStore(s, backup);
  s.close();
  const next = await startApplication(config);
  const session = await fetch(`${next.url}/api/session`, {
    method: "POST",
    headers: { Origin: next.url, "Content-Type": "application/json" },
    body: JSON.stringify({ token: new URL(next.bootstrapUrl).hash.slice(1) }),
  });
  const cookie = session.headers.get("set-cookie")!.split(";")[0]!;
  const list = await (
    await fetch(`${next.url}/api/projects`, { headers: { Cookie: cookie } })
  ).json();
  assert.equal(list[0].name, "Persist");
  const online = await fetch(`${next.url}/ops/backup`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${readFileSync(join(dir, "credential"), "utf8")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ output: join(dir, "online.sqlite") }),
  });
  assert.equal(online.status, 200);
  assert.ok(existsSync(join(dir, "online.sqlite")));
  await next.close();
  await restoreStore(dir, backup);
  assert.ok(existsSync(join(dir, "board.sqlite")));
});
test("CLI failed startup removes only its own lock", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "kanban-cli-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const occupied = createServer();
  await new Promise<void>((r) => occupied.listen(0, "127.0.0.1", r));
  t.after(() => new Promise<void>((r) => occupied.close(() => r())));
  await assert.rejects(
    startApplication({
      dataDir: dir,
      port: (occupied.address() as { port: number }).port,
    }),
    /address|port|EADDRINUSE/i,
  );
  assert.equal(existsSync(join(dir, "service.lock")), false);
});
