import {getChatGPTUser} from '../../../../chatgpt-auth';
import {appOrigin,finishGoogle,issueSession} from '../../../../../lib/auth-service';
import {authCookie,OAUTH_COOKIE} from '../../../../../lib/auth-core';
export async function GET(request:Request){const headers=new Headers({'Cache-Control':'no-store','Referrer-Policy':'no-referrer'});headers.append('Set-Cookie',authCookie(OAUTH_COOKIE,'',0));try{const user=await finishGoogle(request,await getChatGPTUser());headers.append('Set-Cookie',await issueSession(user.userId));headers.set('Location',appOrigin()+'/');}catch(e){const url=new URL(appOrigin());url.searchParams.set('auth_error',e instanceof Error?e.message:'Không thể đăng nhập Google.');headers.set('Location',url.href);}return new Response(null,{status:302,headers});}
