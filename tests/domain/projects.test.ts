import { test } from "node:test";
import assert from "node:assert/strict";
import { symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fixture, browser } from "../helpers.js";
import {
  registerProject,
  listProjects,
  updateProject,
} from "../../src/domain/projects.js";
import { resolveProjectFile } from "../../src/security/paths.js";
import { ConflictError } from "../../src/domain/types.js";

test("registersTwoDistinctRepositories", async (t) => {
  const { store, repo } = fixture(t);
  const a = await registerProject(
    store,
    { name: "One", root: repo("one") },
    browser,
  );
  const b = await registerProject(
    store,
    { name: "Two", root: repo("two") },
    browser,
  );
  assert.notEqual(a.id, b.id);
  assert.equal(listProjects(store).length, 2);
});
test("deduplicatesSymlinkAndSpacedPaths", async (t) => {
  const { store, repo, dir } = fixture(t);
  const root = repo("with spaces");
  symlinkSync(root, join(dir, "alias"));
  const a = await registerProject(store, { name: "First", root }, browser);
  const b = await registerProject(
    store,
    { name: "Rename?", root: join(dir, "alias") },
    browser,
  );
  assert.equal(a.id, b.id);
  assert.equal(b.name, "First");
  assert.equal(listProjects(store).length, 1);
});
test("rejectsNonRepository", async (t) => {
  const { store, dir } = fixture(t);
  await assert.rejects(
    registerProject(store, { name: "Invalid", root: dir }, browser),
    /repository/i,
  );
});
test("rejectsTraversalAndSymlinkEscape", async (t) => {
  const { repo, dir } = fixture(t);
  const root = repo();
  writeFileSync(join(dir, "outside.txt"), "outside");
  symlinkSync(join(dir, "outside.txt"), join(root, "escape"));
  await assert.rejects(
    resolveProjectFile(root, "../outside.txt"),
    /outside|relative/i,
  );
  await assert.rejects(resolveProjectFile(root, "escape"), /outside/i);
  writeFileSync(join(root, "safe.txt"), "safe");
  assert.equal(
    await resolveProjectFile(root, "safe.txt"),
    join(root, "safe.txt"),
  );
});
test("rejectsStaleProjectUpdate", async (t) => {
  const { store, repo } = fixture(t);
  const p = await registerProject(
    store,
    { name: "Original", root: repo() },
    browser,
  );
  assert.equal(
    updateProject(store, p.id, 1, { name: "Updated", wipLimit: 2 }, browser)
      .revision,
    2,
  );
  assert.throws(
    () => updateProject(store, p.id, 1, { name: "Lost" }, browser),
    ConflictError,
  );
  assert.equal(listProjects(store)[0]?.name, "Updated");
  assert.throws(() => updateProject(store, p.id, 2, { wipLimit: 0 }, browser));
});
