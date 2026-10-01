import { homedir } from "node:os";
import { resolve } from "node:path";
export interface Config {
  dataDir: string;
  port: number;
}
export function loadConfig(
  env: NodeJS.ProcessEnv,
  version = process.versions.node,
): Config {
  const [major, minor, patch] = version.split(".").map(Number);
  if (
    major !== 24 ||
    minor === undefined ||
    patch === undefined ||
    minor < 21 ||
    (minor === 21 && patch < 0)
  )
    throw new Error("Use Node.js 24.21.0 or a newer Node.js 24 patch.");
  const port = Number(env.KANBAN_PORT ?? 4317);
  if (!Number.isInteger(port) || port < 0 || port > 65535)
    throw new Error("Invalid port; use an integer from 0 to 65535.");
  return {
    dataDir: resolve(env.KANBAN_DATA_DIR ?? resolve(homedir(), ".kanban-lite")),
    port,
  };
}
