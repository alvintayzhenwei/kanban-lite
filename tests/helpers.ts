import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import type { TestContext } from 'node:test';
import { openStore } from '../src/storage/database.js';
export function fixture(t:TestContext) {
  const dir=mkdtempSync(join(tmpdir(),'kanban-test-'));
  const store=openStore(join(dir,'board.sqlite'));
  t.after(()=>{store.close();rmSync(dir,{recursive:true,force:true});});
  function repo(name='project') {const root=join(dir,name);execFileSync('git',['init','--quiet',root]);return root;}
  return {dir,store,repo};
}
export const browser = {client:'browser' as const,humanSession:true};
