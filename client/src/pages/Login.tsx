import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, ArrowRight, FlaskConical } from 'lucide-react';
import { api, setToken } from '../api/client';
import type { ApiResponse } from '../types';

const IS_DEV = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

const TEST_ACCOUNTS = [
  { label: 'Staff', email: 'staff@nrs.gov.ng', color: 'var(--info)', bg: 'var(--info-light)' },
  { label: 'Admin', email: 'admin@nrs.gov.ng', color: 'var(--error)', bg: 'var(--error-light)' },
  { label: 'Runner', email: 'runner@nrs.gov.ng', color: 'var(--orange)', bg: '#fff7ed' },
] as const;

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [devLoading, setDevLoading] = useState<string | null>(null);

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
    setLoading(true);
    setError('');
    try {
      await api.post<ApiResponse<null>>('/auth/magic-link', { email });
      setSent(true);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message ?? 'Failed to send magic link.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      background: '#fff',
    }}>
      {/* Left panel */}
      <div style={{
        flex: '0 0 420px',
        background: 'linear-gradient(160deg, #14532d 0%, #16a34a 60%, #4ade80 100%)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '48px',
        color: '#fff',
        position: 'relative',
        overflow: 'hidden',
      }} className="login-left">
        <div style={{
          position: 'absolute', top: -80, right: -80,
          width: 300, height: 300, borderRadius: '50%',
          background: 'rgba(255,255,255,.06)',
        }} />
        <div style={{
          position: 'absolute', bottom: -60, left: -60,
          width: 250, height: 250, borderRadius: '50%',
          background: 'rgba(255,255,255,.04)',
        }} />
        <div style={{ position: 'relative' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(255,255,255,.15)', borderRadius: 10,
            padding: '8px 14px', marginBottom: 32,
          }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80' }} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>NRS Internal</span>
          </div>
          <h1 style={{ fontSize: 38, fontWeight: 800, lineHeight: 1.1, marginBottom: 16, letterSpacing: '-0.03em' }}>
            PK Food
          </h1>
          <p style={{ fontSize: 16, opacity: .8, lineHeight: 1.6 }}>
            Order fresh meals from PK Canteen and have them delivered right to your floor.
          </p>
          <div style={{ marginTop: 48, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {['Browse the full menu', 'Checkout with Paystack', 'Track your delivery'].map((f) => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: .85 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', flexShrink: 0 }} />
                <span style={{ fontSize: 14 }}>{f}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
        background: 'var(--gray-50)',
      }}>
        <div style={{ width: '100%', maxWidth: 380 }} className="fade-up">
          {sent ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: 60, height: 60, borderRadius: '50%',
                background: 'var(--primary-light)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 20px',
              }}>
                <Mail size={26} color="var(--primary)" />
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, letterSpacing: '-0.02em' }}>Check your inbox</h2>
              <p style={{ color: 'var(--gray-500)', fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
                We sent a login link to <strong style={{ color: 'var(--gray-800)' }}>{email}</strong>.<br />
                It expires in 15 minutes.
              </p>
              <button className="btn btn-ghost" onClick={() => { setSent(false); setEmail(''); }}>
                Use a different email
              </button>
            </div>
          ) : (
            <>
              <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 6, letterSpacing: '-0.03em' }}>
                Sign in to PK Food
              </h2>
              <p style={{ color: 'var(--gray-500)', fontSize: 14, marginBottom: 28 }}>
                Enter your NRS email to receive a secure login link.
              </p>

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <label className="label" htmlFor="email">Work email</label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="you@nrs.gov.ng"
                      required
                      autoFocus
                      className={`input ${error ? 'error' : ''}`}
                      style={{ paddingLeft: 38 }}
                    />
                  </div>
                  {error && (
                    <p style={{ color: 'var(--error)', fontSize: 12, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                      {error}
                    </p>
                  )}
                </div>

                <button type="submit" disabled={loading} className="btn btn-primary btn-lg btn-full" style={{ marginTop: 4 }}>
                  {loading ? <span className="spinner" /> : <ArrowRight size={17} />}
                  {loading ? 'Sending…' : 'Send magic link'}
                </button>
              </form>

              <p style={{ marginTop: 20, color: 'var(--gray-400)', fontSize: 12, textAlign: 'center' }}>
                Only @nrs.gov.ng addresses are accepted
              </p>

              {IS_DEV && (
                <div style={{ marginTop: 28, paddingTop: 24, borderTop: '1px solid var(--gray-200)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                    <FlaskConical size={13} color="var(--gray-400)" />
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Dev — quick login</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {TEST_ACCOUNTS.map(acc => (
                      <button
                        key={acc.email}
                        type="button"
                        onClick={() => handleDevLogin(acc.email)}
                        disabled={devLoading !== null}
                        style={{
                          flex: 1, padding: '8px 4px', border: 'none', borderRadius: 'var(--radius-md)',
                          background: acc.bg, color: acc.color,
                          fontSize: 12, fontWeight: 700, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                          opacity: devLoading && devLoading !== acc.email ? 0.5 : 1,
                          transition: 'opacity 0.15s',
                        }}
                      >
                        {devLoading === acc.email
                          ? <span className="spinner" style={{ width: 11, height: 11 }} />
                          : null}
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

      <style>{`
        @media (max-width: 720px) {
          .login-left { display: none !important; }
        }
      `}</style>
    </div>
  );
}
