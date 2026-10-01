import {
  cpSync,
  mkdirSync,
  existsSync,
  writeFileSync,
  readdirSync,
  lstatSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { parseArgs } from "node:util";
import { validatePlugin } from "./validate-plugins.mjs";
const repo = fileURLToPath(new URL("../", import.meta.url));
function write(path, value) {
  mkdirSync(resolve(path, ".."), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" });
}
function copyTree(source, target) {
  const stat = lstatSync(source);
  if (stat.isSymbolicLink())
    throw new Error("Source symlinks cannot be packaged.");
  if (stat.isDirectory()) {
    mkdirSync(target, { recursive: true });
    for (const entry of readdirSync(source))
      copyTree(join(source, entry), join(target, entry));
  } else cpSync(source, target, { errorOnExist: true, force: false });
}
export function packagePlugins(
  source = repo,
  output = join(repo, "artifacts/plugins"),
) {
  source = resolve(source);
  output = resolve(output);
  if (!existsSync(join(source, "adapters/mcp/dist/stdio.js")))
    throw new Error("Build the adapter before packaging: npm run build:mcp");
  const version = "0.2.0";
  const description =
    "Local Kanban tools and workflow guidance for repository development.";
  for (const host of ["codex", "claude"])
    if (
      existsSync(join(output, `kanban-lite-${host}`)) ||
      existsSync(join(output, `kanban-lite-${host}.tar.gz`))
    )
      throw new Error(
        "Package output already exists. Choose a fresh --output directory.",
      );
  mkdirSync(output, { recursive: true });
  for (const host of ["codex", "claude"]) {
    const name = `kanban-lite-${host}`;
    const root = join(output, name);
    mkdirSync(root);
    const manifest = {
      $schema: "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
      name,
      version,
      description,
      author: { name: "Kanban Lite contributors" },
      repository: "https://github.com/alvintayzhenwei/kanban-lite",
    };
    write(join(root, "plugin.json"), manifest);
    const interfaceInfo = {
      displayName: "Kanban Lite",
      shortDescription: "Local development Kanban",
      longDescription: description,
      developerName: "Kanban Lite contributors",
      category: "Productivity",
      capabilities: ["Read", "Write"],
      defaultPrompt: "Use Kanban Lite to inspect and track repository work.",
    };
    write(
      join(
        root,
        `.${host === "claude" ? "claude" : "codex"}-plugin/plugin.json`,
      ),
      host === "claude"
        ? { name, version, description, author: manifest.author }
        : {
            name,
            version,
            description,
            author: manifest.author,
            skills: "./skills/",
            mcpServers: "./.mcp.json",
            interface: interfaceInfo,
          },
    );
    write(join(root, "mcp.json"), {
      $schema: "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json",
      mcpServers: {
        kanban: {
          type: "stdio",
          command: "node",
          args: ["${PLUGIN_ROOT}/adapter/dist/stdio.js", "--client", host],
        },
      },
    });
    write(join(root, ".mcp.json"), {
      mcpServers: {
        kanban: {
          command: "node",
          args: [
            `${host === "claude" ? "${CLAUDE_PLUGIN_ROOT}" : "${PLUGIN_ROOT}"}/adapter/dist/stdio.js`,
            "--client",
            host,
          ],
        },
      },
    });
    mkdirSync(join(root, "adapter"));
    for (const file of ["package.json", "package-lock.json", "tsconfig.json"])
      copyTree(join(source, "adapters/mcp", file), join(root, "adapter", file));
    for (const dir of ["src", "dist"])
      copyTree(join(source, "adapters/mcp", dir), join(root, "adapter", dir));
    mkdirSync(join(root, "skills/kanban-workflow"), { recursive: true });
    copyTree(
      join(source, "plugins/shared/skills/kanban-workflow/SKILL.md"),
      join(root, "skills/kanban-workflow/SKILL.md"),
    );
    writeFileSync(
      join(root, "SETUP.md"),
      "# Local setup\n\nUse Node 24.21.0 or a newer Node 24 patch. Before loading this plugin, run `npm ci --omit=dev --ignore-scripts --prefix adapter` from this directory. Start the separate Kanban Lite board explicitly. Both use `~/.kanban-lite` by default; set `KANBAN_DATA_DIR` in the adapter environment for a custom directory. No credential is included. Host loading does not install dependencies or start the board.\n\nSee the repository docs/mcp-setup.md for host install/removal and diagnostics.\n",
    );
    validatePlugin(root);
    execFileSync("tar", [
      "-czf",
      join(output, `${name}.tar.gz`),
      "-C",
      output,
      name,
    ]);
  }
  const market = {
    name: "kanban-lite-local",
    plugins: [
      {
        name: "kanban-lite-codex",
        source: { source: "local", path: "./kanban-lite-codex" },
        policy: { installation: "AVAILABLE", authentication: "ON_INSTALL" },
        category: "Productivity",
      },
    ],
  };
  if (!existsSync(join(output, ".agents/plugins/marketplace.json")))
    write(join(output, ".agents/plugins/marketplace.json"), market);
  return output;
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const { values } = parseArgs({
      options: { source: { type: "string" }, output: { type: "string" } },
    });
    console.log(packagePlugins(values.source, values.output));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
