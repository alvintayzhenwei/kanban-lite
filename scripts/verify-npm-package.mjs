import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const temporary = mkdtempSync(join(tmpdir(), "kanban-lite-package-"));
const manifest = JSON.parse(readFileSync("package.json", "utf8"));
try {
  const [packed] = JSON.parse(
    execFileSync("npm", ["pack", "--json", "--pack-destination", temporary], {
      encoding: "utf8",
    }),
  );
  const files = packed.files.map((file) => file.path);
  for (const file of files) {
    assert(
      /^(dist\/src\/.*\.js|public\/[^/]+|package\.json|README\.md|LICENSE|SECURITY\.md)$/.test(
        file,
      ),
      `Unexpected package file: ${file}`,
    );
  }
  for (const required of ["dist/src/cli.js", "public/index.html", "LICENSE"])
    assert(files.includes(required), `Missing package file: ${required}`);
  execFileSync(
    "npm",
    [
      "install",
      "--prefix",
      temporary,
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      join(temporary, packed.filename),
    ],
    { stdio: "pipe" },
  );
  const help = execFileSync(
    join(temporary, "node_modules/.bin/kanban-lite"),
    ["--help"],
    { encoding: "utf8" },
  );
  assert(help.includes("kanban-lite start"));
  const installed = resolve(temporary, "node_modules", manifest.name);
  const { startApplication } = await import(
    pathToFileURL(join(installed, "dist/src/cli.js"))
  );
  const app = await startApplication({
    port: 0,
    dataDir: join(temporary, "data"),
  });
  try {
    for (const path of ["/health", "/", "/app.js", "/styles.css"]) {
      const response = await fetch(`${app.url}${path}`);
      assert.equal(response.status, 200, path);
      assert((await response.text()).length > 0, path);
    }
  } finally {
    await app.close();
  }
  console.log(
    `Verified ${packed.name}@${packed.version}: ${files.length} files, installed CLI and HTTP assets.`,
  );
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
