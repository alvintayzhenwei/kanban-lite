import { mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
export interface LockInfo {
  pid: number;
  url?: string;
  token?: string;
}
export function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== "ESRCH";
  }
}
export function readLock(dataDir: string): LockInfo | null {
  try {
    const value = JSON.parse(
      readFileSync(join(dataDir, "service.lock", "owner.json"), "utf8"),
    ) as LockInfo;
    if (!Number.isSafeInteger(value.pid) || value.pid < 1)
      throw new Error("Invalid lock.");
    return value;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw new Error(
      "Invalid service lock. Inspect the data directory before retrying.",
      { cause: error },
    );
  }
}
export function acquireLock(dataDir: string): {
  release(): void;
  setUrl(url: string): void;
} {
  mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  const path = join(dataDir, "service.lock");
  const guard = join(dataDir, "service.acquire");
  // Serialize both stale-lock reclamation and creation. An interrupted guard is
  // left for explicit inspection rather than reclaimed with another unsafe race.
  try {
    mkdirSync(guard, { mode: 0o700 });
  } catch (error) {
    throw new Error(
      "Another startup or recovery is acquiring the service lock. Retry; inspect service.acquire if an earlier startup was interrupted.",
      { cause: error },
    );
  }
  const token = randomUUID();
  const write = (url?: string) =>
    writeFileSync(
      join(path, "owner.json"),
      JSON.stringify({ pid: process.pid, token, ...(url ? { url } : {}) }),
      { mode: 0o600 },
    );
  try {
    try {
      mkdirSync(path, { mode: 0o700 });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      const owner = readLock(dataDir);
      if (!owner || isAlive(owner.pid))
        throw new Error(
          "Application is already running or the service lock is being initialized.",
          { cause: error },
        );
      rmSync(path, { recursive: true });
      mkdirSync(path, { mode: 0o700 });
    }
    try {
      write();
    } catch (error) {
      rmSync(path, { recursive: true, force: true });
      throw error;
    }
  } finally {
    rmSync(guard, { recursive: true, force: true });
  }
  let released = false;
  const owns = () => readLock(dataDir)?.token === token;
  return {
    release() {
      if (!released) {
        released = true;
        if (owns()) rmSync(path, { recursive: true, force: true });
      }
    },
    setUrl(url) {
      if (!owns()) throw new Error("Service lock ownership changed.");
      write(url);
    },
  };
}
