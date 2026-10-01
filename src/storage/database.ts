import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, chmodSync } from 'node:fs';
import { dirname } from 'node:path';
import { migrate } from './migrations.js';
export interface Store { db: DatabaseSync; close(): void; }
export function openStore(path: string): Store {
  if (path !== ':memory:') mkdirSync(dirname(path), {recursive:true,mode:0o700});
  const db = new DatabaseSync(path);
  try {
    db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
    const version = Number(db.prepare('PRAGMA user_version').get()?.user_version ?? 0);
    if (version > 1) throw new Error('Database schema is newer than this application.');
    migrate(db);
    if (path !== ':memory:') chmodSync(path, 0o600);
    return {db,close:()=>db.close()};
  } catch (error) { db.close(); throw error; }
}
export function transaction<T>(store: Store, operation:()=>T):T {
  store.db.exec('BEGIN IMMEDIATE');
  try { const result=operation(); store.db.exec('COMMIT'); return result; }
  catch(error) { store.db.exec('ROLLBACK'); throw error; }
}
