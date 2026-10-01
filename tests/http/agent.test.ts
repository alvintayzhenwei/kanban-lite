import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fixture } from "../helpers.js";
import { startServer } from "../../src/http/server.js";
async function setup(t: TestContext) {
  const f = fixture(t);
  const server = await startServer(f.store, { dataDir: f.dir, port: 0 });
  t.after(() => server.close());
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${readFileSync(join(f.dir, "credential"), "utf8")}`,
  };
  async function call(
    operation: string,
    args: Record<string, unknown> = {},
    client = "codex",
  ) {
    const response = await fetch(`${server.url}/agent/operation`, {
      method: "POST",
      headers,
      body: JSON.stringify({ operation, arguments: args, client }),
    });
    return { status: response.status, body: await response.json() };
  }
  return { ...f, server, headers, call };
}
test("agent endpoint requires bearer and rejects browser origins and identity forgery", async (t) => {
  const { server, headers, call } = await setup(t);
  const health = await (await fetch(`${server.url}/health`)).json();
  assert.equal(health.agentProtocolVersion, 1);
  for (const authorization of [
    "",
    "Bearer bad",
    headers.Authorization.slice(7),
    `Bearer ${"é".repeat(64)}`,
  ]) {
    const response = await fetch(`${server.url}/agent/operation`, {
      method: "POST",
      headers: { ...headers, Authorization: authorization },
      body: JSON.stringify({
        client: "codex",
        operation: "list_projects",
        arguments: {},
      }),
    });
    assert.equal(response.status, 403);
  }
  for (const origin of [server.url, "https://hostile.example", ""]) {
    const response = await fetch(`${server.url}/agent/operation`, {
      method: "POST",
      headers: { ...headers, Origin: origin },
      body: "{}",
    });
    assert.equal(response.status, 403);
  }
  assert.equal((await call("list_projects", {}, "browser")).status, 400);
  for (const payload of [
    "{bad",
    JSON.stringify({
      client: "codex",
      operation: "list_projects",
      arguments: {},
      humanSession: true,
    }),
    JSON.stringify({
      client: "codex",
      operation: "list_projects",
      arguments: { humanSession: true },
    }),
  ]) {
    const r = await fetch(`${server.url}/agent/operation`, {
      method: "POST",
      headers,
      body: payload,
    });
    assert.equal(r.status, 400);
  }
  assert.equal((await call("delete_card")).status, 400);
  assert.equal((await call("/ops/backup")).status, 400);
  const oversized = await fetch(`${server.url}/agent/operation`, {
    method: "POST",
    headers,
    body: "x".repeat(66000),
  });
  assert.equal(oversized.status, 413);
  const login = await fetch(`${server.url}/api/session`, {
    method: "POST",
    headers: { Origin: server.url, "Content-Type": "application/json" },
    body: JSON.stringify({ token: new URL(server.bootstrapUrl).hash.slice(1) }),
  });
  const cookie = login.headers.get("set-cookie")!.split(";")[0]!;
  assert.equal(
    (
      await fetch(`${server.url}/agent/operation`, {
        method: "POST",
        headers: { Cookie: cookie, "Content-Type": "application/json" },
        body: "{}",
      })
    ).status,
    403,
  );
});
test("agent operations share card revisions, attribution and evidence policy", async (t) => {
  const { call, repo } = await setup(t);
  const project = await call("register_project", {
    name: "Shared",
    root: repo(),
    expectedRevision: 0,
  });
  assert.equal(project.status, 200);
  assert.equal((await call("list_projects")).body[0].id, project.body.id);
  const c = await call("create_card", {
    projectId: project.body.id,
    title: "Shared work",
    expectedRevision: 0,
  });
  assert.equal(c.status, 200);
  assert.equal(
    (await call("list_cards", { projectId: project.body.id })).body.length,
    1,
  );
  assert.equal((await call("get_card", { id: c.body.id })).body.revision, 1);
  const changed = await call(
    "update_card",
    {
      id: c.body.id,
      expectedRevision: 1,
      patch: {
        owner: "Claude",
        phase: "Implementation",
        artifacts: [{ path: "tasks/plan.md", label: "Plan" }],
      },
    },
    "claude",
  );
  assert.equal(changed.status, 200);
  const stale = await call("update_card", {
    id: c.body.id,
    expectedRevision: 1,
    patch: { title: "Lost" },
  });
  assert.equal(stale.status, 409);
  assert.equal(stale.body.current.owner, "Claude");
  assert.equal(
    (
      await call("move_card", {
        id: c.body.id,
        expectedRevision: changed.body.revision,
        column: "Done",
      })
    ).status,
    422,
  );
  assert.equal(
    (
      await call("move_card", {
        id: c.body.id,
        expectedRevision: changed.body.revision,
        column: "Done",
        overrideReason: "Human says yes",
      })
    ).status,
    400,
  );
  const evidence = await call("record_evidence", {
    id: c.body.id,
    expectedRevision: changed.body.revision,
    name: "Tests",
    outcome: "passed",
    summary: "Verified fixtures",
    sourceRevision: "abc",
  });
  assert.equal(evidence.status, 200);
  const done = await call("move_card", {
    id: c.body.id,
    expectedRevision: evidence.body.revision,
    column: "Done",
  });
  assert.equal(done.status, 200);
  assert.equal(done.body.card.column, "Done");
  const events = await call("list_events", { id: c.body.id });
  assert.equal(events.body[0].actor.client, "codex");
  const edit = events.body.find(
    (e: { action: string }) => e.action === "card.updated",
  );
  assert.equal(edit.actor.client, "claude");
  assert.equal(edit.actor.humanSession, false);
  const updated = await call("update_project", {
    id: project.body.id,
    expectedRevision: 1,
    patch: { wipLimit: 1 },
  });
  assert.equal(updated.body.wipLimit, 1);
  const material = await call("update_card", {
    id: c.body.id,
    expectedRevision: done.body.card.revision,
    patch: { title: "Changed scope" },
  });
  assert.equal(material.body.column, "Review");
  assert.equal(
    (
      await call("move_card", {
        id: c.body.id,
        expectedRevision: material.body.revision,
        column: "Done",
      })
    ).status,
    422,
  );
});
