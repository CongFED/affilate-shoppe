import { getAppUser } from '../../../auth';
import { changePassword, requireSameOrigin } from '../../../../lib/auth-service';

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const user = await getAppUser();
    if (!user) {
      return Response.json({ error: 'Vui lòng đăng nhập để thực hiện đổi mật khẩu.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
    }

    const text = await request.text();
    if (text.length > 4000) throw new Error('Dữ liệu quá lớn.');
    const body = JSON.parse(text);

    if (body.newPassword !== body.confirmPassword) {
      throw new Error('Mật khẩu mới và xác nhận mật khẩu chưa khớp.');
    }

    const result = await changePassword(user.userId, body.currentPassword, body.newPassword);
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : 'Chưa thể đổi mật khẩu. Vui lòng thử lại.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
