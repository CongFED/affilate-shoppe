import { getAppUser } from '../../auth';
import { execute, snapshot } from '../../../lib/service';
export async function POST(request:Request){
 const user=await getAppUser();if(!user)return Response.json({error:'Vui lòng đăng nhập để lưu và quản lý tiền hoàn.'},{status:401});
 const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return Response.json({error:'Yêu cầu không hợp lệ.'},{status:403});
 if(Number(request.headers.get('content-length')??0)>400000)return Response.json({error:'Dữ liệu quá lớn.'},{status:413});
 try{
  const text=await request.text();if(text.length>400000)throw new Error('Dữ liệu quá lớn.');const body=JSON.parse(text);const mode='live';
  const result=await execute(user,mode,body);return Response.json({...result,data:result.data??await snapshot(user,mode)},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return Response.json({error:e instanceof Error?e.message:'Không thể hoàn thành thao tác. Vui lòng thử lại.'},{status:400,headers:{'Cache-Control':'no-store'}});}
}
