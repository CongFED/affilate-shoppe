'use client';
import { useEffect, useRef, useState } from 'react';
import {
  ShieldCheck, LayoutDashboard, Users, Wallet, ShoppingBag, Upload, Settings,
  Clock, ArrowUpRight, ArrowRight, Check, X, Search, RefreshCw, AlertCircle,
  CheckCircle2, Loader2, Lock, Unlock, Eye, ChevronRight, ChevronLeft, ExternalLink,
  Download, LogOut, Info, Gift, Package, UserCheck, UserX, Menu
} from 'lucide-react';
import type { AppUser } from '../../lib/auth-core';

type Row = Record<string, any>;

const money = (n: number) => new Intl.NumberFormat('vi-VN').format(n || 0) + ' ₫';
const date = (s: string) => {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return s;
  }
};
const dateTime = (s: string) => {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return s;
  }
};

const statusNames: Record<string, string> = {
  pending: 'Chờ xử lý',
  processing: 'Đang xử lý',
  paid: 'Đã chuyển tiền',
  rejected: 'Đã từ chối',
  approved: 'Đã duyệt',
  available: 'Có thể rút',
  active: 'Hoạt động',
  locked: 'Đã khóa'
};

function StatusBadge({ status }: { status: string }) {
  return <span className={'badge ' + status}><span />{statusNames[status] ?? status}</span>;
}

