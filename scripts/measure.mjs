import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir, cpus, release } from "node:os";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
const samples = [];
for (let i = 0; i < 5; i++) {
  const dir = mkdtempSync(join(tmpdir(), "kanban-measure-"));
  const started = performance.now();
  const child = spawn(
    process.execPath,
    ["dist/src/cli.js", "start", "--port", "0", "--data-dir", dir],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  try {
    const url = await new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("Startup timed out")),
        10000,
      );
      let output = "";
      child.once("error", reject);
      child.stdout.on("data", (data) => {
        output += data;
        const match = output.match(/http:\/\/127\.0\.0\.1:\d+/);
        if (match) {
          clearTimeout(timeout);
          resolve(match[0]);
        }
      });
      child.once("exit", (code) => {
        clearTimeout(timeout);
        reject(new Error(`Service exited ${code}`));
      });
    });
    await fetch(`${url}/health`);
    const startupMs = performance.now() - started;
    await new Promise((r) => setTimeout(r, 500));
    const rssKiB = Number(
      execFileSync("ps", ["-o", "rss=", "-p", String(child.pid)], {
        encoding: "utf8",
      }).trim(),
    );
    samples.push({
      startupMs: Math.round(startupMs * 10) / 10,
      idleRssMiB: Math.round((rssKiB / 1024) * 10) / 10,
    });
  } finally {
    child.kill("SIGTERM");
    await new Promise((r) => child.once("exit", r));
    rmSync(dir, { recursive: true, force: true });
  }
}
const pack = JSON.parse(
  execFileSync("npm", ["pack", "--dry-run", "--json"], { encoding: "utf8" }),
)[0];
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
console.log(
  JSON.stringify(
    {
      context: {
        node: process.versions.node,
        platform: process.platform,
        arch: process.arch,
        osRelease: release(),
        cpu: cpus()[0]?.model,
      },
      samples,
      medianStartupMs: samples.map((s) => s.startupMs).sort((a, b) => a - b)[2],
      medianIdleRssMiB: samples
        .map((s) => s.idleRssMiB)
        .sort((a, b) => a - b)[2],
      packageBytes: pack.size,
      unpackedBytes: pack.unpackedSize,
      runtimeDependencyCount: Object.keys(pkg.dependencies ?? {}).length,
    },
    null,
    2,
  ),
);
