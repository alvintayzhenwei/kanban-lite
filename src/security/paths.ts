import { realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import { ValidationError } from '../domain/types.js';
export async function resolveProjectFile(root:string,relativePath:string):Promise<string> {
 if(!relativePath||isAbsolute(relativePath)||relativePath.split(/[\\/]/).includes('..')) throw new ValidationError('Use a relative path inside the repository.');
 const canonicalRoot=await realpath(root);const file=await realpath(resolve(canonicalRoot,relativePath));
 const rel=relative(canonicalRoot,file);
 if(rel==='..'||rel.startsWith(`..${process.platform==='win32'?'\\':'/'}`)||isAbsolute(rel)) throw new ValidationError('File is outside the registered repository.');
 return file;
}
