import { createServer,type IncomingMessage,type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import type { Store } from '../storage/database.js';
import type { Config } from '../config.js';
import { createSessions,HttpError } from '../security/session.js';
import { object } from '../domain/validation.js';
import { route } from './routes.js';
import { errorResponse } from './errors.js';
export interface RunningServer {url:string;bootstrapUrl:string;close():Promise<void>;}
async function jsonBody(req:IncomingMessage):Promise<unknown> {
 if(!req.headers['content-type']?.startsWith('application/json')) throw new HttpError(400,'Use application/json.');
 const chunks:Buffer[]=[];let size=0;
 for await(const chunk of req) {const b=Buffer.from(chunk);size+=b.length;if(size>65536) throw new HttpError(413,'Request is too large.');chunks.push(b);}
 try {return JSON.parse(Buffer.concat(chunks).toString('utf8'));} catch {throw new HttpError(400,'Invalid JSON.');}
}
function send(res:ServerResponse,status:number,body:unknown):void {res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(body));}
const sourceAssets=new URL('../../public/',import.meta.url);
const assets=existsSync(sourceAssets)?sourceAssets:new URL('../../../public/',import.meta.url);
const files:Record<string,{file:string;type:string}>={
 '/':{file:'index.html',type:'text/html'},'/app.js':{file:'app.js',type:'text/javascript'},'/api.js':{file:'api.js',type:'text/javascript'},'/styles.css':{file:'styles.css',type:'text/css'}
};
export async function startServer(store:Store,config:Config):Promise<RunningServer> {
 const sessions=createSessions(config.dataDir);let origin='';
 const server=createServer((req,res)=>{
   res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
   res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
   void (async()=>{
     if(req.headers.host!==new URL(origin).host) throw new HttpError(403,'Invalid Host.');
     const url=new URL(req.url??'/',origin);const method=req.method??'GET';
     if(method==='GET'&&url.pathname==='/health') return send(res,200,{name:'kanban-lite',version:'0.1.0',protocolVersion:1});
     if(method==='GET'&&files[url.pathname]) {const asset=files[url.pathname]!;const data=await readFile(new URL(asset.file,assets));res.writeHead(200,{'Content-Type':`${asset.type}; charset=utf-8`});res.end(data);return;}
     if(!url.pathname.startsWith('/api/')) throw new HttpError(404,'Not found.');
     const mutation=!['GET','HEAD'].includes(method);
     if((mutation||req.headers.origin)&&req.headers.origin!==origin) throw new HttpError(403,'Invalid Origin.');
     if(url.pathname==='/api/session'&&method==='POST') {
       const b=object(await jsonBody(req),['token']);const result=sessions.login(b.token);res.setHeader('Set-Cookie',result.cookie);return send(res,200,{csrf:result.csrf});
     }
     const session=sessions.session(req);
     if(mutation&&req.headers['x-csrf-token']!==session.csrf) throw new HttpError(403,'Invalid CSRF token.');
     if(url.pathname==='/api/session'&&method==='GET') return send(res,200,{csrf:session.csrf});
     const body=mutation&&method!=='DELETE'?await jsonBody(req):undefined;
     send(res,200,await route(store,method,url,body));
   })().catch(error=>{if(res.headersSent) {res.destroy();return;}const result=errorResponse(error);send(res,result.status,result.body);});
 });
 server.requestTimeout=10000;server.headersTimeout=10000;
 await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(config.port,'127.0.0.1',()=>{server.removeListener('error',reject);resolve();});});
 origin=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
 return {url:origin,bootstrapUrl:`${origin}/#${sessions.token}`,close:()=>new Promise<void>((resolve,reject)=>{server.close(error=>error?reject(error):resolve());server.closeIdleConnections();})};
}
