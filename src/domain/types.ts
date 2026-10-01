export interface Actor {client:'browser'|'claude'|'codex';humanSession:boolean;}
export interface Project {id:string;name:string;root:string;revision:number;createdAt:string;wipLimit:number|null;}
export class ValidationError extends Error {}
export class NotFoundError extends Error {}
export class PolicyError extends Error {}
export class ConflictError extends Error {constructor(public current:unknown){super('This item changed. Reload it before saving.');}}