export default function AdminApp({ currentUser }: { currentUser: AppUser }) {
  const [tab, setTab] = useState<'overview' | 'users' | 'withdrawals' | 'orders' | 'import' | 'settings' | 'audit'>('overview');
  const [mode] = useState<'live'>('live');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [modal, setModal] = useState<Row | null>(null);
  const [menu, setMenu] = useState(false);

  // Overview data
  const [overview, setOverview] = useState<Row | null>(null);

  // Users data
  const [users, setUsers] = useState<Row[]>([]);
  const [userTotal, setUserTotal] = useState(0);
  const [userPage, setUserPage] = useState(1);
  const [userTotalPages, setUserTotalPages] = useState(1);
  const [userQuery, setUserQuery] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState('all');
  const [userRoleFilter, setUserRoleFilter] = useState('all');

  // Selected User Detail
  const [userDetail, setUserDetail] = useState<Row | null>(null);

  // Withdrawals data
  const [withdrawals, setWithdrawals] = useState<Row[]>([]);
  const [withTotal, setWithTotal] = useState(0);
  const [withPage, setWithPage] = useState(1);
  const [withTotalPages, setWithTotalPages] = useState(1);
  const [withQuery, setWithQuery] = useState('');
  const [withStatusFilter, setWithStatusFilter] = useState('all');

  // Orders & Import data
  const [orders, setOrders] = useState<Row[]>([]);
  const [csv, setCsv] = useState('');
  const [policyConfirmed, setPolicyConfirmed] = useState(false);

  // Settings & Audit
  const [share, setShare] = useState('80');
  const [minimum, setMinimum] = useState('50000');
  const [logs, setLogs] = useState<Row[]>([]);

  // Shopee API & System Config states
  const [shopeeAppId, setShopeeAppId] = useState('');
  const [shopeeAppSecret, setShopeeAppSecret] = useState('');
  const [shopeeEnabled, setShopeeEnabled] = useState(false);
  const [adminUserIds, setAdminUserIds] = useState('');
  const [shopeeBusy, setShopeeBusy] = useState(false);
  const [shopeeMsg, setShopeeMsg] = useState('');
  const [shopeeErr, setShopeeErr] = useState('');
  const [showSecret, setShowSecret] = useState(false);

  // Password change states
  const [curPass, setCurPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [passBusy, setPassBusy] = useState(false);
  const [passMsg, setPassMsg] = useState('');
  const [passErr, setPassErr] = useState('');
  const [showPass, setShowPass] = useState(false);

  // Modal form states
  const [modalReference, setModalReference] = useState('');
  const [modalNote, setModalNote] = useState('');
  const [modalReason, setModalReason] = useState('');
  const [modalConfirmed, setModalConfirmed] = useState(false);

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function notify(text: string) {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 5500);
  }

  async function changeAdminPassword(e: React.FormEvent) {
    e.preventDefault();
    setPassErr('');
    setPassMsg('');
    if (newPass !== confirmPass) {
      setPassErr('Mật khẩu mới và xác nhận mật khẩu chưa khớp.');
      return;
    }
    setPassBusy(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: curPass,
          newPassword: newPass,
          confirmPassword: confirmPass
        })
      });
      const result = await res.json() as { ok?: boolean; message?: string; error?: string };
      if (!res.ok || !result.ok) throw new Error(result.error ?? 'Đổi mật khẩu thất bại.');
      setPassMsg(result.message ?? 'Đổi mật khẩu thành công!');
      notify(result.message ?? 'Đổi mật khẩu thành công!');
      setCurPass('');
      setNewPass('');
      setConfirmPass('');
    } catch (err) {
      setPassErr(err instanceof Error ? err.message : 'Có lỗi xảy ra.');
    } finally {
      setPassBusy(false);
    }
  }

  async function act(action: string, values: Row = {}, targetMode = mode) {
    if (busy) return null;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, action, mode: targetMode })
      });
      const body = await res.json() as Row;
      if (!res.ok || body.error) throw new Error(body.error ?? 'Thao tác không thành công.');
      if (body.message) notify(body.message);
      return body;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Lỗi kết nối máy chủ.';
      setError(msg);
      return null;
    } finally {
      setBusy(false);
    }
  }

  // Load Overview
  async function loadOverview(targetMode = mode) {
    const res = await act('adminOverview', {}, targetMode);
    if (res?.overview) setOverview(res.overview);
  }

  // Load Users
  async function loadUsers(page = userPage, targetMode = mode) {
    const res = await act('adminUsers', {
      page,
      pageSize: 10,
      query: userQuery,
      status: userStatusFilter,
      role: userRoleFilter
    }, targetMode);
    if (res) {
      setUsers(res.users ?? []);
      setUserTotal(res.total ?? 0);
      setUserPage(res.page ?? 1);
      setUserTotalPages(res.totalPages ?? 1);
    }
  }

  // Load Withdrawals
  async function loadWithdrawals(page = withPage, targetMode = mode) {
    const res = await act('adminWithdrawals', {
      page,
      pageSize: 10,
      query: withQuery,
      status: withStatusFilter
    }, targetMode);
    if (res) {
      setWithdrawals(res.withdrawals ?? []);
      setWithTotal(res.total ?? 0);
      setWithPage(res.page ?? 1);
      setWithTotalPages(res.totalPages ?? 1);
    }
  }

  async function saveShopeeSettings(e: React.FormEvent) {
    e.preventDefault();
    setShopeeErr('');
    setShopeeMsg('');
    setShopeeBusy(true);
    try {
      const res = await act('saveShopeeConfig', {
        shopeeAppId,
        shopeeAppSecret,
        shopeeEnabled: shopeeEnabled ? 'true' : 'false',
        adminUserIds
      });
      if (res) {
        setShopeeMsg(res.message || 'Lưu cấu hình Shopee & Quản trị viên thành công!');
        notify(res.message || 'Lưu cấu hình Shopee & Quản trị viên thành công!');
        await loadCoreData();
      }
    } catch (err) {
      setShopeeErr(err instanceof Error ? err.message : 'Lỗi khi lưu cấu hình Shopee.');
    } finally {
      setShopeeBusy(false);
    }
  }

  // Load Settings & Orders
  async function loadCoreData(targetMode = mode) {
    const res = await act('init', {}, targetMode);
    if (res?.data?.admin) {
      setOrders(res.data.admin.orders ?? []);
      setLogs(res.data.admin.logs ?? []);
    }
    if (res?.data?.settings) {
      setShare(String((res.data.settings.share_bps ?? 8000) / 100));
      setMinimum(String(res.data.settings.min_withdraw ?? 50000));
      setShopeeAppId(res.data.settings.shopee_app_id ?? '');
      setShopeeAppSecret(res.data.settings.shopee_app_secret ?? '');
      setShopeeEnabled(res.data.settings.shopee_enabled === 'true' || res.data.settings.shopee_enabled === true);
      setAdminUserIds(res.data.settings.admin_user_ids ?? '');
    }
  }

  useEffect(() => {
    loadOverview();
    loadUsers(1);
    loadWithdrawals(1);
    loadCoreData();
  }, [mode]);

  useEffect(() => {
    if (tab === 'users') loadUsers(1);
    if (tab === 'withdrawals') loadWithdrawals(1);
    if (tab === 'overview') loadOverview();
    if (tab === 'orders' || tab === 'audit' || tab === 'settings') loadCoreData();
  }, [tab]);

  // View User Detail
  async function viewUser(userId: string) {
    const res = await act('adminUserDetail', { targetUserId: userId });
    if (res) {
      setUserDetail(res);
      setModal({ type: 'userDetail' });
    }
  }

  // Open Lock / Unlock modal
  function openLockModal(u: Row, lock: boolean) {
    setModalReason('');
    setModalConfirmed(false);
    setError('');
    setModal({ type: 'toggleLock', user: u, lock });
  }

  // Open Process Withdrawal Modal
  function openProcessWithdrawModal(w: Row, nextStatus: string) {
    setModalReference('');
    setModalNote('');
    setModalConfirmed(false);
    setError('');
    setModal({ type: 'processWithdraw', item: w, nextStatus });
  }

  // Open Settle Order Modal
  function openSettleModal(o: Row) {
    setModalReference('');
    setModalConfirmed(false);
    setError('');
    setModal({ type: 'settle', item: o });
  }

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <aside className={'sidebar ' + (menu ? 'mobile-open' : '')}>
        <a className="brand" href="/" aria-label="SANDEAL trang chủ">
          <span className="brand-mark">S<ArrowUpRight size={18} /></span>
          <span>sandeal<span className="brand-dot">.</span></span>
        </a>
        <div className="sidebar-caption">TRANG QUẢN TRỊ</div>

        <nav aria-label="Menu quản trị">
          <button className={'nav-item ' + (tab === 'overview' ? 'active' : '')} onClick={() => { setTab('overview'); setMenu(false); }}>
            <LayoutDashboard size={20} />
            <span>Tổng quan</span>
            {tab === 'overview' && <span className="nav-dot" />}
          </button>
          <button className={'nav-item ' + (tab === 'users' ? 'active' : '')} onClick={() => { setTab('users'); setMenu(false); }}>
            <Users size={20} />
            <span>Quản lý người dùng</span>
            {tab === 'users' && <span className="nav-dot" />}
          </button>
          <button className={'nav-item ' + (tab === 'withdrawals' ? 'active' : '')} onClick={() => { setTab('withdrawals'); setMenu(false); }}>
            <Wallet size={20} />
            <span>Yêu cầu rút tiền</span>
            {overview && overview.pendingWithdrawalsCount > 0 && (
              <span className="count-pill" style={{ marginLeft: 'auto', background: 'var(--amber)', color: '#fff' }}>
                {overview.pendingWithdrawalsCount}
              </span>
            )}
            {tab === 'withdrawals' && <span className="nav-dot" />}
          </button>
          <button className={'nav-item ' + (tab === 'orders' ? 'active' : '')} onClick={() => { setTab('orders'); setMenu(false); }}>
            <ShoppingBag size={20} />
            <span>Đối soát đơn hàng</span>
            {tab === 'orders' && <span className="nav-dot" />}
          </button>
          <button className={'nav-item ' + (tab === 'import' ? 'active' : '')} onClick={() => { setTab('import'); setMenu(false); }}>
            <Upload size={20} />
            <span>Nhập báo cáo CSV</span>
            {tab === 'import' && <span className="nav-dot" />}
          </button>
          <button className={'nav-item ' + (tab === 'settings' ? 'active' : '')} onClick={() => { setTab('settings'); setMenu(false); }}>
            <Settings size={20} />
            <span>Chính sách hoàn tiền</span>
            {tab === 'settings' && <span className="nav-dot" />}
          </button>
          <button className={'nav-item ' + (tab === 'audit' ? 'active' : '')} onClick={() => { setTab('audit'); setMenu(false); }}>
            <Clock size={20} />
            <span>Nhật ký hoạt động</span>
            {tab === 'audit' && <span className="nav-dot" />}
          </button>
        </nav>

        <div className="nav-divider" />

        <div className="sidebar-bottom">
          <a className="button small full" href="/" style={{ justifyContent: 'center', marginBottom: '0.75rem' }}>
            <ArrowRight size={15} /> Về giao diện khách
          </a>
          <div className="sidebar-copyright">
            <span>© 2026 SANDEAL Admin</span>
            <span>Phiên bản Quản trị Bảo mật</span>
          </div>
        </div>
      </aside>
      {menu && <button className="mobile-scrim" aria-label="Đóng menu" onClick={() => setMenu(false)} />}

      {/* Main Container */}
      <div className="main-shell">
        <header className="topbar">
          <div className="row">
            <button className="icon-button mobile-menu" aria-label="Mở menu quản trị" onClick={() => setMenu(!menu)}>
              <Menu size={22} />
            </button>
            <span className="breadcrumb">
              Quản trị SANDEAL <ChevronRight size={13} /> <strong>{
                tab === 'overview' ? 'Tổng quan hệ thống' :
                tab === 'users' ? 'Quản lý người dùng' :
                tab === 'withdrawals' ? 'Yêu cầu rút tiền' :
                tab === 'orders' ? 'Đối soát hoa hồng' :
                tab === 'import' ? 'Nhập báo cáo CSV' :
                tab === 'settings' ? 'Chính sách hoàn tiền' : 'Nhật ký hoạt động'
              }</strong>
            </span>
          </div>

          <div className="topbar-right">
            <div className="live-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.85rem', borderRadius: '999px', background: '#ecfdf5', color: '#065f46', fontSize: '0.82rem', fontWeight: 600 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />
              Dữ liệu thật
            </div>

            <div className="topbar-line" />

            <div className="user-button" style={{ cursor: 'default' }}>
              <span className="avatar" style={{ background: 'var(--orange)', color: '#fff' }}>A</span>
              <span>
                <strong>{currentUser.displayName || currentUser.email}</strong>
                <small style={{ color: 'var(--orange)', fontWeight: 600 }}>Quản trị viên</small>
              </span>
            </div>
          </div>
        </header>

        <main className="content">
          {error && !modal && (
            <div className="error" role="alert" style={{ marginBottom: '1.25rem' }}>
              <AlertCircle size={18} />
              <span>{error}</span>
              <button className="icon-button" onClick={() => setError('')}><X size={16} /></button>
            </div>
          )}

          {/* TAB: OVERVIEW */}
          {tab === 'overview' && (
            <div className="tab-view-container overview-tab">
              <div className="welcome">
                <div>
                  <div className="eyebrow muted">TRUNG TÂM KIỂM SOÁT</div>
                  <h1>Tổng quan hệ thống</h1>
                  <p>Số liệu thời gian thực được tổng hợp trực tiếp từ cơ sở dữ liệu chính thức.</p>
                </div>
                <button className="button small" disabled={busy} onClick={() => loadOverview()}>
                  <RefreshCw size={14} className={busy ? 'spin' : ''} /> Làm mới số liệu
                </button>
              </div>

              <div className="stats-grid">
                <div className="stat panel">
                  <span className="stat-icon mint"><Users size={22} /></span>
                  <div>
                    <p>Tổng thành viên</p>
                    <strong>{overview?.usersCount ?? 0} <small>tài khoản</small></strong>
                    <span>{overview?.activeUsers ?? 0} đang hoạt động · {overview?.lockedUsers ?? 0} bị khóa</span>
                  </div>
                </div>

                <div className="stat panel">
                  <span className="stat-icon lavender"><ShoppingBag size={22} /></span>
                  <div>
                    <p>Đơn hàng đối soát</p>
                    <strong>{overview?.ordersCount ?? 0} <small>đơn</small></strong>
                    <span>Tổng hoa hồng: {money(overview?.totalCommission ?? 0)}</span>
                  </div>
                </div>

                <div className="stat panel">
                  <span className="stat-icon peach"><Gift size={22} /></span>
                  <div>
                    <p>Tổng tiền hoàn cho khách</p>
                    <strong>{money(overview?.totalCashback ?? 0)}</strong>
                    <span>Khoản chia theo tỷ lệ đối soát</span>
                  </div>
                </div>

                <div className="stat panel" style={{ borderColor: overview && overview.pendingWithdrawalsCount > 0 ? 'var(--amber)' : 'inherit' }}>
                  <span className="stat-icon" style={{ background: '#fef3c7', color: '#b45309' }}><Wallet size={22} /></span>
                  <div>
                    <p>Yêu cầu rút chờ xử lý</p>
                    <strong style={{ color: '#b45309' }}>{overview?.pendingWithdrawalsCount ?? 0} <small>yêu cầu</small></strong>
                    <span>Số tiền giữ: {money(overview?.pendingWithdrawalsAmount ?? 0)}</span>
                  </div>
                </div>
              </div>

              <div className="row gap" style={{ marginTop: '1.5rem' }}>
                <section className="panel" style={{ flex: 1 }}>
                  <div className="section-head">
                    <div>
                      <h3>Thao tác quản trị nhanh</h3>
                      <p>Các luồng công việc cần thực hiện hằng ngày</p>
                    </div>
                  </div>
                  <div className="steps-grid">
                    <div className="step" style={{ cursor: 'pointer' }} onClick={() => setTab('withdrawals')}>
                      <div className="step-top"><span className="step-icon"><Wallet size={20} /></span><span className="step-no">01</span></div>
                      <h4>Xử lý rút tiền</h4>
                      <p>Kiểm tra tài khoản nhận và xác nhận chuyển khoản với mã giao dịch.</p>
                    </div>
                    <div className="step" style={{ cursor: 'pointer' }} onClick={() => setTab('import')}>
                      <div className="step-top"><span className="step-icon"><Upload size={20} /></span><span className="step-no">02</span></div>
                      <h4>Nhập báo cáo CSV</h4>
                      <p>Nạp báo cáo đơn hàng định kỳ từ Shopee để ghép Sub ID.</p>
                    </div>
                    <div className="step" style={{ cursor: 'pointer' }} onClick={() => setTab('orders')}>
                      <div className="step-top"><span className="step-icon"><CheckCircle2 size={20} /></span><span className="step-no">03</span></div>
                      <h4>Xác nhận hoa hồng về</h4>
                      <p>Mở số dư rút cho khách sau khi Shopee đã chuyển tiền vào ngân hàng.</p>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          )}

          {/* TAB: USERS MANAGEMENT */}
          {tab === 'users' && (
            <section className="panel table-panel-fill">
              <div className="section-head">
                <div>
                  <h3>Danh sách khách hàng & Người dùng</h3>
                  <p>Quản lý tài khoản, trạng thái hoạt động và chi tiết tài chính của từng người dùng.</p>
                </div>
                <button className="button small" disabled={busy} onClick={() => loadUsers(userPage)}>
                  <RefreshCw size={14} className={busy ? 'spin' : ''} /> Làm mới
                </button>
              </div>

              <div className="table-toolbar">
                <form
                  className="search-field"
                  onSubmit={e => { e.preventDefault(); loadUsers(1); }}
                  style={{ maxWidth: '320px' }}
                >
                  <Search size={17} />
                  <input
                    aria-label="Tìm kiếm người dùng"
                    placeholder="Tìm tên, email, ID..."
                    value={userQuery}
                    onChange={e => setUserQuery(e.target.value)}
                  />
                </form>

                <div className="row gap" style={{ marginLeft: 'auto' }}>
                  <select
                    className="select-filter"
                    aria-label="Lọc trạng thái"
                    value={userStatusFilter}
                    onChange={e => { setUserStatusFilter(e.target.value); setTimeout(() => loadUsers(1), 0); }}
                  >
                    <option value="all">Tất cả trạng thái</option>
                    <option value="active">Đang hoạt động</option>
                    <option value="locked">Đã bị khóa</option>
                  </select>

                  <select
                    className="select-filter"
                    aria-label="Lọc vai trò"
                    value={userRoleFilter}
                    onChange={e => { setUserRoleFilter(e.target.value); setTimeout(() => loadUsers(1), 0); }}
                  >
                    <option value="all">Tất cả vai trò</option>
                    <option value="customer">Khách hàng</option>
                    <option value="admin">Quản trị viên</option>
                  </select>
                </div>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Người dùng</th>
                      <th>Vai trò</th>
                      <th>Trạng thái</th>
                      <th>Ngày tham gia</th>
                      <th>Số đơn</th>
                      <th>Khả dụng</th>
                      <th>Chờ đối soát</th>
                      <th style={{ textAlign: 'right' }}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u: Row) => (
                      <tr key={u.id}>
                        <td>
                          <div>
                            <strong>{u.name}</strong>
                            <small className="block table-email">{u.email}</small>
                            <small className="block text-muted" style={{ fontSize: '0.75rem' }}>ID: {u.id}</small>
                          </div>
                        </td>
                        <td>
                          <span className={'badge ' + (u.role === 'admin' ? 'approved' : 'pending')}>
                            {u.role === 'admin' ? 'Quản trị' : 'Khách hàng'}
                          </span>
                        </td>
                        <td>
                          <StatusBadge status={u.status} />
                          {u.status === 'locked' && u.locked_reason && (
                            <small className="block danger-text" title={u.locked_reason}>
                              {u.locked_reason.slice(0, 30)}{u.locked_reason.length > 30 ? '...' : ''}
                            </small>
                          )}
                        </td>
                        <td>{date(u.created_at)}</td>
                        <td><strong>{u.stats?.order_count ?? 0}</strong></td>
                        <td className="cashback-value">{money(u.stats?.available ?? 0)}</td>
                        <td>{money(u.stats?.pending_cashback ?? 0)}</td>
                        <td style={{ textAlign: 'right' }}>
                          <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
                            <button
                              className="button small"
                              title="Xem chi tiết ví & đơn hàng"
                              onClick={() => viewUser(u.id)}
                            >
                              <Eye size={14} /> Chi tiết
                            </button>
                            {u.id !== currentUser.userId && (
                              u.status === 'locked' ? (
                                <button
                                  className="button small"
                                  style={{ borderColor: 'var(--green)', color: 'var(--green)' }}
                                  onClick={() => openLockModal(u, false)}
                                >
                                  <Unlock size={14} /> Mở khóa
                                </button>
                              ) : (
                                <button
                                  className="button small danger"
                                  onClick={() => openLockModal(u, true)}
                                >
                                  <Lock size={14} /> Khóa
                                </button>
                              )
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {!users.length && (
                  <div className="empty">
                    <Users size={32} />
                    <h3>Không tìm thấy người dùng phù hợp</h3>
                    <p>Thử tìm kiếm với từ khóa khác hoặc điều chỉnh bộ lọc.</p>
                  </div>
                )}
              </div>

              {/* Pagination */}
              <div className="table-foot">
                <span>Hiển thị trang {userPage} / {userTotalPages} ({userTotal} người dùng)</span>
                <div className="row gap">
                  <button
                    className="button small"
                    disabled={userPage <= 1 || busy}
                    onClick={() => loadUsers(userPage - 1)}
                  >
                    <ChevronLeft size={14} /> Trang trước
                  </button>
                  <button
                    className="button small"
                    disabled={userPage >= userTotalPages || busy}
                    onClick={() => loadUsers(userPage + 1)}
                  >
                    Trang sau <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* TAB: WITHDRAWALS MANAGEMENT */}
          {tab === 'withdrawals' && (
            <section className="panel table-panel-fill">
              <div className="section-head">
                <div>
                  <h3>Quản lý yêu cầu rút tiền</h3>
                  <p>Quy trình: Khách tạo yêu cầu → Nhận xử lý → Tự chuyển khoản ngoài → Xác nhận đã chuyển với mã giao dịch.</p>
                </div>
                <button className="button small" disabled={busy} onClick={() => loadWithdrawals(withPage)}>
                  <RefreshCw size={14} className={busy ? 'spin' : ''} /> Làm mới
                </button>
              </div>

              <div className="table-toolbar">
                <form
                  className="search-field"
                  onSubmit={e => { e.preventDefault(); loadWithdrawals(1); }}
                  style={{ maxWidth: '320px' }}
                >
                  <Search size={17} />
                  <input
                    aria-label="Tìm kiếm yêu cầu rút tiền"
                    placeholder="Mã YC, email, STK, GD..."
                    value={withQuery}
                    onChange={e => setWithQuery(e.target.value)}
                  />
                </form>

                <div className="filter-tabs" aria-label="Lọc trạng thái rút tiền" style={{ marginLeft: 'auto' }}>
                  {[
                    ['all', 'Tất cả'],
                    ['pending', 'Chờ xử lý'],
                    ['processing', 'Đang chuyển'],
                    ['paid', 'Đã chuyển tiền'],
                    ['rejected', 'Đã từ chối']
                  ].map(([val, label]) => (
                    <button
                      key={val}
                      className={withStatusFilter === val ? 'active' : ''}
                      onClick={() => { setWithStatusFilter(val); setTimeout(() => loadWithdrawals(1), 0); }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Mã YC / Ngày tạo</th>
                      <th>Khách hàng</th>
                      <th>Số tiền rút</th>
                      <th>Tài khoản nhận</th>
                      <th>Trạng thái</th>
                      <th>Người xử lý</th>
                      <th style={{ textAlign: 'right' }}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {withdrawals.map((w: Row) => (
                      <tr key={w.id}>
                        <td>
                          <strong>#{w.id.slice(0, 8)}</strong>
                          <small className="block text-muted">{dateTime(w.created_at)}</small>
                        </td>
                        <td>
                          <strong>{w.customer || 'Khách hàng'}</strong>
                          <small className="block table-email">{w.email}</small>
                        </td>
                        <td className="cashback-value" style={{ fontSize: '1.05rem' }}>
                          {money(w.amount)}
                        </td>
                        <td>
                          <strong>{w.bank}</strong>
                          <small className="block">STK: <code>{w.bank_number}</code></small>
                          <small className="block text-muted">Chủ TK: {w.bank_name}</small>
                        </td>
                        <td>
                          <StatusBadge status={w.status} />
                          {w.reference && <small className="block text-muted">Mã GD: <strong>{w.reference}</strong></small>}
                          {w.note && <small className="block danger-text">{w.note}</small>}
                        </td>
                        <td>
                          <span style={{ fontSize: '0.85rem' }}>{w.processed_by || '—'}</span>
                          {w.status === 'paid' && <small className="block text-muted">{dateTime(w.updated_at)}</small>}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
                            {w.status === 'pending' && (
                              <>
                                <button
                                  className="button small orange"
                                  disabled={busy}
                                  onClick={() => openProcessWithdrawModal(w, 'processing')}
                                >
                                  Nhận xử lý
                                </button>
                                <button
                                  className="button small danger"
                                  disabled={busy}
                                  onClick={() => openProcessWithdrawModal(w, 'rejected')}
                                >
                                  Từ chối
                                </button>
                              </>
                            )}

                            {w.status === 'processing' && (
                              <>
                                <button
                                  className="button small"
                                  style={{ background: 'var(--green)', color: '#fff' }}
                                  disabled={busy}
                                  onClick={() => openProcessWithdrawModal(w, 'paid')}
                                >
                                  <Check size={14} /> Xác nhận đã chuyển
                                </button>
                                <button
                                  className="button small danger"
                                  disabled={busy}
                                  onClick={() => openProcessWithdrawModal(w, 'rejected')}
                                >
                                  Từ chối
                                </button>
                              </>
                            )}

                            {['paid', 'rejected'].includes(w.status) && (
                              <span className="text-muted" style={{ fontSize: '0.85rem' }}>Đã hoàn tất</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {!withdrawals.length && (
                  <div className="empty">
                    <Wallet size={32} />
                    <h3>Không có yêu cầu rút tiền</h3>
                    <p>Các yêu cầu rút tiền của khách hàng sẽ hiển thị tại đây.</p>
                  </div>
                )}
              </div>

              {/* Pagination */}
              <div className="table-foot">
                <span>Hiển thị trang {withPage} / {withTotalPages} ({withTotal} yêu cầu)</span>
                <div className="row gap">
                  <button
                    className="button small"
                    disabled={withPage <= 1 || busy}
                    onClick={() => loadWithdrawals(withPage - 1)}
                  >
                    <ChevronLeft size={14} /> Trang trước
                  </button>
                  <button
                    className="button small"
                    disabled={withPage >= withTotalPages || busy}
                    onClick={() => loadWithdrawals(withPage + 1)}
                  >
                    Trang sau <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* TAB: ORDERS & SETTLEMENT */}
          {tab === 'orders' && (
            <section className="panel table-panel-fill">
              <div className="section-head">
                <div>
                  <h3>Đối soát hoa hồng đơn hàng Shopee</h3>
                  <p>Chỉ bấm &quot;Xác nhận tiền về&quot; sau khi bạn đã kiểm tra tài khoản ngân hàng và nhận đủ tiền hoa hồng từ Shopee.</p>
                </div>
                <button className="button small orange" onClick={() => setTab('import')}>
                  <Upload size={14} /> Nhập báo cáo CSV
                </button>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Sản phẩm / Mã đơn</th>
                      <th>Khách hàng</th>
                      <th>Giá trị đơn</th>
                      <th>Hoa hồng Shopee</th>
                      <th>Tiền hoàn khách</th>
                      <th>Trạng thái</th>
                      <th>Đối soát hoa hồng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o: Row) => (
                      <tr key={o.id}>
                        <td>
                          <strong>{o.product}</strong>
                          <small className="block text-muted">{o.external_id}</small>
                        </td>
                        <td>
                          <strong>{o.customer || 'Khách'}</strong>
                          <small className="block table-email">{o.email}</small>
                        </td>
                        <td>{money(o.amount)}</td>
                        <td>{money(o.commission)}</td>
                        <td className="cashback-value">+{money(o.cashback)}</td>
                        <td><StatusBadge status={o.status} /></td>
                        <td>
                          {o.status === 'approved' ? (
                            <button
                              className="button small orange"
                              disabled={busy}
                              onClick={() => openSettleModal(o)}
                            >
                              Xác nhận tiền về
                            </button>
                          ) : o.status === 'available' ? (
                            <div>
                              <span className="text-muted" style={{ fontSize: '0.85rem' }}>Đã mở rút</span>
                              {o.settlement_ref && <small className="block text-muted">Mã: {o.settlement_ref}</small>}
                            </div>
                          ) : (
                            <span className="text-muted">{date(o.created_at)}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {!orders.length && (
                  <div className="empty">
                    <ShoppingBag size={32} />
                    <h3>Chưa có đơn hàng nào</h3>
                    <p>Hãy tải mẫu CSV và nhập báo cáo đối soát để bắt đầu ghi nhận đơn.</p>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* TAB: IMPORT CSV */}
          {tab === 'import' && (
            <div className="tab-view-container">
              <div className="admin-form panel table-panel-fill" style={{ overflowY: 'auto' }}>
              <div className="row between">
                <div>
                  <h3>Nhập báo cáo đối soát CSV</h3>
                  <p>Báo cáo đối soát Shopee được chuẩn hóa về định dạng 7 cột bên dưới.</p>
                </div>
                <button
                  className="button small"
                  onClick={() => {
                    const sample = 'order_id,sub_id,product,amount,commission,status,date\nSP001:ITEM1,hSAMPLE_SUB_ID,Áo thun polo,250000,25000,approved,2026-10-15\n';
                    const blob = new Blob(['\uFEFF' + sample], { type: 'text/csv;charset=utf-8;' });
                    const u = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = u;
                    a.download = 'Sandeal_mau_doi_soat.csv';
                    a.click();
                    setTimeout(() => URL.revokeObjectURL(u), 1000);
                  }}
                >
                  <Download size={14} /> Tải mẫu CSV chuẩn
                </button>
              </div>

              <div className="info-box" style={{ margin: '1rem 0' }}>
                <Info size={18} />
                <span>Hệ thống ghép đơn tự động bằng <strong>Sub ID</strong>. Mỗi dòng sản phẩm cần có mã đơn duy nhất (ví dụ: <code>mãđơn:mãsảnphẩm</code>).</span>
              </div>

              <label className="file-drop">
                <Upload size={25} />
                <strong>Chọn file CSV từ máy tính của bạn</strong>
                <span>Hoặc dán trực tiếp nội dung vào khung bên dưới</span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={async e => {
                    const f = e.target.files?.[0];
                    if (f) {
                      if (f.size > 300000) { setError('File vượt quá giới hạn 300 KB.'); return; }
                      setCsv(await f.text());
                    }
                  }}
                />
              </label>

              <label>
                Nội dung CSV
                <textarea
                  className="csv-area"
                  value={csv}
                  onChange={e => setCsv(e.target.value)}
                  placeholder="order_id,sub_id,product,amount,commission,status,date&#10;SP001:ITEM1,h...,Ten san pham,250000,25000,approved,2026-10-15"
                  maxLength={300000}
                />
              </label>

              <label className="checkbox-label" style={{ marginTop: '0.75rem' }}>
                <input type="checkbox" checked={policyConfirmed} onChange={e => setPolicyConfirmed(e.target.checked)} />
                Tôi đã kiểm tra tính chính xác của Sub ID và số tiền hoa hồng trước khi nhập.
              </label>

              <button
                className="button orange"
                disabled={busy || !csv.trim() || !policyConfirmed}
                onClick={async () => {
                  const res = await act('import', { csv });
                  if (res) {
                    setCsv('');
                    setPolicyConfirmed(false);
                    loadCoreData();
                    setTab('orders');
                  }
                }}
              >
                {busy ? <Loader2 size={16} className="spin" /> : <Upload size={16} />} Kiểm tra và nạp dữ liệu
              </button>
            </div>
          </div>
          )}

          {/* TAB: SETTINGS */}
          {tab === 'settings' && (
            <div className="tab-view-container settings-tab">
              <div className="settings-grid">
                <div className="settings-left" style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
                  {/* CẤU HÌNH SHOPEE OPEN API & ADMIN USER IDS */}
                  <form className="admin-form panel" onSubmit={saveShopeeSettings}>
                    <div className="row between" style={{ marginBottom: '4px' }}>
                      <h3>Cấu hình Shopee Affiliate & Quản trị</h3>
                      <div className="live-badge" style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        padding: '0.35rem 0.75rem',
                        borderRadius: '999px',
                        background: (shopeeEnabled && shopeeAppId && shopeeAppSecret) ? '#ecfdf5' : '#fffbeb',
                        color: (shopeeEnabled && shopeeAppId && shopeeAppSecret) ? '#065f46' : '#b45309',
                        fontSize: '0.78rem',
                        fontWeight: 600
                      }}>
                        <span style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: (shopeeEnabled && shopeeAppId && shopeeAppSecret) ? '#10b981' : '#f59e0b'
                        }} />
                        {(shopeeEnabled && shopeeAppId && shopeeAppSecret) ? 'Đang kích hoạt Shopee API' : 'Chưa kích hoạt API'}
                      </div>
                    </div>
                    <p>Nhập thông số kết nối Shopee Open API và danh sách ID quản trị viên của website.</p>

                    {shopeeMsg && (
                      <div className="withdraw-balance" style={{ marginBottom: '14px', background: '#ecfdf5', borderColor: '#d1fae5', color: '#065f46' }}>
                        <span><Check size={16} /> {shopeeMsg}</span>
                      </div>
                    )}
                    {shopeeErr && (
                      <div className="error" style={{ marginBottom: '14px' }} role="alert">
                        <AlertCircle size={16} />
                        <span>{shopeeErr}</span>
                      </div>
                    )}

                    {/* SHOPEE_APP_ID */}
                    <label>
                      Shopee App ID (SHOPEE_APP_ID)
                      <input
                        type="text"
                        placeholder="VD: 18273645091"
                        value={shopeeAppId}
                        onChange={e => setShopeeAppId(e.target.value)}
                        disabled={shopeeBusy}
                      />
                      <small className="field-hint">Mã App ID được Shopee cấp trong cổng Shopee Affiliate Open API.</small>
                    </label>

                    {/* SHOPEE_APP_SECRET */}
                    <label>
                      Shopee App Secret (SHOPEE_APP_SECRET)
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <input
                          type={showSecret ? 'text' : 'password'}
                          placeholder="Nhập Shopee App Secret"
                          value={shopeeAppSecret}
                          onChange={e => setShopeeAppSecret(e.target.value)}
                          disabled={shopeeBusy}
                          style={{ paddingRight: '70px' }}
                        />
                        <button
                          type="button"
                          className="text-link"
                          onClick={() => setShowSecret(!showSecret)}
                          style={{ position: 'absolute', right: '12px', fontSize: '12px' }}
                        >
                          {showSecret ? 'Ẩn' : 'Hiện'}
                        </button>
                      </div>
                      <small className="field-hint">Khóa bảo mật dùng để tạo chữ ký số SHA-256 gọi API tạo link.</small>
                    </label>

                    {/* SHOPEE_ENABLED */}
                    <label className="checkbox-label" style={{ marginTop: '16px', background: '#f8fafc', padding: '12px 14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                      <input
                        type="checkbox"
                        checked={shopeeEnabled}
                        onChange={e => setShopeeEnabled(e.target.checked)}
                        disabled={shopeeBusy}
                      />
                      <div>
                        <strong style={{ display: 'block', color: '#0f172a' }}>Kích hoạt kết nối Shopee thật (SHOPEE_ENABLED)</strong>
                        <span style={{ fontSize: '12px', color: '#64748b' }}>Chỉ bật khi App ID & Secret đã sẵn sàng và tài khoản Shopee có quyền Open API.</span>
                      </div>
                    </label>

                    {/* ADMIN_USER_IDS */}
                    <label style={{ marginTop: '14px' }}>
                      Danh sách User ID Quản trị viên (ADMIN_USER_IDS)
                      <input
                        type="text"
                        placeholder="app:uuid-1, app:uuid-2"
                        value={adminUserIds}
                        onChange={e => setAdminUserIds(e.target.value)}
                        disabled={shopeeBusy}
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                        <small className="field-hint">Phân tách nhiều ID bằng dấu phẩy (,).</small>
                        <button
                          type="button"
                          className="text-link"
                          style={{ fontSize: '12px' }}
                          onClick={() => {
                            if (!currentUser.userId) return;
                            const ids = adminUserIds.split(',').map(s => s.trim()).filter(Boolean);
                            if (!ids.includes(currentUser.userId)) {
                              setAdminUserIds([...ids, currentUser.userId].join(', '));
                            }
                          }}
                        >
                          + Thêm ID của tôi
                        </button>
                      </div>
                    </label>

                    <button
                      className="button orange"
                      type="submit"
                      disabled={shopeeBusy}
                      style={{ marginTop: '18px' }}
                    >
                      {shopeeBusy ? <Loader2 size={16} className="spin" /> : <Check size={16} />} Lưu cấu hình Shopee & Quản trị
                    </button>
                  </form>

                  {/* FORM CHÍNH SÁCH CHIA SẺ HOA HỒNG & RÚT TIỀN */}
                  <form
                    className="admin-form panel settings-form"
                    onSubmit={async e => {
                      e.preventDefault();
                      await act('settings', {
                        shareBps: Math.round(Number(share) * 100),
                        minWithdraw: minimum
                      });
                    }}
                  >
                    <h3>Chính sách chia sẻ hoa hồng & Rút tiền</h3>
                    <p>Cấu hình này áp dụng cho các đơn hàng mới nạp; các đơn cũ giữ nguyên tỷ lệ đã chốt.</p>

                    <label>
                      Tỷ lệ chia cho khách (% hoa hồng thực nhận)
                      <div className="unit-input">
                        <input
                          type="number"
                          min="0.01"
                          max="100"
                          step="0.01"
                          required
                          value={share}
                          onChange={e => setShare(e.target.value)}
                        />
                        <span>%</span>
                      </div>
                    </label>

                    <div className="calculation">
                      <Gift size={22} />
                      <div>
                        Nếu Shopee thanh toán hoa hồng <strong>100.000 ₫</strong>:
                        <p>
                          Khách nhận <strong>{money(Math.floor(100000 * Number(share) / 100))}</strong> ·
                          Chủ website nhận <strong>{money(100000 - Math.floor(100000 * Number(share) / 100))}</strong>
                        </p>
                      </div>
                    </div>

                    <label>
                      Mức rút tiền tối thiểu
                      <div className="unit-input">
                        <input
                          type="number"
                          min="1000"
                          max="10000000"
                          step="1000"
                          required
                          value={minimum}
                          onChange={e => setMinimum(e.target.value)}
                        />
                        <span>VND</span>
                      </div>
                    </label>

                    <button className="button orange" disabled={busy} type="submit" style={{ marginTop: '18px' }}>
                      <Check size={16} /> Lưu chính sách
                    </button>
                  </form>
                </div>

                <div className="settings-right" style={{ overflowY: 'auto' }}>
                  <section className="panel admin-form">
                    <h3>Đổi mật khẩu Quản trị viên</h3>
                    <p>Cập nhật mật khẩu quản trị để đảm bảo an toàn truy cập dữ liệu và vận hành hệ thống.</p>

                    {passMsg && (
                      <div className="withdraw-balance" style={{ marginBottom: '12px', background: '#ecfdf5', borderColor: '#d1fae5', color: '#065f46' }}>
                        <span><Check size={16} /> {passMsg}</span>
                      </div>
                    )}
                    {passErr && (
                      <div className="error" style={{ marginBottom: '12px' }} role="alert">
                        <AlertCircle size={16} />
                        <span>{passErr}</span>
                      </div>
                    )}

                    <form onSubmit={changeAdminPassword}>
                      <label>
                        Mật khẩu hiện tại
                        <input
                          type={showPass ? 'text' : 'password'}
                          placeholder="Nhập mật khẩu hiện tại"
                          value={curPass}
                          onChange={e => setCurPass(e.target.value)}
                          required
                          disabled={passBusy}
                        />
                      </label>

                      <label>
                        Mật khẩu mới (tối thiểu 8 ký tự)
                        <input
                          type={showPass ? 'text' : 'password'}
                          placeholder="Nhập mật khẩu mới"
                          value={newPass}
                          onChange={e => setNewPass(e.target.value)}
                          minLength={8}
                          maxLength={128}
                          required
                          disabled={passBusy}
                        />
                      </label>

                      <label>
                        Xác nhận mật khẩu mới
                        <input
                          type={showPass ? 'text' : 'password'}
                          placeholder="Nhập lại mật khẩu mới"
                          value={confirmPass}
                          onChange={e => setConfirmPass(e.target.value)}
                          minLength={8}
                          maxLength={128}
                          required
                          disabled={passBusy}
                        />
                      </label>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
                        <button type="button" className="text-link" onClick={() => setShowPass(!showPass)}>
                          {showPass ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                        </button>
                        <button disabled={passBusy || !newPass || !confirmPass} className="button orange" type="submit">
                          {passBusy ? <Loader2 size={16} className="spin" /> : <Check size={16} />} Cập nhật mật khẩu
                        </button>
                      </div>
                    </form>
                  </section>

                  <section className="panel admin-form">
                    <h3>Thông tin tài khoản Quản trị</h3>
                    <p className="account-email" style={{ marginBottom: '8px' }}>
                      <strong>{currentUser.displayName || currentUser.fullName || 'Quản trị viên'}</strong> ({currentUser.email})
                    </p>
                    <label>
                      Mã tài khoản
                      <div className="code-box">
                        <code>{currentUser.userId}</code>
                      </div>
                    </label>
                    <p className="field-hint">Tài khoản này có toàn quyền duyệt đơn, mở tiền hoàn và xử lý thanh toán.</p>
                  </section>
                </div>
              </div>
            </div>
          )}

          {/* TAB: AUDIT LOG */}
          {tab === 'audit' && (
            <div className="panel admin-form table-panel-fill">
              <div className="section-head">
                <div>
                  <h3>Nhật ký hoạt động Quản trị</h3>
                  <p>Lịch sử ghi nhận mọi thao tác: khóa tài khoản, xử lý rút tiền, xác nhận hoa hồng và đổi chính sách.</p>
                </div>
              </div>

              <div className="audit-list">
                {logs.map((l: Row) => (
                  <div className="audit-item" key={l.id}>
                    <span className="icon-round"><Clock size={16} /></span>
                    <div>
                      <strong>{l.action}</strong>
                      <p>{l.detail}</p>
                      <small className="text-muted">{dateTime(l.created_at)} · Thực hiện bởi: {l.actor}</small>
                    </div>
                  </div>
                ))}
                {!logs.length && (
                  <div className="empty">
                    <Clock size={28} />
                    <p>Chưa có thao tác nào được ghi nhận.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* TOAST NOTIFICATION */}
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={20} />
          <span>{toast}</span>
          <button className="icon-button" onClick={() => setToast('')}><X size={15} /></button>
        </div>
      )}

      {/* MODALS */}
      {modal && (
        <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget && !busy) setModal(null); }}>
          <div className="modal" role="dialog" aria-modal="true" style={{ maxWidth: modal.type === 'userDetail' ? '680px' : '520px' }}>
            <button className="modal-close icon-button" onClick={() => setModal(null)} disabled={busy}><X size={20} /></button>

            {/* MODAL: USER DETAIL */}
            {modal.type === 'userDetail' && userDetail && (
              <>
                <span className="modal-icon"><Users size={26} /></span>
                <h2>Chi tiết khách hàng</h2>
                <p className="modal-description">{userDetail.user.name} ({userDetail.user.email})</p>

                <div className="withdraw-balance" style={{ margin: '1rem 0' }}>
                  <span>Số dư khả dụng: <strong>{money(userDetail.financials.available)}</strong></span>
                  <span style={{ fontSize: '0.85rem' }}>Chờ đối soát: {money(userDetail.financials.pendingCashback)} · Đã rút: {money(userDetail.financials.paidAmount)}</span>
                </div>

                <div className="detail-lines" style={{ marginBottom: '1.25rem' }}>
                  <div><span>Mã người dùng</span><code>{userDetail.user.id}</code></div>
                  <div><span>Vai trò</span><strong>{userDetail.user.role === 'admin' ? 'Quản trị viên' : 'Khách hàng'}</strong></div>
                  <div><span>Trạng thái</span><StatusBadge status={userDetail.user.status} /></div>
                  <div><span>Ngày tham gia</span><span>{dateTime(userDetail.user.created_at)}</span></div>
                  {userDetail.account?.bank && (
                    <div><span>Tài khoản ngân hàng</span><strong>{userDetail.account.bank} — {userDetail.account.bank_number} ({userDetail.account.bank_name})</strong></div>
                  )}
                  {userDetail.user.status === 'locked' && (
                    <div><span className="danger-text">Lý do khóa</span><strong className="danger-text">{userDetail.user.locked_reason}</strong></div>
                  )}
                </div>

                <h3>Lịch sử rút tiền gần đây ({userDetail.withdrawals.length})</h3>
                <div className="table-wrap" style={{ maxHeight: '180px', overflowY: 'auto', marginBottom: '1rem' }}>
                  <table>
                    <thead>
                      <tr><th>Ngày</th><th>Số tiền</th><th>Trạng thái</th><th>Mã GD</th></tr>
                    </thead>
                    <tbody>
                      {userDetail.withdrawals.map((w: Row) => (
                        <tr key={w.id}>
                          <td>{date(w.created_at)}</td>
                          <td className="cashback-value">{money(w.amount)}</td>
                          <td><StatusBadge status={w.status} /></td>
                          <td>{w.reference || '—'}</td>
                        </tr>
                      ))}
                      {!userDetail.withdrawals.length && <tr><td colSpan={4} style={{ textAlign: 'center' }}>Chưa có yêu cầu rút nào</td></tr>}
                    </tbody>
                  </table>
                </div>

                <button className="button full" onClick={() => setModal(null)}>Đóng</button>
              </>
            )}

            {/* MODAL: LOCK / UNLOCK USER */}
            {modal.type === 'toggleLock' && (
              <form onSubmit={async e => {
                e.preventDefault();
                const res = await act('adminToggleLock', {
                  targetUserId: modal.user.id,
                  lock: modal.lock,
                  reason: modalReason
                });
                if (res) {
                  setModal(null);
                  loadUsers();
                  loadOverview();
                }
              }}>
                <span className="modal-icon">{modal.lock ? <Lock size={26} /> : <Unlock size={26} />}</span>
                <h2>{modal.lock ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}</h2>
                <p className="modal-description">Khách hàng: <strong>{modal.user.name}</strong> ({modal.user.email})</p>

                {modal.lock ? (
                  <>
                    <div className="info-box" style={{ margin: '1rem 0' }}>
                      <AlertCircle size={18} />
                      <span>Khi bị khóa, toàn bộ phiên đăng nhập của người dùng sẽ bị hủy ngay lập tức. Người dùng không thể đăng nhập hoặc thao tác cho đến khi được mở khóa. Lịch sử ví và đơn hàng được giữ nguyên.</span>
                    </div>

                    <label>
                      Lý do khóa tài khoản <span style={{ color: 'red' }}>*</span>
                      <textarea
                        required
                        minLength={4}
                        maxLength={250}
                        rows={3}
                        value={modalReason}
                        onChange={e => setModalReason(e.target.value)}
                        placeholder="Nhập lý do khóa tài khoản..."
                      />
                    </label>
                  </>
                ) : (
                  <p style={{ margin: '1rem 0' }}>Bạn có chắc chắn muốn mở khóa cho tài khoản này? Người dùng sẽ có thể đăng nhập và tiếp tục mua sắm, nhận hoàn tiền bình thường.</p>
                )}

                <label className="checkbox-label" style={{ margin: '1rem 0' }}>
                  <input type="checkbox" required checked={modalConfirmed} onChange={e => setModalConfirmed(e.target.checked)} />
                  Tôi xác nhận thực hiện thao tác này.
                </label>

                {error && <div className="error" role="alert" style={{ marginBottom: '1rem' }}>{error}</div>}

                <button className={'button full ' + (modal.lock ? 'danger' : 'orange')} type="submit" disabled={busy || !modalConfirmed}>
                  {busy ? <Loader2 size={16} className="spin" /> : modal.lock ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
                </button>
              </form>
            )}

            {/* MODAL: PROCESS WITHDRAWAL */}
            {modal.type === 'processWithdraw' && (
              <form onSubmit={async e => {
                e.preventDefault();
                const res = await act('processWithdraw', {
                  id: modal.item.id,
                  status: modal.nextStatus,
                  reference: modalReference,
                  note: modalNote
                });
                if (res) {
                  setModal(null);
                  loadWithdrawals();
                  loadOverview();
                }
              }}>
                <span className="modal-icon">
                  {modal.nextStatus === 'paid' ? <CheckCircle2 size={26} /> : modal.nextStatus === 'rejected' ? <X size={26} /> : <Wallet size={26} />}
                </span>
                <h2>
                  {modal.nextStatus === 'paid' ? 'Xác nhận đã chuyển tiền' : modal.nextStatus === 'rejected' ? 'Từ chối yêu cầu rút' : 'Nhận xử lý yêu cầu'}
                </h2>
                <p className="modal-description">Yêu cầu #{modal.item.id.slice(0, 8)} · Số tiền: <strong>{money(modal.item.amount)}</strong></p>

                <div className="withdraw-balance" style={{ margin: '1rem 0', flexDirection: 'column', alignItems: 'flex-start' }}>
                  <div>Khách nhận: <strong>{modal.item.customer} ({modal.item.email})</strong></div>
                  <div>Ngân hàng: <strong>{modal.item.bank}</strong></div>
                  <div>Số tài khoản: <code>{modal.item.bank_number}</code></div>
                  <div>Tên chủ tài khoản: <strong>{modal.item.bank_name}</strong></div>
                </div>

                {modal.nextStatus === 'paid' && (
                  <label>
                    Mã giao dịch ngân hàng đã chuyển <span style={{ color: 'red' }}>*</span>
                    <input
                      required
                      minLength={4}
                      maxLength={150}
                      value={modalReference}
                      onChange={e => setModalReference(e.target.value)}
                      placeholder="VD: FT26101512345678"
                    />
                  </label>
                )}

                {modal.nextStatus === 'rejected' && (
                  <label>
                    Lý do từ chối <span style={{ color: 'red' }}>*</span>
                    <textarea
                      required
                      minLength={4}
                      maxLength={250}
                      rows={3}
                      value={modalNote}
                      onChange={e => setModalNote(e.target.value)}
                      placeholder="VD: Sai thông tin số tài khoản hoặc ngân hàng..."
                    />
                  </label>
                )}

                <label className="checkbox-label" style={{ margin: '1rem 0' }}>
                  <input type="checkbox" required checked={modalConfirmed} onChange={e => setModalConfirmed(e.target.checked)} />
                  {modal.nextStatus === 'paid'
                    ? 'Tôi xác nhận đã chuyển khoản thành công từ tài khoản ngân hàng thực tế.'
                    : modal.nextStatus === 'rejected'
                    ? 'Tôi xác nhận từ chối và hoàn lại số tiền vào số dư khả dụng của khách.'
                    : 'Tôi xác nhận nhận xử lý và sẽ chuyển khoản thủ công cho khách.'}
                </label>

                {error && <div className="error" role="alert" style={{ marginBottom: '1rem' }}>{error}</div>}

                <button className={'button full ' + (modal.nextStatus === 'rejected' ? 'danger' : 'orange')} type="submit" disabled={busy || !modalConfirmed}>
                  {busy ? <Loader2 size={16} className="spin" /> : 'Xác nhận thao tác'}
                </button>
              </form>
            )}

            {/* MODAL: SETTLE ORDER */}
            {modal.type === 'settle' && (
              <form onSubmit={async e => {
                e.preventDefault();
                const res = await act('settle', {
                  id: modal.item.id,
                  reference: modalReference
                });
                if (res) {
                  setModal(null);
                  loadCoreData();
                }
              }}>
                <span className="modal-icon"><CheckCircle2 size={26} /></span>
                <h2>Xác nhận hoa hồng đã về</h2>
                <p className="modal-description">Đơn {modal.item.external_id} · Hoa hồng Shopee: {money(modal.item.commission)}</p>

                <div className="withdraw-balance" style={{ margin: '1rem 0' }}>
                  <span>Tiền hoàn mở cho khách</span>
                  <strong>{money(modal.item.cashback)}</strong>
                </div>

                <label>
                  Mã đối soát / Tham chiếu tiền về từ Shopee <span style={{ color: 'red' }}>*</span>
                  <input
                    required
                    minLength={4}
                    maxLength={150}
                    value={modalReference}
                    onChange={e => setModalReference(e.target.value)}
                    placeholder="VD: SHOPEE-COMM-202610"
                  />
                </label>

                <label className="checkbox-label" style={{ margin: '1rem 0' }}>
                  <input type="checkbox" required checked={modalConfirmed} onChange={e => setModalConfirmed(e.target.checked)} />
                  Tôi xác nhận khoản hoa hồng này đã thực tế về tài khoản ngân hàng của tôi.
                </label>

                {error && <div className="error" role="alert" style={{ marginBottom: '1rem' }}>{error}</div>}

                <button className="button orange full" type="submit" disabled={busy || !modalConfirmed}>
                  {busy ? <Loader2 size={16} className="spin" /> : 'Xác nhận mở tiền hoàn'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
