import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, ArrowRight, FlaskConical, Eye, EyeOff, UserPlus } from 'lucide-react';
import { api, setToken } from '../api/client';
import type { ApiResponse } from '../types';

const IS_DEV = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

const TEST_ACCOUNTS = [
  { label: 'Staff', email: 'staff@nrs.gov.ng', color: 'var(--info)', bg: 'var(--info-light)' },
  { label: 'Admin', email: 'admin@nrs.gov.ng', color: 'var(--error)', bg: 'var(--error-light)' },
  { label: 'Runner', email: 'runner@nrs.gov.ng', color: 'var(--orange)', bg: '#fff7ed' },
] as const;

type Mode = 'login' | 'register';

export default function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [devLoading, setDevLoading] = useState<string | null>(null);

  const switchMode = (m: Mode) => { setMode(m); setError(''); setPassword(''); setConfirm(''); };

  const handleDevLogin = async (devEmail: string) => {
    setDevLoading(devEmail);
    try {
      const { data } = await api.post<ApiResponse<{ token: string }>>(`/auth/dev-token/${devEmail}`);
      setToken(data.data.token);
      navigate('/menu');
    } catch {
      setError('Dev login failed — did you run prisma:seed?');
    } finally {
      setDevLoading(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (mode === 'register' && password !== confirm) { setError('Passwords do not match'); return; }
    setLoading(true);
    try {
      if (mode === 'login') {
        const { data } = await api.post<ApiResponse<{ token: string }>>('/auth/login', { email, password });
        setToken(data.data.token);
        navigate('/menu');
      } else {
        await api.post('/auth/register', { email, password });
        setRegistered(true);
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message ?? (mode === 'login' ? 'Invalid email or password' : 'Registration failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: '#fff' }}>
      {/* Left panel */}
      <div style={{
        flex: '0 0 420px',
        background: 'linear-gradient(160deg, #1a3830 0%, #316752 60%, #4e9a7e 100%)',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '48px', color: '#fff', position: 'relative', overflow: 'hidden',
      }} className="login-left">
        <div style={{ position: 'absolute', top: -80, right: -80, width: 300, height: 300, borderRadius: '50%', background: 'rgba(255,255,255,.06)' }} />
        <div style={{ position: 'absolute', bottom: -60, left: -60, width: 250, height: 250, borderRadius: '50%', background: 'rgba(255,255,255,.04)' }} />
        <div style={{ position: 'relative' }}>
          <div style={{ marginBottom: 32 }}>
            <img src="/logo.jpeg" alt="PK Limited"
              style={{ height: 120, width: 'auto', filter: 'brightness(0) invert(1)', opacity: 0.95 }}
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          </div>
          <h1 style={{ fontSize: 42, fontWeight: 300, lineHeight: 1.1, marginBottom: 16, letterSpacing: '0.04em', fontFamily: 'var(--font-heading)' }}>
            PK Food
          </h1>
          <p style={{ fontSize: 15, opacity: .8, lineHeight: 1.7, fontFamily: 'var(--font-ui)' }}>
            Order fresh meals from PK Canteen and have them delivered right to your floor.
          </p>
          <div style={{ marginTop: 48, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {['Browse the full menu', 'Checkout with Paystack', 'Track your delivery'].map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: .85 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4e9a7e', flexShrink: 0 }} />
                <span style={{ fontSize: 14 }}>{f}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', background: 'var(--gray-50)' }}>
        <div style={{ width: '100%', maxWidth: 380 }} className="fade-up">

          {registered ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <Mail size={24} color="var(--primary)" />
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Check your inbox</h2>
              <p style={{ color: 'var(--gray-500)', fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
                We sent a verification link to <strong style={{ color: 'var(--gray-800)' }}>{email}</strong>.<br />
                Click it to activate your account, then log in here.
              </p>
              <button className="btn btn-ghost" onClick={() => { setRegistered(false); switchMode('login'); }}>
                Back to sign in
              </button>
            </div>
          ) : (
            <>
              {/* Mode toggle */}
              <div style={{ display: 'flex', background: 'var(--gray-200)', borderRadius: 'var(--radius-md)', padding: 3, marginBottom: 28 }}>
                {(['login', 'register'] as Mode[]).map(m => (
                  <button key={m} onClick={() => switchMode(m)} style={{
                    flex: 1, padding: '8px 0', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                    borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-ui)', transition: 'all 0.15s',
                    background: mode === m ? '#fff' : 'transparent',
                    color: mode === m ? 'var(--gray-900)' : 'var(--gray-500)',
                    boxShadow: mode === m ? 'var(--shadow-xs)' : 'none',
                  }}>
                    {m === 'login' ? 'Sign in' : 'Create account'}
                  </button>
                ))}
              </div>

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <label className="label" htmlFor="email">Work email</label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
                    <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                      placeholder="you@nrs.gov.ng" required autoFocus
                      className={`input ${error ? 'error' : ''}`} style={{ paddingLeft: 36 }} />
                  </div>
                </div>

                <div className="form-group">
                  <label className="label" htmlFor="password">Password</label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
                    <input id="password" type={showPw ? 'text' : 'password'} value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder={mode === 'register' ? 'Min. 8 characters' : 'Your password'}
                      required minLength={mode === 'register' ? 8 : undefined}
                      className={`input ${error ? 'error' : ''}`} style={{ paddingLeft: 36, paddingRight: 38 }} />
                    <button type="button" onClick={() => setShowPw(v => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)', display: 'flex' }}>
                      {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {mode === 'register' && (
                  <div className="form-group">
                    <label className="label" htmlFor="confirm">Confirm password</label>
                    <div style={{ position: 'relative' }}>
                      <Lock size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
                      <input id="confirm" type={showPw ? 'text' : 'password'} value={confirm}
                        onChange={e => setConfirm(e.target.value)} placeholder="Repeat password" required
                        className={`input ${error?.includes('match') ? 'error' : ''}`} style={{ paddingLeft: 36 }} />
                    </div>
                  </div>
                )}

                {error && <p style={{ color: 'var(--error)', fontSize: 12, marginTop: -4 }}>{error}</p>}

                <button type="submit" disabled={loading} className="btn btn-primary btn-lg btn-full" style={{ marginTop: 2 }}>
                  {loading
                    ? <span className="spinner" />
                    : mode === 'login' ? <ArrowRight size={17} /> : <UserPlus size={17} />}
                  {loading
                    ? (mode === 'login' ? 'Signing in…' : 'Creating account…')
                    : mode === 'login' ? 'Sign in' : 'Create account'}
                </button>
              </form>

              <p style={{ marginTop: 16, color: 'var(--gray-400)', fontSize: 12, textAlign: 'center' }}>
                Only @nrs.gov.ng addresses are accepted
              </p>

              {IS_DEV && (
                <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--gray-200)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                    <FlaskConical size={13} color="var(--gray-400)" />
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Dev — quick login</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {TEST_ACCOUNTS.map(acc => (
                      <button key={acc.email} type="button" onClick={() => handleDevLogin(acc.email)} disabled={devLoading !== null}
                        style={{
                          flex: 1, padding: '8px 4px', border: 'none', borderRadius: 'var(--radius-md)',
                          background: acc.bg, color: acc.color, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                          opacity: devLoading && devLoading !== acc.email ? 0.5 : 1, transition: 'opacity 0.15s',
                        }}>
                        {devLoading === acc.email ? <span className="spinner" style={{ width: 11, height: 11 }} /> : null}
                        {acc.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <style>{`@media (max-width: 720px) { .login-left { display: none !important; } }`}</style>
    </div>
  );
}
