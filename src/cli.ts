#!/usr/bin/env node
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import { resolve, join } from "node:path";
import { readFileSync, existsSync, realpathSync } from "node:fs";
import { spawn } from "node:child_process";
import { loadConfig, type Config } from "./config.js";
import { openStore } from "./storage/database.js";
import { startServer, type RunningServer } from "./http/server.js";
import { acquireLock, readLock, isAlive } from "./storage/lock.js";
import { backupStore, restoreStore } from "./storage/backup.js";
export async function startApplication(config: Config): Promise<RunningServer> {
  const lock = acquireLock(config.dataDir);
  let store: ReturnType<typeof openStore> | undefined;
  try {
    store = openStore(join(config.dataDir, "board.sqlite"));
    const server = await startServer(store, config);
    lock.setUrl(server.url);
    let closed = false;
    return {
      ...server,
      async close() {
        if (closed) return;
        closed = true;
        try {
          await server.close();
        } finally {
          store!.close();
          lock.release();
        }
      },
    };
  } catch (error) {
    store?.close();
    lock.release();
    throw error;
  }
}
export async function openBrowser(
  url: string,
  browser?: string,
): Promise<void> {
  if (browser && process.platform !== "darwin")
    throw new Error(
      "--browser is supported on macOS. Otherwise use your default browser.",
    );
  const command =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "rundll32"
        : "xdg-open";
  const args =
    process.platform === "win32"
      ? ["url.dll,FileProtocolHandler", url]
      : browser
        ? ["-a", browser, url]
        : [url];
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { stdio: "ignore" });
    const failed = () =>
      reject(
        new Error(
          "Browser could not open. Check your browser, then retry the open command.",
        ),
      );
    child.once("error", failed);
    child.once("exit", (code) => (code === 0 ? resolve() : failed()));
  });
}
export async function requestBrowserLogin(dataDir: string): Promise<string> {
  const owner = readLock(dataDir);
  if (!owner || !isAlive(owner.pid) || !owner.url)
    throw new Error(
      "Start Kanban Lite with --open and the same --data-dir first.",
    );
  const origin = new URL(owner.url);
  if (
    !/^http:\/\/127\.0\.0\.1:\d+$/.test(owner.url) ||
    origin.origin !== owner.url
  )
    throw new Error("Invalid service URL. Check the service lock.");
  let response: Response;
  try {
    response = await fetch(`${owner.url}/ops/session`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${readFileSync(join(dataDir, "credential"), "utf8")}`,
        "Content-Type": "application/json",
      },
      body: "{}",
      redirect: "error",
      signal: AbortSignal.timeout(5000),
    });
    const result = (await response.json()) as { url?: unknown };
    if (
      response.ok &&
      typeof result.url === "string" &&
      result.url.startsWith(`${owner.url}/?login#`) &&
      /^[a-f0-9]{64}$/.test(result.url.slice(`${owner.url}/?login#`.length))
    )
      return result.url;
  } catch {
    throw new Error(
      "Browser login request failed. Check the running service and --data-dir.",
    );
  }
  throw new Error(
    `Browser login request failed (HTTP ${response.status}). Check --data-dir; older services need one restart after rebuilding.`,
  );
}
export async function run(args = process.argv.slice(2)): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      port: { type: "string" },
      "data-dir": { type: "string" },
      open: { type: "boolean" },
      browser: { type: "string" },
      output: { type: "string" },
      input: { type: "string" },
      help: { type: "boolean" },
    },
  });
  if (values.help || !positionals.length) {
    console.log(
      "kanban-lite start [--open] [--browser APP] [--port N] [--data-dir PATH]\nkanban-lite open [--browser APP] [--data-dir PATH]\nkanban-lite backup --output PATH [--data-dir PATH]\nkanban-lite restore --input PATH [--data-dir PATH]",
    );
    return;
  }
  if (positionals.length !== 1) throw new Error("Choose one command.");
  const config = loadConfig({
    ...process.env,
    ...(values["data-dir"] ? { KANBAN_DATA_DIR: values["data-dir"] } : {}),
    ...(values.port ? { KANBAN_PORT: values.port } : {}),
  });
  const command = positionals[0];
  if (values.browser && process.platform !== "darwin")
    throw new Error(
      "--browser is supported on macOS. Otherwise use your default browser.",
    );
  if (command === "open") {
    await openBrowser(
      await requestBrowserLogin(config.dataDir),
      values.browser,
    );
    console.log(
      "Opened an authenticated browser session. Existing sessions remain active.",
    );
    return;
  }
  if (command === "start") {
    const app = await startApplication(config);
    console.log(
      `Kanban Lite is running at ${app.url}\nData: ${config.dataDir}\n${values.open ? "Opening an authenticated browser session." : "Use --open to launch an authenticated browser session."}`,
    );
    if (values.open) {
      try {
        await openBrowser(app.bootstrapUrl, values.browser);
      } catch (error) {
        console.error(
          error instanceof Error ? error.message : "Browser could not open.",
        );
      }
    }
    const shutdown = () => {
      void app.close().then(
        () => process.exit(0),
        () => process.exit(1),
      );
    };
    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
    return;
  }
  if (command === "backup") {
    if (!values.output) throw new Error("Backup requires --output PATH.");
    const owner = readLock(config.dataDir);
    if (owner && isAlive(owner.pid)) {
      if (!owner.url || !/^http:\/\/127\.0\.0\.1:\d+$/.test(owner.url))
        throw new Error("Service is starting. Retry backup after startup.");
      const response = await fetch(`${owner.url}/ops/backup`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${readFileSync(join(config.dataDir, "credential"), "utf8")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ output: resolve(values.output) }),
      });
      if (!response.ok)
        throw new Error(((await response.json()) as { error: string }).error);
    } else {
      const lock = acquireLock(config.dataDir);
      try {
        const path = join(config.dataDir, "board.sqlite");
        if (!existsSync(path)) throw new Error("No board database exists.");
        const store = openStore(path);
        try {
          await backupStore(store, values.output);
        } finally {
          store.close();
        }
      } finally {
        lock.release();
      }
    }
    console.log(`Backup saved to ${resolve(values.output)}`);
    return;
  }
  if (command === "restore") {
    if (!values.input) throw new Error("Restore requires --input PATH.");
    await restoreStore(config.dataDir, values.input);
    console.log(
      "Restore complete. Previous data was preserved in a pre-restore backup when present.",
    );
    return;
  }
  throw new Error(`Unknown command: ${command}`);
}
if (
  process.argv[1] &&
  realpathSync(resolve(process.argv[1])) ===
    realpathSync(fileURLToPath(import.meta.url))
)
  void run().catch((error) => {
    console.error(error instanceof Error ? error.message : "Operation failed.");
    process.exitCode = 1;
  });
