import { randomUUID } from 'node:crypto';
import { transaction,type Store } from '../storage/database.js';
import { ConflictError,NotFoundError,ValidationError,PolicyError,columns,phases,type Actor,type NewCard,type Card,type CardPatch,type Column,type Evidence } from './types.js';
import { getProject } from './projects.js';
import { text,object,revision } from './validation.js';
import { appendEvent } from './events.js';
export function getCard(store:Store,id:string):Card {
 const row=store.db.prepare('SELECT data FROM cards WHERE id=? AND deleted=0').get(id);if(!row) throw new NotFoundError('Card not found.');
 const evidence=store.db.prepare('SELECT id,data FROM evidence WHERE card_id=? ORDER BY id').all(id).map(row=>({...JSON.parse(String(row.data)),id:Number(row.id)}) as Evidence);
 return {...JSON.parse(String(row.data)),evidence} as Card;
}
export function listCards(store:Store,projectId?:string):Card[] {
 const rows=projectId?store.db.prepare('SELECT id FROM cards WHERE deleted=0 AND project_id=? ORDER BY rowid').all(projectId):store.db.prepare('SELECT id FROM cards WHERE deleted=0 ORDER BY rowid').all();
 return rows.map(row=>getCard(store,String(row.id)));
}
export function requireCurrent(store:Store,id:string,expectedRevision:number):Card {
 revision(expectedRevision);const card=getCard(store,id);if(card.revision!==expectedRevision) throw new ConflictError(card);return card;
}
export function saveCard(store:Store,card:Card,actor:Actor,action:string,reason?:string):Card {
 const before=card.revision;const saved={...card,revision:before+1,updatedAt:new Date().toISOString()};
 const {evidence:_evidence,...data}=saved;void _evidence;
 store.db.prepare('UPDATE cards SET data=?,revision=? WHERE id=?').run(JSON.stringify(data),saved.revision,card.id);
 appendEvent(store,card.id,action,actor,before,saved.revision,reason);return getCard(store,card.id);
}
export function createCard(store:Store,input:NewCard,expectedRevision:0,actor:Actor):Card {
 object(input,['projectId','title','description']);revision(expectedRevision,true);if(expectedRevision!==0) throw new ValidationError('Creation requires expectedRevision 0.');
 const title=text(input.title,'Title',200);const description=text(input.description??'','Description',20000,true);
 return transaction(store,()=>{
   getProject(store,input.projectId);const at=new Date().toISOString();
   const card:Card={id:randomUUID(),projectId:input.projectId,title,description,column:'Backlog',priority:'normal',owner:null,blockedReason:null,phase:'Discovery',artifacts:[],revision:1,workRevision:1,createdAt:at,updatedAt:at,evidence:[]};
   store.db.prepare('INSERT INTO cards(id,project_id,data,revision) VALUES(?,?,?,?)').run(card.id,card.projectId,JSON.stringify(card),1);
   appendEvent(store,card.id,'card.created',actor,0,1);return card;
 });
}
export function updateCard(store:Store,id:string,expectedRevision:number,patch:CardPatch,actor:Actor):Card {
 object(patch,['title','description','priority','owner','blockedReason','phase','artifacts']);
 return transaction(store,()=>{
   const c=requireCurrent(store,id,expectedRevision);const next={...c};
   if(patch.title!==undefined) next.title=text(patch.title,'Title',200);
   if(patch.description!==undefined) next.description=text(patch.description,'Description',20000,true);
   if(patch.priority!==undefined) {if(!['low','normal','high','urgent'].includes(patch.priority)) throw new ValidationError('Invalid priority.');next.priority=patch.priority;}
   if(patch.phase!==undefined) {if(!phases.includes(patch.phase)) throw new ValidationError('Invalid phase.');next.phase=patch.phase;}
   if(patch.owner!==undefined) next.owner=patch.owner===null?null:text(patch.owner,'Owner',200);
   if(patch.blockedReason!==undefined) next.blockedReason=patch.blockedReason===null?null:text(patch.blockedReason,'Blocker reason',2000);
   if(patch.artifacts!==undefined) {
     if(!Array.isArray(patch.artifacts)||patch.artifacts.length>100) throw new ValidationError('Use at most 100 artifact links.');
     next.artifacts=patch.artifacts.map(a=>{object(a,['path','label']);const path=text(a.path,'Artifact path',4096);if(path.startsWith('/')||path.includes('\\')||path.split('/').includes('..')) throw new ValidationError('Artifact paths must be relative to the repository.');return {path,label:text(a.label,'Artifact label',200)};});
   }
   const changed=next.title!==c.title||next.description!==c.description||JSON.stringify(next.artifacts)!==JSON.stringify(c.artifacts);
   if(changed) {next.workRevision++;if(next.column==='Done') next.column='Review';}
   return saveCard(store,next,actor,'card.updated');
 });
}
export function hasPassingEvidence(card:Card):boolean {
 return card.evidence.filter(e=>e.workRevision===card.workRevision).at(-1)?.outcome==='passed';
}
export function moveCard(store:Store,id:string,expectedRevision:number,column:Column,actor:Actor,overrideReason?:string):{card:Card;warnings:string[]} {
 if(!columns.includes(column)) throw new ValidationError('Invalid column.');
 if(overrideReason!==undefined) {if(actor.client!=='browser'||!actor.humanSession) throw new PolicyError('Only an interactive browser session can override completion.');overrideReason=text(overrideReason,'Override reason',2000);}
 return transaction(store,()=>{
   const c=requireCurrent(store,id,expectedRevision);
   if(column==='Done'&&!hasPassingEvidence(c)&&!overrideReason) throw new PolicyError('Record passing verification evidence for current work before marking Done.');
   const warnings:string[]=[];const project=getProject(store,c.projectId);
   if(column==='In Progress'&&project.wipLimit!==null&&c.column!=='In Progress'&&listCards(store,c.projectId).filter(x=>x.column==='In Progress').length>=project.wipLimit) warnings.push(`WIP limit ${project.wipLimit} exceeded for ${project.name}.`);
   return {card:saveCard(store,{...c,column},actor,'card.moved',overrideReason),warnings};
 });
}
export function deleteCard(store:Store,id:string,expectedRevision:number,actor:Actor):void {
 transaction(store,()=>{const c=requireCurrent(store,id,expectedRevision);store.db.prepare('UPDATE cards SET deleted=1,revision=revision+1 WHERE id=?').run(id);appendEvent(store,id,'card.deleted',actor,c.revision,c.revision+1);});
}
