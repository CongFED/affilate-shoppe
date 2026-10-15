'use client';
import { useState } from 'react';
import {
  ArrowUpRight, ArrowRight, Check, ShieldCheck, Link as LinkIcon, Wallet,
  Eye, EyeOff, Loader2, AlertCircle, Mail, LockKeyhole, UserRound,
  ShoppingBag, Sparkles, TrendingUp, CheckCircle2, ChevronDown, Lock
} from 'lucide-react';

function GoogleMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.89-1.74 2.98-4.3 2.98-7.36Z" />
      <path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.76-5.59-4.13H3.07v2.59A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.41 13.91A6 6 0 0 1 6.1 12c0-.66.11-1.3.31-1.91V7.5H3.07A10 10 0 0 0 2 12c0 1.61.38 3.14 1.07 4.5l3.34-2.59Z" />
      <path fill="#EA4335" d="M12 5.96c1.47 0 2.79.51 3.82 1.51l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.93 5.5l3.34 2.59C7.2 7.72 9.4 5.96 12 5.96Z" />
    </svg>
  );
}

export default function AuthScreen({
  googleEnabled,
  initialError = '',
  initialEmail = ''
}: {
  googleEnabled: boolean;
  initialError?: string;
  initialEmail?: string;
}) {
  const [view, setView] = useState<'login' | 'register'>('login');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(
    initialError === 'google_not_configured'
      ? 'Đăng nhập Google chưa được kích hoạt. Bạn có thể sử dụng email và mật khẩu.'
      : initialError
  );
  const [name, setName] = useState('');
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  function change(next: 'login' | 'register') {
    if (busy) return;
    setView(next);
    setError('');
    setPassword('');
    setConfirm('');
    setShow(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError('');
    if (view === 'register' && password !== confirm) {
      setError('Mật khẩu nhập lại chưa khớp.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/auth/' + view, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      });
      const result = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || !result.ok) throw new Error(result.error ?? 'Chưa thể hoàn tất. Vui lòng thử lại.');
      window.location.assign('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể kết nối. Vui lòng thử lại.');
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      {/* CỘT TRÁI: SHOWCASE GIỚI THIỆU & THẺ NỔI DẪN DẮT */}
      <section className="auth-story">
        <div className="auth-story-top">
          <a className="brand" href="/" aria-label="SANDEAL trang chủ">
            <span className="brand-mark">
              S<ArrowUpRight size={18} />
            </span>
            <span>
              sandeal<span className="brand-dot">.</span>
            </span>
          </a>
          <span className="auth-story-badge">
            <Sparkles size={13} /> Nền tảng Hoàn tiền Shopee
          </span>
        </div>

        <div className="auth-story-content">
          <div className="auth-eyebrow">
            <span className="pulse-dot" />
            MUA SẮM THÔNG MINH · HOÀN TIỀN MINH BẠCH
          </div>

          <h1 className="auth-hero-title">
            Món bạn thích.
            <br />
            <span className="highlight-text">Tiền hoàn bạn mê.</span>
          </h1>

          <p className="auth-hero-desc">
            Dán link Shopee, mua sắm bình thường và nhận hoa hồng được chia lại trực tiếp vào ví. Minh bạch từng đơn hàng, an tâm từng khoản rút.
          </p>

          {/* SHOWCASE THẺ NỔI HIỆN ĐẠI (GLASSMORPHISM PREVIEW) */}
          <div className="auth-showcase-box" aria-hidden="true">
            {/* THẺ 1: TẠO LINK */}
            <div className="auth-preview-card card-link">
              <div className="preview-card-icon tone-orange">
                <LinkIcon size={18} />
              </div>
              <div className="preview-card-body">
                <span className="preview-card-tag">Bước 1 · Link riêng</span>
                <strong>Link Shopee kèm Sub ID cá nhân</strong>
                <span className="preview-card-sub">Đã tạo mã theo dõi tự động</span>
              </div>
              <span className="preview-status-pill green">
                <Check size={12} /> Hợp lệ
              </span>
            </div>

            {/* THẺ 2: ĐƠN HÀNG & TIỀN VỀ VÍ */}
            <div className="auth-preview-card card-cashback">
              <div className="preview-card-icon tone-green">
                <TrendingUp size={18} />
              </div>
              <div className="preview-card-body">
                <span className="preview-card-tag">Bước 2 · Nhận hoàn tiền</span>
                <strong>Đơn hàng Shopee thành công</strong>
                <span className="preview-card-sub">Chia sẻ 80% hoa hồng thực nhận</span>
              </div>
              <div className="preview-cash-badge">
                <span>+ 45.000 ₫</span>
              </div>
            </div>

            {/* THẺ 3: RÚT TIỀN MINH BẠCH */}
            <div className="auth-preview-card card-withdraw">
              <div className="preview-card-icon tone-blue">
                <Wallet size={18} />
              </div>
              <div className="preview-card-body">
                <span className="preview-card-tag">Bước 3 · Rút về ngân hàng</span>
                <strong>Chuyển khoản trực tiếp 100%</strong>
                <span className="preview-card-sub">Đối soát rõ ràng, không trừ phí ẩn</span>
              </div>
              <span className="preview-status-pill blue">
                <CheckCircle2 size={12} /> An toàn
              </span>
            </div>
          </div>

          <div className="auth-trust-pills">
            <span>
              <CheckCircle2 size={15} /> Tạo link miễn phí 100%
            </span>
            <span>
              <ShieldCheck size={15} /> Bảo mật tài khoản & đơn hàng
            </span>
            <span>
              <Wallet size={15} /> Rút tiền nhanh về ngân hàng
            </span>
          </div>
        </div>

        <div className="auth-story-footer">
          <span>Mua sắm như thường · Nhận lại niềm vui</span>
          <span>© 2026 SANDEAL.</span>
        </div>
      </section>

      {/* CỘT PHẢI: FORM ĐĂNG NHẬP / ĐĂNG KÝ HIỆN ĐẠI */}
      <section className="auth-form-side">
        <header className="auth-side-header">
          <div className="auth-top-badge">
            <ShieldCheck size={14} /> Không gian hoàn tiền an toàn
          </div>
        </header>

        <div className="auth-form-card">
          {/* SWITCH TABS: ĐĂNG NHẬP / TẠO TÀI KHOẢN */}
          <div className="auth-view-tabs" role="tablist" aria-label="Lựa chọn đăng nhập hoặc tạo tài khoản">
            <button
              id="login-tab"
              aria-selected={view === 'login'}
              role="tab"
              className={view === 'login' ? 'active' : ''}
              disabled={busy}
              onClick={() => change('login')}
            >
              Đăng nhập
            </button>
            <button
              id="register-tab"
              aria-selected={view === 'register'}
              role="tab"
              className={view === 'register' ? 'active' : ''}
              disabled={busy}
              onClick={() => change('register')}
            >
              Tạo tài khoản
            </button>
          </div>

          <div role="tabpanel" aria-labelledby={view === 'login' ? 'login-tab' : 'register-tab'}>
            <div className="auth-heading">
              <span className="auth-sub-badge">
                {view === 'login' ? 'CHÀO MỪNG TRỞ LẠI' : 'BẮT ĐẦU HOÀN TIỀN'}
              </span>
              <h2>{view === 'login' ? 'Đăng nhập SANDEAL' : 'Tạo tài khoản mới'}</h2>
              <p>
                {view === 'login'
                  ? 'Nhập tài khoản để theo dõi link mua sắm, đơn hàng và số dư tiền hoàn.'
                  : 'Chỉ vài bước đơn giản để nhận không gian hoàn tiền Shopee của riêng bạn.'}
              </p>
            </div>

            {/* NÚT GOOGLE */}
            {googleEnabled ? (
              <a className="google-button" href="/api/auth/google" target="_top">
                <GoogleMark />
                <span>{view === 'login' ? 'Tiếp tục với Google' : 'Đăng ký nhanh bằng Google'}</span>
                <ArrowUpRight size={16} />
              </a>
            ) : (
              <button className="google-button disabled-state" disabled title="Google OAuth đang chờ cấu hình khóa máy chủ">
                <GoogleMark />
                <span>{view === 'login' ? 'Tiếp tục với Google' : 'Đăng ký bằng Google'}</span>
                <span className="auth-tag-soon">Chờ cấu hình</span>
              </button>
            )}

            <div className="auth-divider">
              <span className="divider-line" />
              <span className="divider-label">
                {view === 'login' ? 'hoặc dùng tài khoản mật khẩu' : 'hoặc điền thông tin đăng ký'}
              </span>
              <span className="divider-line" />
            </div>

            {/* THÔNG BÁO LỖI NẾU CÓ */}
            {error && (
              <div className="auth-error-banner" role="alert">
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}

            {/* BIỂU MẪU NHẬP LIỆU */}
            <form onSubmit={submit} className="auth-main-form" noValidate={false}>
              {view === 'register' ? (
                <>
                  <div className="auth-form-grid-two">
                    <label htmlFor="auth-name" className="auth-label">
                      Họ và tên
                      <div className="auth-input-container">
                        <UserRound size={17} className="auth-field-icon" />
                        <input
                          id="auth-name"
                          autoComplete="name"
                          placeholder="Nguyễn Văn A"
                          value={name}
                          onChange={e => setName(e.target.value)}
                          minLength={2}
                          maxLength={100}
                          required
                          disabled={busy}
                        />
                      </div>
                    </label>

                    <label htmlFor="auth-email" className="auth-label">
                      Địa chỉ email
                      <div className="auth-input-container">
                        <Mail size={17} className="auth-field-icon" />
                        <input
                          id="auth-email"
                          type="email"
                          autoComplete="email"
                          placeholder="ban@email.com"
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          maxLength={254}
                          required
                          disabled={busy}
                        />
                      </div>
                    </label>
                  </div>

                  <div className="auth-form-grid-two">
                    <label htmlFor="auth-password" className="auth-label">
                      Mật khẩu
                      <div className="auth-input-container">
                        <LockKeyhole size={17} className="auth-field-icon" />
                        <input
                          id="auth-password"
                          type={show ? 'text' : 'password'}
                          autoComplete="new-password"
                          placeholder="Tối thiểu 8 ký tự"
                          value={password}
                          onChange={e => setPassword(e.target.value)}
                          minLength={8}
                          maxLength={128}
                          required
                          disabled={busy}
                        />
                        <button
                          type="button"
                          className="auth-eye-toggle"
                          aria-label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                          aria-pressed={show}
                          onClick={() => setShow(!show)}
                        >
                          {show ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </label>

                    <label htmlFor="auth-confirm" className="auth-label">
                      Nhập lại mật khẩu
                      <div className="auth-input-container">
                        <LockKeyhole size={17} className="auth-field-icon" />
                        <input
                          id="auth-confirm"
                          type={show ? 'text' : 'password'}
                          autoComplete="new-password"
                          placeholder="Khớp với mật khẩu trên"
                          value={confirm}
                          onChange={e => setConfirm(e.target.value)}
                          minLength={8}
                          maxLength={128}
                          required
                          disabled={busy}
                        />
                      </div>
                    </label>
                  </div>

                  <p className="auth-hint-text">
                    <ShieldCheck size={13} /> Mật khẩu từ 8 ký tự gồm cả chữ và số để bảo vệ ví tiền hoàn.
                  </p>
                </>
              ) : (
                <>
                  <label htmlFor="auth-email" className="auth-label">
                    Tên đăng nhập hoặc Email
                    <div className="auth-input-container">
                      <Mail size={17} className="auth-field-icon" />
                      <input
                        id="auth-email"
                        type="text"
                        autoComplete="username email"
                        placeholder="admin hoặc ban@email.com"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        maxLength={254}
                        required
                        disabled={busy}
                      />
                    </div>
                  </label>

                  <label htmlFor="auth-password" className="auth-label">
                    Mật khẩu
                    <div className="auth-input-container">
                      <LockKeyhole size={17} className="auth-field-icon" />
                      <input
                        id="auth-password"
                        type={show ? 'text' : 'password'}
                        autoComplete="current-password"
                        placeholder="Nhập mật khẩu của bạn"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        minLength={1}
                        maxLength={128}
                        required
                        disabled={busy}
                      />
                      <button
                        type="button"
                        className="auth-eye-toggle"
                        aria-label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                        aria-pressed={show}
                        onClick={() => setShow(!show)}
                      >
                        {show ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </label>
                </>
              )}

              <button className="auth-btn-primary" type="submit" disabled={busy}>
                {busy ? <Loader2 size={18} className="spin" /> : null}
                <span>{busy ? 'Đang xử lý...' : view === 'login' ? 'Đăng nhập ngay' : 'Tạo tài khoản miễn phí'}</span>
                {!busy && <ArrowRight size={17} className="btn-arrow-icon" />}
              </button>
            </form>

            <div className="auth-switch-section">
              <span>{view === 'login' ? 'Chưa có tài khoản?' : 'Đã có tài khoản trước đó?'}</span>
              <button
                type="button"
                className="auth-switch-btn"
                onClick={() => change(view === 'login' ? 'register' : 'login')}
                disabled={busy}
              >
                {view === 'login' ? 'Tạo tài khoản mới' : 'Đăng nhập ngay'}
              </button>
            </div>

            <div className="auth-info-card">
              <ShieldCheck size={18} className="info-card-icon" />
              <div>
                <strong>Bảo mật & Tự động ghi nhận</strong>
                <p>Mỗi tài khoản được cấp mã theo dõi Sub ID riêng biệt. Phiên đăng nhập được duy trì an toàn trong 7 ngày.</p>
              </div>
            </div>

            <details className="auth-details-collapsible">
              <summary>
                <span>Chính sách dữ liệu và tài khoản</span>
                <ChevronDown size={14} className="collapsible-arrow" />
              </summary>
              <p>Hệ thống chỉ lưu thông tin cần thiết để xác thực tài khoản và đối soát tiền hoàn. Mật khẩu được mã hóa PBKDF2 chuẩn bảo mật cao nhất.</p>
            </details>
          </div>
        </div>

        <footer className="auth-side-footer">
          <span>© 2026 SANDEAL · Mua sắm thông minh</span>
          <span>Hỗ trợ Shopee Affiliate</span>
        </footer>
      </section>
    </main>
  );
}
