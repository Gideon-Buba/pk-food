import { useState } from 'react';
import { api } from '../api/client';
import type { ApiResponse } from '../types';

export default function Login() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.post<ApiResponse<null>>('/auth/magic-link', { email });
      setSent(true);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message ?? 'Failed to send magic link. Try again.');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div style={s.root}>
        <div style={s.card}>
          <div style={s.icon}>📬</div>
          <h2 style={s.heading}>Check your email</h2>
          <p style={s.sub}>We sent a login link to <strong>{email}</strong></p>
          <p style={s.sub}>It expires in 15 minutes.</p>
          <button style={s.ghost} onClick={() => setSent(false)}>Use a different email</button>
        </div>
      </div>
    );
  }

  return (
    <div style={s.root}>
      <div style={s.card}>
        <div style={s.icon}>🍽️</div>
        <h1 style={s.heading}>PK Food</h1>
        <p style={s.sub}>Order from PK Canteen — delivered to your floor</p>
        <form onSubmit={handleSubmit} style={s.form}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@nrs.gov.ng"
            required
            style={s.input}
            autoFocus
          />
          {error && <p style={s.error}>{error}</p>}
          <button type="submit" disabled={loading} style={s.btn}>
            {loading ? 'Sending…' : 'Send magic link'}
          </button>
        </form>
        <p style={{ marginTop: 16, color: '#9ca3af', fontSize: 12 }}>
          Only @nrs.gov.ng addresses are accepted.
        </p>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  root: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0fdf4' },
  card: { background: '#fff', padding: 40, borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,.1)', width: '100%', maxWidth: 400, textAlign: 'center' },
  icon: { fontSize: 48, marginBottom: 12 },
  heading: { margin: '0 0 8px', color: '#15803d', fontSize: 28, fontWeight: 700 },
  sub: { margin: '0 0 24px', color: '#6b7280', fontSize: 15 },
  form: { display: 'flex', flexDirection: 'column', gap: 12 },
  input: { padding: '12px 16px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 16, outline: 'none' },
  btn: { padding: '12px 24px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, fontSize: 16, fontWeight: 600, cursor: 'pointer' },
  ghost: { marginTop: 16, background: 'none', border: 'none', color: '#16a34a', cursor: 'pointer', fontSize: 14 },
  error: { color: '#dc2626', fontSize: 14, margin: 0 },
};
