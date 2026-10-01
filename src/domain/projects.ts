import { randomUUID } from 'node:crypto';
import { realpath, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { transaction,type Store } from '../storage/database.js';
import { ConflictError,NotFoundError,ValidationError,type Actor,type Project } from './types.js';
import { text,object,revision } from './validation.js';
import { appendEvent } from './events.js';
function project(row:Record<string,unknown>):Project {
 return {id:String(row.id),name:String(row.name),root:String(row.root),revision:Number(row.revision),createdAt:String(row.created_at),wipLimit:row.wip_limit==null?null:Number(row.wip_limit)};
}
export function listProjects(store:Store):Project[] {return store.db.prepare('SELECT * FROM projects ORDER BY created_at,id').all().map(project);}
export function getProject(store:Store,id:string):Project {
 const row=store.db.prepare('SELECT * FROM projects WHERE id=?').get(id);
 if(!row) throw new NotFoundError('Project not found.');return project(row);
}
export async function registerProject(store:Store,input:{name:string;root:string},actor:Actor):Promise<Project> {
 object(input,['name','root']);const name=text(input.name,'Project name',200);const root=await realpath(text(input.root,'Repository root',4096));
 try {const marker=await stat(join(root,'.git'));if(!marker.isDirectory()&&!marker.isFile()) throw new Error();}
 catch {throw new ValidationError('Choose a Git repository root.');}
 return transaction(store,()=>{
   const existing=store.db.prepare('SELECT * FROM projects WHERE root=?').get(root);if(existing) return project(existing);
   const id=randomUUID();store.db.prepare('INSERT INTO projects(id,name,root,revision,created_at) VALUES(?,?,?,?,?)').run(id,name,root,1,new Date().toISOString());
   appendEvent(store,id,'project.created',actor,0,1);return getProject(store,id);
 });
}
export function updateProject(store:Store,id:string,expectedRevision:number,patch:{name?:string;wipLimit?:number|null},actor:Actor):Project {
 object(patch,['name','wipLimit']);revision(expectedRevision);
 return transaction(store,()=>{
   const current=getProject(store,id);if(current.revision!==expectedRevision) throw new ConflictError(current);
   const name=patch.name===undefined?current.name:text(patch.name,'Project name',200);
   const wip=patch.wipLimit===undefined?current.wipLimit:patch.wipLimit;
   if(wip!==null&&(!Number.isSafeInteger(wip)||wip<1)) throw new ValidationError('WIP limit must be a positive integer or null.');
   store.db.prepare('UPDATE projects SET name=?,wip_limit=?,revision=revision+1 WHERE id=?').run(name,wip,id);
   appendEvent(store,id,'project.updated',actor,expectedRevision,expectedRevision+1);return getProject(store,id);
 });
}
