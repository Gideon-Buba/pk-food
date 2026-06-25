import { useEffect, useRef, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api } from '../api/client';
import type { ApiResponse } from '../types';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const called = useRef(false);

  useEffect(() => {
    if (called.current) return;
    called.current = true;

    const token = searchParams.get('token');
    if (!token) { setStatus('error'); setMessage('No verification token found.'); return; }

    api.get<ApiResponse<null>>(`/auth/verify-email?token=${token}`)
      .then(() => setStatus('success'))
      .catch((err: unknown) => {
        const e = err as { response?: { data?: { message?: string } } };
        setStatus('error');
        setMessage(e.response?.data?.message ?? 'Link expired or invalid.');
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--gray-50)' }}>
      <div style={{ background: '#fff', padding: 40, borderRadius: 16, boxShadow: 'var(--shadow-md)', textAlign: 'center', maxWidth: 400, width: '100%' }}>
        {status === 'loading' && (
          <>
            <span className="spinner spinner-primary" style={{ width: 28, height: 28, margin: '0 auto 16px' }} />
            <p style={{ color: 'var(--gray-500)', fontSize: 14 }}>Verifying your email…</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: 'var(--gray-900)' }}>Email verified</h2>
            <p style={{ color: 'var(--gray-500)', fontSize: 14, marginBottom: 24 }}>Your account is active. You can now sign in.</p>
            <Link to="/login" className="btn btn-primary">Sign in</Link>
          </>
        )}
        {status === 'error' && (
          <>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--error-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--error)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: 'var(--gray-900)' }}>Verification failed</h2>
            <p style={{ color: 'var(--gray-500)', fontSize: 14, marginBottom: 24 }}>{message}</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <Link to="/login" className="btn btn-secondary">Back to login</Link>
              <Link to="/login?resend=1" className="btn btn-primary">Resend link</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
