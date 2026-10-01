import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openStore } from '../../src/storage/database.js';
import { migrate } from '../../src/storage/migrations.js';
import { loadConfig } from '../../src/config.js';

test('persistsAfterReopen', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kanban-db-'));
  try {
    let store = openStore(join(dir, 'board.sqlite'));
    store.db.prepare("INSERT INTO projects(id,name,root,revision,created_at) VALUES(?,?,?,?,?)").run('p1','First','/tmp/first',1,'2026-10-01');
    store.close();
    store = openStore(join(dir, 'board.sqlite'));
    assert.equal((store.db.prepare('SELECT name FROM projects WHERE id=?').get('p1') as {name:string}).name, 'First');
    store.close();
  } finally { rmSync(dir, {recursive:true,force:true}); }
});

test('rollsBackFailedMigration', () => {
  const store = openStore(':memory:');
  try {
    assert.throws(() => migrate(store.db, [{version:2, sql:"CREATE TABLE doomed(id TEXT); INSERT INTO absent VALUES(1);"}]));
    assert.equal(store.db.prepare("SELECT name FROM sqlite_master WHERE name='doomed'").get(), undefined);
    assert.equal(store.db.prepare('PRAGMA user_version').get()?.user_version, 1);
  } finally { store.close(); }
});

test('rejectsUnsupportedRuntime', () => {
  assert.throws(() => loadConfig({}, '22.17.0'), /Node.js 24/);
  assert.throws(() => loadConfig({KANBAN_PORT:'no'}, '24.21.0'), /port/i);
  assert.equal(loadConfig({KANBAN_PORT:'4317'}, '24.21.0').port, 4317);
});
