#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { resolve,join } from 'node:path';
import { readFileSync,existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { loadConfig,type Config } from './config.js';
import { openStore } from './storage/database.js';
import { startServer,type RunningServer } from './http/server.js';
import { acquireLock,readLock,isAlive } from './storage/lock.js';
import { backupStore,restoreStore } from './storage/backup.js';
export async function startApplication(config:Config):Promise<RunningServer> {
 const lock=acquireLock(config.dataDir);let store:ReturnType<typeof openStore>|undefined;
 try{
   store=openStore(join(config.dataDir,'board.sqlite'));const server=await startServer(store,config);lock.setUrl(server.url);let closed=false;
   return {...server,async close(){if(closed)return;closed=true;try{await server.close();}finally{store!.close();lock.release();}}};
 }catch(error){store?.close();lock.release();throw error;}
}
export function openBrowser(url:string):void {
 const command=process.platform==='darwin'?'open':process.platform==='win32'?'rundll32':'xdg-open';
 const args=process.platform==='win32'?['url.dll,FileProtocolHandler',url]:[url];
 const child=spawn(command,args,{stdio:'ignore',detached:true});child.on('error',()=>console.error('Browser could not open. Restart with --open after checking your default browser.'));child.unref();
}
export async function run(args=process.argv.slice(2)):Promise<void> {
 const {values,positionals}=parseArgs({args,allowPositionals:true,options:{port:{type:'string'},'data-dir':{type:'string'},open:{type:'boolean'},output:{type:'string'},input:{type:'string'},help:{type:'boolean'}}});
 if(values.help||!positionals.length){console.log('kanban-lite start [--open] [--port N] [--data-dir PATH]\nkanban-lite backup --output PATH [--data-dir PATH]\nkanban-lite restore --input PATH [--data-dir PATH]');return;}
 if(positionals.length!==1)throw new Error('Choose one command.');
 const config=loadConfig({...process.env,...(values['data-dir']?{KANBAN_DATA_DIR:values['data-dir']} :{}),...(values.port?{KANBAN_PORT:values.port}:{})});
 const command=positionals[0];
 if(command==='start'){
   const app=await startApplication(config);console.log(`Kanban Lite is running at ${app.url}\nData: ${config.dataDir}\n${values.open?'Opening an authenticated browser session.':'Use --open to launch an authenticated browser session.'}`);
   if(values.open)openBrowser(app.bootstrapUrl);
   const shutdown=()=>{void app.close().then(()=>process.exit(0),()=>process.exit(1));};process.once('SIGINT',shutdown);process.once('SIGTERM',shutdown);return;
 }
 if(command==='backup'){
   if(!values.output)throw new Error('Backup requires --output PATH.');const owner=readLock(config.dataDir);
   if(owner&&isAlive(owner.pid)){
     if(!owner.url||!/^http:\/\/127\.0\.0\.1:\d+$/.test(owner.url))throw new Error('Service is starting. Retry backup after startup.');
     const response=await fetch(`${owner.url}/ops/backup`,{method:'POST',headers:{Authorization:`Bearer ${readFileSync(join(config.dataDir,'credential'),'utf8')}`,'Content-Type':'application/json'},body:JSON.stringify({output:resolve(values.output)})});
     if(!response.ok)throw new Error((await response.json() as {error:string}).error);
   }else{
     const lock=acquireLock(config.dataDir);try{const path=join(config.dataDir,'board.sqlite');if(!existsSync(path))throw new Error('No board database exists.');const store=openStore(path);try{await backupStore(store,values.output);}finally{store.close();}}finally{lock.release();}
   }
   console.log(`Backup saved to ${resolve(values.output)}`);return;
 }
 if(command==='restore'){
   if(!values.input)throw new Error('Restore requires --input PATH.');await restoreStore(config.dataDir,values.input);console.log('Restore complete. Previous data was preserved in a pre-restore backup when present.');return;
 }
 throw new Error(`Unknown command: ${command}`);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))void run().catch(error=>{console.error(error instanceof Error?error.message:'Operation failed.');process.exitCode=1;});
