import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import type { ApiResponse } from '../types';

interface VerifyResult {
  paid: boolean;
  status: string;
}

type PageState = 'loading' | 'success' | 'failed';

export default function OrderConfirmation() {
  const [searchParams] = useSearchParams();
  const [state, setState] = useState<PageState>('loading');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  const reference = searchParams.get('reference');

  useEffect(() => {
    if (!reference) {
      setState('failed');
      setMessage('No payment reference found.');
      return;
    }

    api
      .get<ApiResponse<VerifyResult>>(`/payments/verify/${reference}`)
      .then(({ data }) => {
        if (data.data.paid) {
          setState('success');
        } else {
          setState('failed');
          setMessage(`Payment status: ${data.data.status}`);
        }
      })
      .catch((err: unknown) => {
        const e = err as { response?: { data?: { message?: string } } };
        setState('failed');
        setMessage(e.response?.data?.message ?? 'Could not verify payment.');
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state === 'loading') {
    return <div style={s.center}><p>Verifying payment…</p></div>;
  }

  if (state === 'failed') {
    return (
      <div style={s.center}>
        <div style={s.card}>
          <div style={{ fontSize: 56 }}>❌</div>
          <h2 style={{ color: '#dc2626' }}>Payment not confirmed</h2>
          <p style={{ color: '#6b7280' }}>{message}</p>
          <button style={{ ...s.btn, background: '#6b7280' }} onClick={() => navigate('/menu')}>
            Back to menu
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={s.center}>
      <div style={s.card}>
        <div style={{ fontSize: 56 }}>✅</div>
        <h2 style={{ color: '#16a34a' }}>Order confirmed!</h2>
        <p style={{ color: '#6b7280' }}>
          Your food is being prepared. We'll deliver it to your floor shortly.
        </p>
        <p style={{ color: '#9ca3af', fontSize: 13 }}>Reference: {reference}</p>
        <button style={s.btn} onClick={() => navigate('/menu')}>
          Order more food
        </button>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  center: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0fdf4', fontFamily: 'system-ui, sans-serif' },
  card: { background: '#fff', borderRadius: 16, padding: 40, boxShadow: '0 4px 24px rgba(0,0,0,.1)', textAlign: 'center', maxWidth: 420, width: '100%' },
  btn: { marginTop: 20, padding: '12px 32px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, fontSize: 16, fontWeight: 600, cursor: 'pointer' },
};
