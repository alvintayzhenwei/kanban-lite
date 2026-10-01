import { backup, DatabaseSync } from "node:sqlite";
import { open, rename, rm, chmod } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { randomUUID } from "node:crypto";
import { openStore, type Store } from "./database.js";
import { acquireLock } from "./lock.js";
export async function backupStore(
  store: Store,
  destination: string,
): Promise<void> {
  const output = resolve(destination);
  const reservation = await open(output, "wx", 0o600);
  await reservation.close();
  const temp = `${output}.${randomUUID()}.partial`;
  try {
    await backup(store.db, temp);
    await chmod(temp, 0o600);
    await rename(temp, output);
  } catch (error) {
    await rm(temp, { force: true });
    await rm(output, { force: true });
    throw error;
  }
}
function validateBackup(path: string): void {
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    if (
      db.prepare("PRAGMA integrity_check").get()?.integrity_check !== "ok" ||
      db.prepare("PRAGMA user_version").get()?.user_version !== 1
    )
      throw new Error("Invalid or unsupported backup.");
    db.prepare(
      "SELECT id,name,root,revision,created_at,wip_limit FROM projects LIMIT 1",
    ).all();
    db.prepare(
      "SELECT id,project_id,data,revision,deleted FROM cards LIMIT 1",
    ).all();
    db.prepare("SELECT id,card_id,data FROM evidence LIMIT 1").all();
    db.prepare("SELECT id,entity_id,data FROM events LIMIT 1").all();
    if (db.prepare("PRAGMA foreign_key_check").all().length)
      throw new Error("Backup has invalid project or card references.");
  } finally {
    db.close();
  }
}
export async function restoreStore(
  dataDir: string,
  input: string,
): Promise<void> {
  const lock = acquireLock(dataDir);
  const temp = join(dataDir, `restore-${randomUUID()}.partial`);
  try {
    const path = resolve(input);
    validateBackup(path);
    const source = new DatabaseSync(path, { readOnly: true });
    try {
      await backup(source, temp);
      await chmod(temp, 0o600);
    } finally {
      source.close();
    }
    validateBackup(temp);
    const target = join(dataDir, "board.sqlite");
    if (existsSync(target)) {
      const current = openStore(target);
      try {
        await backupStore(
          current,
          join(dataDir, `pre-restore-${randomUUID()}.sqlite`),
        );
      } finally {
        current.close();
      }
    }
    await rename(temp, target);
  } finally {
    await rm(temp, { force: true });
    lock.release();
  }
}
