import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createServer } from "node:http";
import { BoardClient } from "../dist/client.js";
function dir(t) {
  const d = mkdtempSync(join(tmpdir(), "kanban-client-"));
  t.after(() => rmSync(d, { recursive: true, force: true }));
  return d;
}
function files(d, url, credential = "a".repeat(64), pid = process.pid) {
  mkdirSync(join(d, "service.lock"), { recursive: true });
  writeFileSync(
    join(d, "service.lock/owner.json"),
    JSON.stringify({ pid, url }),
  );
  writeFileSync(join(d, "credential"), credential);
}
async function serve(t, handler) {
  const s = createServer(handler);
  await new Promise((r) => s.listen(0, "127.0.0.1", r));
  t.after(
    () =>
      new Promise((r) => {
        s.close(r);
        s.closeAllConnections();
      }),
  );
  return `http://127.0.0.1:${s.address().port}`;
}
test("missing service and credential give actionable secret-free errors", async (t) => {
  const d = dir(t);
  const c = new BoardClient(d, "codex");
  await assert.rejects(c.call("list_projects", {}), /Start Kanban Lite/);
  files(d, "http://127.0.0.1:4317");
  rmSync(join(d, "credential"));
  await assert.rejects(c.call("list_projects", {}), /credential/);
  files(d, "http://127.0.0.1:4317", "INVALID_SECRET");
  try {
    await c.call("list_projects", {});
    assert.fail("expected error");
  } catch (e) {
    assert.match(e.message, /credential/);
    assert.equal(e.message.includes("INVALID_SECRET"), false);
  }
});
test("adapter never sends credentials to invalid endpoints", async (t) => {
  const d = dir(t);
  for (const url of [
    "https://127.0.0.1:4317",
    "http://localhost:4317",
    "http://evil.example:4317",
    "http://user:pass@127.0.0.1:4317",
    "http://127.0.0.1:4317/a",
    "http://127.0.0.1:4317/?x",
    "http://127.0.0.1:4317/#x",
    "http://2130706433:4317",
    "http://127.0.0.2:4317",
  ]) {
    files(d, url);
    await assert.rejects(
      new BoardClient(d, "codex").call("list_projects", {}),
      /loopback endpoint/,
    );
  }
});
test("redirected or incompatible health never gets credentials", async (t) => {
  const d = dir(t);
  let forwarded = 0;
  const target = await serve(t, (req, res) => {
    if (req.headers.authorization) forwarded++;
    res.end("{}");
  });
  const redirect = await serve(t, (req, res) => {
    assert.equal(req.headers.authorization, undefined);
    res.writeHead(302, { Location: target });
    res.end();
  });
  files(d, redirect);
  await assert.rejects(
    new BoardClient(d, "codex").call("list_projects", {}),
    /service|protocol/,
  );
  assert.equal(forwarded, 0);
  const wrong = await serve(t, (req, res) => {
    assert.equal(req.headers.authorization, undefined);
    res.end(JSON.stringify({ name: "kanban-lite", agentProtocolVersion: 0 }));
  });
  files(d, wrong);
  await assert.rejects(
    new BoardClient(d, "codex").call("list_projects", {}),
    /protocol/,
  );
});
test("timeouts are bounded and do not reveal credential", async (t) => {
  const d = dir(t);
  const url = await serve(t, () => {});
  files(d, url);
  const start = Date.now();
  await assert.rejects(
    new BoardClient(d, "codex", 50).call("list_projects", {}),
    /unavailable|timed out/,
  );
  assert.ok(Date.now() - start < 2000);
});
test("operation redirects are refused and conflict current state survives", async (t) => {
  const d = dir(t);
  let redirect = false;
  let targetCalls = 0;
  const target = await serve(t, (req, res) => {
    targetCalls++;
    res.end("{}");
  });
  const url = await serve(t, (req, res) => {
    if (req.url === "/health") {
      assert.equal(req.headers.authorization, undefined);
      res.end(JSON.stringify({ name: "kanban-lite", agentProtocolVersion: 1 }));
      return;
    }
    assert.equal(req.headers.authorization, `Bearer ${"a".repeat(64)}`);
    if (redirect) {
      res.writeHead(302, { Location: target });
      res.end();
      return;
    }
    res.writeHead(409, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        error: "Reload it",
        current: { id: "card", revision: 2, title: "Preserved" },
      }),
    );
  });
  files(d, url);
  await assert.rejects(
    new BoardClient(d, "claude").call("update_card", {}),
    (e) => e.code === "CONFLICT" && e.current.revision === 2,
  );
  redirect = true;
  await assert.rejects(
    new BoardClient(d, "claude").call("list_projects", {}),
    /service/,
  );
  assert.equal(targetCalls, 0);
});
