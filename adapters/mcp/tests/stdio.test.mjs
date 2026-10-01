import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { startApplication } from "../../../dist/src/cli.js";
async function connect(
  t,
  client,
  dataDir,
  entry = fileURLToPath(new URL("../dist/stdio.js", import.meta.url)),
) {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [entry, "--client", client, "--data-dir", dataDir],
    stderr: "pipe",
  });
  let errors = "";
  transport.stderr?.on("data", (b) => {
    errors += String(b);
  });
  const c = new Client({ name: `${client}-acceptance`, version: "1.0.0" });
  t.after(() => c.close());
  await c.connect(transport);
  return { c, transport, errors: () => errors };
}
async function call(c, name, args = {}) {
  const result = await c.callTool({ name: `kanban_${name}`, arguments: args });
  return { ...result, data: result.structuredContent };
}
test("two stdio hosts share cards, preserve revisions and cannot bypass Done", async (t) => {
  const d = mkdtempSync(join(tmpdir(), "kanban shared "));
  t.after(() => rmSync(d, { recursive: true, force: true }));
  const app = await startApplication({ dataDir: d, port: 0 });
  t.after(() => app.close());
  const repo = join(d, "repo spaces");
  execFileSync("git", ["init", "--quiet", repo]);
  const codex = await connect(t, "codex", d);
  const claude = await connect(t, "claude", d);
  const tools = (await codex.c.listTools()).tools;
  assert.equal(tools.length, 10);
  assert.equal((await claude.c.listTools()).tools.length, 10);
  assert.equal(
    tools.find((x) => x.name === "kanban_get_card").annotations.readOnlyHint,
    true,
  );
  const project = await call(codex.c, "register_project", {
    name: "Shared",
    root: repo,
    expectedRevision: 0,
  });
  assert.equal(project.isError, undefined);
  assert.ok(project.data.result.id);
  const created = await call(codex.c, "create_card", {
    projectId: project.data.result.id,
    title: "Real MCP card",
    expectedRevision: 0,
  });
  const card = created.data.result;
  const read = await call(claude.c, "get_card", { id: card.id });
  assert.equal(read.data.result.title, "Real MCP card");
  const update = await call(claude.c, "update_card", {
    id: card.id,
    expectedRevision: 1,
    patch: { owner: "Claude" },
  });
  assert.equal(update.data.result.revision, 2);
  const conflict = await call(codex.c, "update_card", {
    id: card.id,
    expectedRevision: 1,
    patch: { owner: "Codex" },
  });
  assert.equal(conflict.isError, true);
  assert.equal(conflict.data.code, "CONFLICT");
  assert.equal(conflict.data.current.owner, "Claude");
  const blocked = await call(codex.c, "move_card", {
    id: card.id,
    expectedRevision: 2,
    column: "Done",
  });
  assert.equal(blocked.isError, true);
  assert.equal(blocked.data.code, "POLICY");
  const forged = await call(codex.c, "move_card", {
    id: card.id,
    expectedRevision: 2,
    column: "Done",
    overrideReason: "Human",
  });
  assert.equal(forged.isError, true);
  const invalid = await call(codex.c, "create_card", {
    projectId: project.data.result.id,
    title: "x",
    expectedRevision: 0,
    humanSession: true,
  });
  assert.equal(invalid.isError, true);
  const evidence = await call(claude.c, "record_evidence", {
    id: card.id,
    expectedRevision: 2,
    name: "Tests",
    outcome: "passed",
    summary: "Verified by test fixtures",
    sourceRevision: "fixture",
  });
  assert.equal(evidence.data.result.revision, 3);
  const done = await call(codex.c, "move_card", {
    id: card.id,
    expectedRevision: 3,
    column: "Done",
  });
  assert.equal(done.data.result.card.column, "Done");
  const events = await call(codex.c, "list_events", { id: card.id });
  assert.equal(events.data.result.at(-1).actor.client, "codex");
  assert.equal(
    events.data.result.find((e) => e.action === "card.updated").actor.client,
    "claude",
  );
  assert.equal(
    events.data.result.find((e) => e.action === "card.updated").actor
      .humanSession,
    false,
  );
  assert.equal(
    (await call(claude.c, "list_cards", { projectId: project.data.result.id }))
      .data.result.length,
    1,
  );
  assert.equal(
    (
      await call(claude.c, "update_project", {
        id: project.data.result.id,
        expectedRevision: 1,
        patch: { wipLimit: 1 },
      })
    ).data.result.wipLimit,
    1,
  );
  await codex.c.close();
  await claude.c.close();
  assert.equal((await fetch(`${app.url}/health`)).status, 200);
  assert.equal(codex.errors().includes("Bearer"), false);
});
test("missing board remains a structured MCP diagnostic without implicit startup", async (t) => {
  const d = mkdtempSync(join(tmpdir(), "kanban offline "));
  t.after(() => rmSync(d, { recursive: true, force: true }));
  const { c } = await connect(t, "codex", d);
  const result = await call(c, "list_projects");
  assert.equal(result.isError, true);
  assert.equal(result.data.code, "SERVICE_UNAVAILABLE");
  assert.match(result.data.message, /Start Kanban Lite/);
});
