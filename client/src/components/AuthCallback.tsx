import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, setToken } from '../api/client';
import type { ApiResponse } from '../types';

export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const called = useRef(false);

  useEffect(() => {
    // Guard against React StrictMode double-invocation — the token is
    // single-use, so a second verify call would get a 401 and log us out.
    if (called.current) return;
    called.current = true;

    const token = searchParams.get('token');
    if (!token) {
      setError('Invalid login link — no token found.');
      return;
    }

    api
      .get<ApiResponse<{ token: string }>>(`/auth/verify?token=${token}`)
      .then(({ data }) => {
        setToken(data.data.token);
        navigate('/menu', { replace: true });
      })
      .catch((err: unknown) => {
        const e = err as { response?: { data?: { message?: string } } };
        setError(e.response?.data?.message ?? 'Link expired or invalid.');
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <div style={s.container}>
        <div style={s.card}>
          <h2 style={{ color: '#dc2626' }}>Login failed</h2>
          <p>{error}</p>
          <a href="/login" style={s.link}>Try again</a>
        </div>
      </div>
    );
  }

  return (
    <div style={s.container}>
      <p>Verifying your login link…</p>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  container: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb' },
  card: { background: '#fff', padding: 32, borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,.08)', textAlign: 'center' },
  link: { color: '#16a34a', fontWeight: 600 },
};
