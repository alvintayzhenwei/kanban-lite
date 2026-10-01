import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { startApplication } from "../../../dist/src/cli.js";
const repo = fileURLToPath(new URL("../../../", import.meta.url));
test("extracted host packages install and share a card through their declared entrypoints", async (t) => {
  const temp = realpathSync(
    mkdtempSync(join(tmpdir(), "kanban extracted spaces ")),
  );
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  const output = join(temp, "packages");
  execFileSync(process.execPath, [
    join(repo, "scripts/package-plugins.mjs"),
    "--output",
    output,
  ]);
  const dataDir = join(temp, "data");
  const board = await startApplication({ dataDir, port: 0 });
  t.after(() => board.close());
  const root = join(temp, "repository");
  execFileSync("git", ["init", "--quiet", root]);
  const clients = [];
  for (const host of ["codex", "claude"]) {
    const name = `kanban-lite-${host}`;
    execFileSync("tar", ["-xzf", join(output, `${name}.tar.gz`), "-C", temp]);
    const plugin = join(temp, name);
    try {
      execFileSync(
        "npm",
        ["ci", "--offline", "--omit=dev", "--ignore-scripts"],
        {
          stdio: "pipe",
          cwd: join(plugin, "adapter"),
          env: Object.fromEntries(
            Object.entries(process.env).filter(
              ([key]) => !/^npm_/i.test(key) && key !== "INIT_CWD",
            ),
          ),
        },
      );
    } catch (e) {
      throw new Error(String(e.stderr));
    }
    const config = JSON.parse(readFileSync(join(plugin, ".mcp.json"), "utf8"))
      .mcpServers.kanban;
    const args = config.args.map((x) =>
      x
        .replace("${PLUGIN_ROOT}", plugin)
        .replace("${CLAUDE_PLUGIN_ROOT}", plugin),
    );
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [...args, "--data-dir", dataDir],
      stderr: "pipe",
    });
    const client = new Client({ name: `${host}-package`, version: "1.0.0" });
    t.after(() => client.close());
    await client.connect(transport);
    clients.push(client);
    assert.equal((await client.listTools()).tools.length, 10);
  }
  const call = async (c, name, args) => {
    const r = await c.callTool({ name: `kanban_${name}`, arguments: args });
    return { ...r, data: r.structuredContent };
  };
  const project = await call(clients[0], "register_project", {
    name: "Package test",
    root,
    expectedRevision: 0,
  });
  const create = await call(clients[0], "create_card", {
    projectId: project.data.result.id,
    title: "Cross package",
    expectedRevision: 0,
  });
  const id = create.data.result.id;
  const read = await call(clients[1], "get_card", { id });
  assert.equal(read.data.result.title, "Cross package");
  const update = await call(clients[1], "update_card", {
    id,
    expectedRevision: 1,
    patch: { owner: "Claude package" },
  });
  assert.equal(update.data.result.revision, 2);
  const stale = await call(clients[0], "update_card", {
    id,
    expectedRevision: 1,
    patch: { owner: "Lost" },
  });
  assert.equal(stale.isError, true);
  assert.equal(stale.data.current.owner, "Claude package");
});
