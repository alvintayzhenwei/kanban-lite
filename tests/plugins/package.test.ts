import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
test("plugin packages validate and exclude injected secrets and state", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "kanban package spaces "));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  // Removing containment/exclusion from packaging would leak these controlled files.
  const secret = join("adapters/mcp", "credential");
  const database = join("plugins/shared", "board.sqlite");
  writeFileSync(secret, "TEST_SECRET_MUST_NOT_SHIP");
  writeFileSync(database, "TEST_STATE_MUST_NOT_SHIP");
  t.after(() => {
    rmSync(secret, { force: true });
    rmSync(database, { force: true });
  });
  execFileSync(process.execPath, [
    "scripts/package-plugins.mjs",
    "--output",
    dir,
  ]);
  for (const host of ["codex", "claude"]) {
    const name = `kanban-lite-${host}`;
    execFileSync(process.execPath, [
      "scripts/validate-plugins.mjs",
      join(dir, name),
    ]);
    const listing = execFileSync("tar", ["-tzf", join(dir, `${name}.tar.gz`)], {
      encoding: "utf8",
    });
    assert.equal(
      /credential|board\.sqlite|node_modules|\.env/.test(listing),
      false,
    );
    assert.ok(listing.includes(`${name}/adapter/dist/stdio.js`));
    const manifest = JSON.parse(
      readFileSync(join(dir, name, "plugin.json"), "utf8"),
    );
    assert.equal(manifest.name, name);
    const portable = JSON.parse(
      readFileSync(join(dir, name, "mcp.json"), "utf8"),
    );
    assert.equal(portable.mcpServers.kanban.args.at(-1), host);
    const skill = readFileSync(
      join(dir, name, "skills/kanban-workflow/SKILL.md"),
      "utf8",
    );
    assert.ok(skill.length > 0);
    // Invalid schema and identity must fail validation, not silently produce a package.
    writeFileSync(
      join(dir, name, "plugin.json"),
      JSON.stringify({ ...manifest, version: 42 }),
    );
    assert.throws(() =>
      execFileSync(
        process.execPath,
        ["scripts/validate-plugins.mjs", join(dir, name)],
        { stdio: "pipe" },
      ),
    );
  }
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
