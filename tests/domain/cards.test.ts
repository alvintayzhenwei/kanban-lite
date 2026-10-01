import { test,type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { fixture,browser } from '../helpers.js';
import { registerProject,updateProject } from '../../src/domain/projects.js';
import { createCard,getCard,listCards,updateCard,moveCard,deleteCard } from '../../src/domain/cards.js';
import { recordEvidence } from '../../src/domain/evidence.js';
import { listEvents } from '../../src/domain/events.js';
import { ConflictError,NotFoundError,type Column } from '../../src/domain/types.js';
async function setup(t:TestContext) {const f=fixture(t);const project=await registerProject(f.store,{name:'One',root:f.repo()},browser);const card=createCard(f.store,{projectId:project.id,title:'Build board'},0,browser);return {...f,project,card};}
const pass={name:'Tests',outcome:'passed' as const,summary:'All checks passed'};
test('card CRUD isolates projects and soft deletion',async t=>{
 const {store,card,project,repo}=await setup(t);const second=await registerProject(store,{name:'Two',root:repo('two')},browser);
 assert.equal(listCards(store,second.id).length,0);assert.equal(listCards(store,project.id).length,1);
 const changed=updateCard(store,card.id,1,{priority:'high',owner:'Claude',blockedReason:'Needs input',phase:'Design'},browser);
 assert.equal(changed.revision,2);assert.equal(changed.column,'Backlog');assert.equal(changed.owner,'Claude');
 deleteCard(store,card.id,2,browser);assert.throws(()=>getCard(store,card.id),NotFoundError);assert.equal(listCards(store).length,0);assert.equal(listEvents(store,card.id)[0]?.action,'card.deleted');
});
test('card rejects invalid input and stale revision without history changes',async t=>{
 const {store,card}=await setup(t);assert.throws(()=>updateCard(store,card.id,1,{title:' '},browser));assert.throws(()=>updateCard(store,card.id,1,{title:'x'.repeat(201)},browser));
 const c=updateCard(store,card.id,1,{title:'Updated'},browser);const count=listEvents(store,card.id).length;
 assert.throws(()=>updateCard(store,card.id,1,{title:'Lost'},browser),ConflictError);assert.equal(listEvents(store,card.id).length,count);assert.equal(getCard(store,card.id).title,'Updated');
 assert.throws(()=>moveCard(store,card.id,c.revision,'Blocked' as Column,browser));
});
test('card events and data roll back together',async t=>{
 const {store,card}=await setup(t);store.db.exec("CREATE TRIGGER deny_events BEFORE INSERT ON events BEGIN SELECT RAISE(ABORT,'history unavailable'); END;");
 assert.throws(()=>updateCard(store,card.id,1,{title:'Lost'},browser),/history unavailable/);assert.equal(getCard(store,card.id).title,'Build board');assert.equal(getCard(store,card.id).revision,1);
});
test('WIP warning does not discard card move',async t=>{
 const {store,card,project}=await setup(t);updateProject(store,project.id,1,{wipLimit:1},browser);
 moveCard(store,card.id,1,'In Progress',browser);const second=createCard(store,{projectId:project.id,title:'Second'},0,browser);
 const moved=moveCard(store,second.id,1,'In Progress',browser);assert.equal(moved.card.column,'In Progress');assert.equal(moved.warnings.length,1);
});
test('evidence required for Done and material edits invalidate it',async t=>{
 const {store,card}=await setup(t);assert.throws(()=>moveCard(store,card.id,1,'Done',browser),/verification/i);
 let c=recordEvidence(store,card.id,1,pass,browser);assert.equal(c.evidence.length,1);
 c=updateCard(store,card.id,c.revision,{priority:'urgent'},browser);c=moveCard(store,c.id,c.revision,'Done',browser).card;
 c=updateCard(store,c.id,c.revision,{description:'New work'},browser);assert.notEqual(c.column,'Done');assert.throws(()=>moveCard(store,c.id,c.revision,'Done',browser),/verification/i);
});
test('evidence later failure supersedes previous success',async t=>{
 const {store,card}=await setup(t);let c=recordEvidence(store,card.id,1,pass,browser);c=recordEvidence(store,card.id,c.revision,{...pass,outcome:'failed'},browser);
 assert.throws(()=>moveCard(store,c.id,c.revision,'Done',browser),/verification/i);
});
test('override requires interactive browser session and reason',async t=>{
 const {store,card}=await setup(t);
 assert.throws(()=>moveCard(store,card.id,1,'Done',{client:'codex',humanSession:false},'Accepted'),/override/i);
 assert.throws(()=>moveCard(store,card.id,1,'Done',browser,' '));
 const result=moveCard(store,card.id,1,'Done',browser,'Documentation reviewed manually');assert.equal(result.card.column,'Done');assert.equal(listEvents(store,card.id)[0]?.reason,'Documentation reviewed manually');
});
