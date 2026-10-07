import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { writeFileSync, readFileSync } from "node:fs";
import { fixture, browser } from "../helpers.js";
import { registerProject } from "../../src/domain/projects.js";
import { createCard, getCard, updateCard } from "../../src/domain/cards.js";
import { recordEvidence } from "../../src/domain/evidence.js";
import { listEvents } from "../../src/domain/events.js";
import { openStore } from "../../src/storage/database.js";
import { backupStore, restoreStore } from "../../src/storage/backup.js";

test("backup recovers cards, history and evidence without overwriting files", async (t) => {
  const { store, dir, repo } = fixture(t);
  const p = await registerProject(
    store,
    { name: "First", root: repo() },
    browser,
  );
  const c = createCard(
    store,
    { title: "Keep me", projectId: p.id },
    0,
    browser,
  );
  recordEvidence(
    store,
    c.id,
    1,
    { name: "Test", summary: "Passed", outcome: "passed" },
    browser,
  );
  const out = join(dir, "backup.sqlite");
  await backupStore(store, out);
  const saved = readFileSync(out);
  await assert.rejects(backupStore(store, out), /exist/i);
  assert.deepEqual(readFileSync(out), saved);
  const restored = openStore(out);
  try {
    assert.equal(getCard(restored, c.id).title, "Keep me");
    assert.equal(getCard(restored, c.id).evidence.length, 1);
    assert.equal(listEvents(restored, c.id).length, 2);
  } finally {
    restored.close();
  }
});
test("invalid restore leaves current database unchanged", async (t) => {
  const { store, dir } = fixture(t);
  const before = readFileSync(join(dir, "board.sqlite"));
  const invalid = join(dir, "invalid.sqlite");
  writeFileSync(invalid, "not sqlite");
  await assert.rejects(restoreStore(dir, invalid));
  assert.deepEqual(readFileSync(join(dir, "board.sqlite")), before);
  assert.equal(store.db.prepare("PRAGMA user_version").get()?.user_version, 2);
});
test("restore replaces stopped store with a verified backup", async (t) => {
  const { store, dir, repo } = fixture(t);
  const p = await registerProject(
    store,
    { name: "Original", root: repo() },
    browser,
  );
  const c = createCard(
    store,
    { title: "Original", projectId: p.id },
    0,
    browser,
  );
  const input = join(dir, "saved.sqlite");
  await backupStore(store, input);
  updateCard(store, c.id, 1, { title: "Changed" }, browser);
  const target = join(dir, "restore-target");
  await restoreStore(target, input);
  const restored = openStore(join(target, "board.sqlite"));
  try {
    assert.equal(getCard(restored, c.id).title, "Original");
  } finally {
    restored.close();
  }
});

test("restore rejects unreadable serialized card and evidence records", async (t) => {
  const { store, dir, repo } = fixture(t);
  const p = await registerProject(
    store,
    { name: "Keep original", root: repo() },
    browser,
  );
  const c = createCard(
    store,
    { title: "Keep original", projectId: p.id },
    0,
    browser,
  );
  for (const [index, value] of [
    "not json",
    "null",
    "{}",
    JSON.stringify({ ...c, column: "Unknown" }),
  ].entries()) {
    const input = join(dir, `invalid-record-${index}.sqlite`);
    await backupStore(store, input);
    const broken = openStore(input);
    broken.db.prepare("UPDATE cards SET data=? WHERE id=?").run(value, c.id);
    broken.close();
    const before = readFileSync(join(dir, "board.sqlite"));
    await assert.rejects(restoreStore(dir, input), /record|backup|JSON/i);
    assert.deepEqual(readFileSync(join(dir, "board.sqlite")), before);
  }
  const input = join(dir, "invalid-evidence.sqlite");
  await backupStore(store, input);
  const broken = openStore(input);
  broken.db
    .prepare("INSERT INTO evidence(card_id,data) VALUES(?,?)")
    .run(c.id, "{}");
  broken.close();
  await assert.rejects(restoreStore(dir, input), /record|backup/i);
  assert.equal(getCard(store, c.id).title, "Keep original");
});
