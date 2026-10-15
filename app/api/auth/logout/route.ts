import {destroySession,requireSameOrigin} from '../../../../lib/auth-service';
import {readCookie,SESSION_COOKIE} from '../../../../lib/auth-core';
export async function POST(request:Request){try{requireSameOrigin(request);return Response.json({ok:true},{headers:{'Set-Cookie':await destroySession(readCookie(request.headers.get('cookie'),SESSION_COOKIE)),'Cache-Control':'no-store'}});}catch{return Response.json({error:'Yêu cầu không hợp lệ.'},{status:403});}}
