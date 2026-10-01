import { ConflictError,ValidationError,NotFoundError,PolicyError } from '../domain/types.js';
import { HttpError } from '../security/session.js';
export function errorResponse(error:unknown):{status:number;body:unknown} {
 if(error instanceof ConflictError) return {status:409,body:{error:error.message,current:error.current}};
 if(error instanceof HttpError) return {status:error.status,body:{error:error.message}};
 if(error instanceof ValidationError) return {status:400,body:{error:error.message}};
 if(error instanceof NotFoundError) return {status:404,body:{error:error.message}};
 if(error instanceof PolicyError) return {status:422,body:{error:error.message}};
 if(error instanceof Error&&'code' in error&&['ENOENT','ENOTDIR'].includes(String(error.code))) return {status:400,body:{error:'Repository path does not exist.'}};
 return {status:500,body:{error:'Operation failed. No changes were saved.'}};
}
