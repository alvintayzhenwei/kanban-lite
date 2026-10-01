import { readFileSync, readdirSync, lstatSync, existsSync } from "node:fs";
import { join, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { pluginFiles } from "./plugin-files.mjs";
import assert from "node:assert/strict";
const repo = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(join(repo, "adapters/mcp/package.json"));
const Ajv = require("ajv/dist/2020.js").default;
const addFormats = require("ajv-formats");
const ajv = new Ajv({ strict: false, allErrors: true });
addFormats(ajv);
const json = (p) => JSON.parse(readFileSync(p, "utf8"));
const validators = {
  plugin: ajv.compile(json(join(repo, "scripts/schemas/plugin-1.0.0.json"))),
  mcp: ajv.compile(json(join(repo, "scripts/schemas/mcp-1.0.0.json"))),
};
function schema(kind, data) {
  if (!validators[kind](data))
    throw new Error(
      `${kind} schema validation failed: ${ajv.errorsText(validators[kind].errors)}`,
    );
}
export function validatePlugin(root) {
  root = resolve(root);
  const manifest = json(join(root, "plugin.json"));
  schema("plugin", manifest);
  const host =
    manifest.name === "kanban-lite-codex"
      ? "codex"
      : manifest.name === "kanban-lite-claude"
        ? "claude"
        : null;
  assert.ok(host, "Unknown host package identity");
  assert.equal(basename(root), manifest.name);
  const portable = json(join(root, "mcp.json"));
  schema("mcp", portable);
  const server = portable.mcpServers.kanban;
  assert.deepEqual(Object.keys(portable.mcpServers), ["kanban"]);
  assert.equal(server.type, "stdio");
  assert.equal(server.command, "node");
  assert.deepEqual(server.args, [
    "${PLUGIN_ROOT}/adapter/dist/stdio.js",
    "--client",
    host,
  ]);
  const hostConfig = json(join(root, ".mcp.json"));
  const actual = hostConfig.mcpServers.kanban;
  assert.equal(actual.command, "node");
  assert.deepEqual(actual.args, [
    `${host === "claude" ? "${CLAUDE_PLUGIN_ROOT}" : "${PLUGIN_ROOT}"}/adapter/dist/stdio.js`,
    "--client",
    host,
  ]);
  const overlay = json(
    join(root, `.${host === "claude" ? "claude" : "codex"}-plugin/plugin.json`),
  );
  for (const key of ["name", "version", "description"])
    assert.equal(overlay[key], manifest[key], `Mismatched ${key}`);
  assert.ok(
    existsSync(join(root, "adapter/dist/stdio.js")),
    "Missing built entrypoint",
  );
  const pkg = json(join(root, "adapter/package.json"));
  const lock = json(join(root, "adapter/package-lock.json"));
  assert.equal(pkg.version, manifest.version);
  assert.deepEqual(pkg.dependencies, lock.packages[""].dependencies);
  assert.ok(pkg.dependencies["@modelcontextprotocol/sdk"]);
  const skill = readFileSync(
    join(root, "skills/kanban-workflow/SKILL.md"),
    "utf8",
  );
  assert.match(skill, /^---\nname: kanban-workflow\ndescription: .+\n---/);
  const expected = new Set(pluginFiles(host));
  const found = new Set();
  function walk(dir, prefix = "") {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      const st = lstatSync(path);
      assert.equal(st.isSymbolicLink(), false, "Package contains a symlink");
      assert.equal(
        /^(credential|service\.lock|service\.acquire|node_modules|\.env(?:\..*)?)$|\.(sqlite|db)(?:-|$)/.test(
          entry,
        ),
        false,
        "Package contains state or dependencies",
      );
      const relative = prefix + entry;
      if (st.isDirectory()) {
        assert.ok(
          [...expected].some((file) => file.startsWith(relative + "/")),
          "Unexpected package directory",
        );
        walk(path, relative + "/");
      } else {
        assert.ok(
          st.isFile() && expected.has(relative),
          `Unexpected package file: ${relative}`,
        );
        found.add(relative);
      }
    }
  }
  walk(root);
  assert.deepEqual(
    [...found].sort(),
    [...expected].sort(),
    "Incomplete package inventory",
  );
  return { name: manifest.name, version: manifest.version, host };
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    console.log(JSON.stringify(validatePlugin(process.argv[2] ?? "")));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
