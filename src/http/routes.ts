import type { Store } from '../storage/database.js';
import { registerProject,listProjects,updateProject } from '../domain/projects.js';
import { createCard,listCards,getCard,updateCard,moveCard,deleteCard } from '../domain/cards.js';
import { recordEvidence } from '../domain/evidence.js';
import { listEvents } from '../domain/events.js';
import { object,revision,text } from '../domain/validation.js';
import type { Column,CardPatch,EvidenceInput } from '../domain/types.js';
import { HttpError } from '../security/session.js';
export async function route(store:Store,method:string,url:URL,body:unknown):Promise<unknown> {
 const path=url.pathname,actor={client:'browser' as const,humanSession:true};
 if(method==='GET'&&path==='/api/projects') return listProjects(store);
 if(method==='GET'&&path==='/api/cards') return listCards(store,url.searchParams.get('projectId')??undefined);
 if(method==='POST'&&path==='/api/projects') {
   const b=object(body,['name','root','expectedRevision']);if(revision(b.expectedRevision,true)!==0) throw new HttpError(400,'Creation requires expectedRevision 0.');
   return registerProject(store,{name:text(b.name,'Project name',200),root:text(b.root,'Repository root',4096)},actor);
 }
 if(method==='POST'&&path==='/api/cards') {
   const b=object(body,['title','description','projectId','expectedRevision']);if(revision(b.expectedRevision,true)!==0) throw new HttpError(400,'Creation requires expectedRevision 0.');
   return createCard(store,{title:text(b.title,'Title',200),projectId:text(b.projectId,'Project ID',100),description:text(b.description??'','Description',20000,true)},0,actor);
 }
 const match=path.match(/^\/api\/(cards|projects)\/([^/]+)(?:\/(events|move|evidence))?$/);
 if(match) {
   const [,entity,id,action]=match;if(!id) throw new HttpError(404,'Not found.');
   if(entity==='cards'&&method==='GET'&&!action) return getCard(store,id);
   if(entity==='cards'&&method==='GET'&&action==='events') {getCard(store,id);return listEvents(store,id);}
   if(method==='PATCH'&&!action) {
     const keys=entity==='cards'?['title','description','priority','owner','blockedReason','phase','artifacts','expectedRevision']:['name','wipLimit','expectedRevision'];
     const b=object(body,keys);const {expectedRevision,...patch}=b;
     return entity==='cards'?updateCard(store,id,revision(expectedRevision),patch as CardPatch,actor):updateProject(store,id,revision(expectedRevision),patch as {name?:string;wipLimit?:number|null},actor);
   }
   if(entity==='cards'&&method==='POST'&&action==='move') {
     const b=object(body,['expectedRevision','column','overrideReason']);
     return moveCard(store,id,revision(b.expectedRevision),text(b.column,'Column',30) as Column,actor,b.overrideReason===undefined?undefined:text(b.overrideReason,'Override reason',2000));
   }
   if(entity==='cards'&&method==='POST'&&action==='evidence') {
     const b=object(body,['expectedRevision','name','outcome','summary','sourceRevision']);const {expectedRevision,...input}=b;
     return recordEvidence(store,id,revision(expectedRevision),input as unknown as EvidenceInput,actor);
   }
   if(entity==='cards'&&method==='DELETE'&&!action) {deleteCard(store,id,revision(Number(url.searchParams.get('expectedRevision'))),actor);return {deleted:true};}
 }
 throw new HttpError(404,'Not found.');
}
