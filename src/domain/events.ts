import type { Store } from '../storage/database.js';
import type { Actor } from './types.js';
export interface Event {id:number;entityId:string;action:string;actor:Actor;beforeRevision:number;afterRevision:number;at:string;reason?:string;}
export function appendEvent(store:Store,entityId:string,action:string,actor:Actor,beforeRevision:number,afterRevision:number,reason?:string):void {
 const data={entityId,action,actor,beforeRevision,afterRevision,at:new Date().toISOString(),...(reason?{reason}:{})};
 store.db.prepare('INSERT INTO events(entity_id,data) VALUES(?,?)').run(entityId,JSON.stringify(data));
}
export function listEvents(store:Store,entityId:string):Event[] {
 return store.db.prepare('SELECT id,data FROM events WHERE entity_id=? ORDER BY id DESC').all(entityId).map(row=>({...JSON.parse(String(row.data)),id:Number(row.id)}) as Event);
}
