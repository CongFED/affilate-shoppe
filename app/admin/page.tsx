import { getAppUser } from '../auth';
import { checkAdmin } from '../../lib/auth-service';
import { redirect } from 'next/navigation';
import AdminApp from './admin-app';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const user = await getAppUser();
  if (!user) {
    redirect('/');
  }
  const isAdm = await checkAdmin(user);
  if (!isAdm) {
    return (
      <main className="app-shell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '2rem' }}>
        <div className="panel" style={{ maxWidth: '480px', textAlign: 'center', padding: '2.5rem' }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.75rem' }}>Truy cập bị từ chối</h2>
          <p style={{ color: 'var(--muted)', marginBottom: '1.5rem' }}>Khu vực này chỉ dành riêng cho Quản trị viên của SANDEAL.</p>
          <a className="button orange" href="/">Quay về Trang chủ</a>
        </div>
      </main>
    );
  }
  return <AdminApp currentUser={user} />;
}
