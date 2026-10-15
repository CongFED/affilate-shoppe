import CashbackApp from './cashback-app';
import AuthScreen from './auth-screen';
import {getAppUser} from './auth';
import {getChatGPTUser} from './chatgpt-auth';
import {googleReady} from '../lib/auth-service';
import {init} from '../lib/service';
export const dynamic='force-dynamic';
export default async function Home({searchParams}:{searchParams:Promise<{auth_error?:string}>}){
 const user=await getAppUser();
 if(!user){const params=await searchParams;const legacy=await getChatGPTUser();return <AuthScreen initialEmail={legacy?.email??''} googleEnabled={googleReady()} initialError={typeof params.auth_error==='string'?params.auth_error.slice(0,250):''}/>;}
 let initialData=null,error='';try{initialData=await init(user,'live');}catch{error='Không tải được dữ liệu. Vui lòng bấm Làm mới hoặc thử lại sau.';}
 return <CashbackApp initialData={initialData} signedIn={true} initialError={error}/>;
}
