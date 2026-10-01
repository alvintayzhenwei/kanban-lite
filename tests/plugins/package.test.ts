import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
test("plugin packages validate and exclude injected secrets and state", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "kanban package spaces "));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const source = join(dir, "source");
  mkdirSync(join(source, "adapters"), { recursive: true });
  cpSync("adapters/mcp", join(source, "adapters/mcp"), {
    recursive: true,
    filter: (path) => !path.includes("node_modules"),
  });
  cpSync("plugins/shared", join(source, "plugins/shared"), { recursive: true });
  const secret = join(source, "adapters/mcp/credential");
  const database = join(source, "plugins/shared/board.sqlite");
  writeFileSync(secret, "TEST_SECRET_MUST_NOT_SHIP");
  writeFileSync(database, "TEST_STATE_MUST_NOT_SHIP");
  for (const file of [
    "src/private-notes.txt",
    "dist/private-notes.txt",
    "dist/stale.js",
  ])
    writeFileSync(join(source, "adapters/mcp", file), "PRIVATE_CANARY");
  execFileSync(process.execPath, [
    "scripts/package-plugins.mjs",
    "--source",
    source,
    "--output",
    join(dir, "output"),
  ]);
  for (const host of ["codex", "claude"]) {
    const name = `kanban-lite-${host}`;
    execFileSync(process.execPath, [
      "scripts/validate-plugins.mjs",
      join(dir, "output", name),
    ]);
    const listing = execFileSync(
      "tar",
      ["-tzf", join(dir, "output", `${name}.tar.gz`)],
      {
        encoding: "utf8",
      },
    );
    assert.equal(
      /credential|board\.sqlite|node_modules|\.env|private-notes|stale\.js/.test(
        listing,
      ),
      false,
    );
    assert.ok(listing.includes(`${name}/adapter/dist/stdio.js`));
    const manifest = JSON.parse(
      readFileSync(join(dir, "output", name, "plugin.json"), "utf8"),
    );
    assert.equal(manifest.name, name);
    const portable = JSON.parse(
      readFileSync(join(dir, "output", name, "mcp.json"), "utf8"),
    );
    assert.equal(portable.mcpServers.kanban.args.at(-1), host);
    const skill = readFileSync(
      join(dir, "output", name, "skills/kanban-workflow/SKILL.md"),
      "utf8",
    );
    assert.ok(skill.length > 0);
    const extra = join(dir, "output", name, "adapter/dist/unexpected.js");
    writeFileSync(extra, "PRIVATE_CANARY");
    assert.throws(() =>
      execFileSync(
        process.execPath,
        ["scripts/validate-plugins.mjs", join(dir, "output", name)],
        { stdio: "pipe" },
      ),
    );
    rmSync(extra);
    // Invalid schema and identity must fail validation, not silently produce a package.
    writeFileSync(
      join(dir, "output", name, "plugin.json"),
      JSON.stringify({ ...manifest, version: 42 }),
    );
    assert.throws(() =>
      execFileSync(
        process.execPath,
        ["scripts/validate-plugins.mjs", join(dir, "output", name)],
        { stdio: "pipe" },
      ),
    );
  }
  assert.equal(readFileSync(secret, "utf8"), "TEST_SECRET_MUST_NOT_SHIP");
  assert.equal(readFileSync(database, "utf8"), "TEST_STATE_MUST_NOT_SHIP");
});
test("packaging refuses missing builds without deleting existing output", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "kanban missing build "));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, "preserve.txt"), "keep");
  assert.throws(() =>
    execFileSync(
      process.execPath,
      ["scripts/package-plugins.mjs", "--source", dir, "--output", dir],
      { stdio: "pipe" },
    ),
  );
  assert.equal(readFileSync(join(dir, "preserve.txt"), "utf8"), "keep");
});
