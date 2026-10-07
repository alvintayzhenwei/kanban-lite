import type { DatabaseSync } from "node:sqlite";
export const migrations = [
  {
    version: 1,
    sql: `
CREATE TABLE projects(id TEXT PRIMARY KEY,name TEXT NOT NULL,root TEXT UNIQUE NOT NULL,revision INTEGER NOT NULL,created_at TEXT NOT NULL,wip_limit INTEGER);
CREATE TABLE cards(id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id),data TEXT NOT NULL,revision INTEGER NOT NULL,deleted INTEGER NOT NULL DEFAULT 0);
CREATE TABLE evidence(id INTEGER PRIMARY KEY AUTOINCREMENT,card_id TEXT NOT NULL REFERENCES cards(id),data TEXT NOT NULL);
CREATE TABLE events(id INTEGER PRIMARY KEY AUTOINCREMENT,entity_id TEXT NOT NULL,data TEXT NOT NULL);
`,
  },
  {
    version: 2,
    sql: `
CREATE TABLE passkey_owner(singleton INTEGER PRIMARY KEY CHECK(singleton=1),user_id TEXT NOT NULL);
CREATE TABLE passkeys(id TEXT PRIMARY KEY,public_key BLOB NOT NULL,counter INTEGER NOT NULL,transports TEXT NOT NULL,created_at TEXT NOT NULL,device_type TEXT NOT NULL,backed_up INTEGER NOT NULL,registration_id TEXT NOT NULL);
`,
  },
];
export function migrate(db: DatabaseSync, steps = migrations): void {
  for (const step of steps) {
    const version = Number(
      db.prepare("PRAGMA user_version").get()?.user_version ?? 0,
    );
    if (version >= step.version) continue;
    db.exec("BEGIN IMMEDIATE");
    try {
      db.exec(step.sql);
      db.exec(`PRAGMA user_version=${step.version}`);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }
}
