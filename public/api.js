let csrf='';
export class ApiError extends Error {constructor(message,status,current){super(message);this.status=status;this.current=current;}}
export async function request(path,{method='GET',body}={}) {
 const headers={};if(body!==undefined) headers['Content-Type']='application/json';if(method!=='GET') headers['X-CSRF-Token']=csrf;
 const response=await fetch(path,{method,headers,credentials:'same-origin',...(body!==undefined?{body:JSON.stringify(body)}:{})});
 const result=await response.json();if(!response.ok) throw new ApiError(result.error??'Request failed.',response.status,result.current);return result;
}
export async function authenticate() {
 const token=location.hash.slice(1);history.replaceState(null,'',location.pathname);
 const session=token?await request('/api/session',{method:'POST',body:{token}}):await request('/api/session');csrf=session.csrf;
}
