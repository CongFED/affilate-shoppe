import {appOrigin,beginGoogle} from '../../../../lib/auth-service';
export async function GET(){try{const result=await beginGoogle();return new Response(null,{status:302,headers:{Location:result.url,'Set-Cookie':result.cookie,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});}catch{return Response.redirect(appOrigin()+'/?auth_error=google_not_configured',302);}}
