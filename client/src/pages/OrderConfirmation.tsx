import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, XCircle, ClipboardList, UtensilsCrossed } from 'lucide-react';
import { api } from '../api/client';
import type { ApiResponse } from '../types';

type State = 'loading' | 'success' | 'failed';

interface VerifyResult { paid: boolean; status: string; }

export default function OrderConfirmation() {
  const [searchParams] = useSearchParams();
  const [state, setState] = useState<State>('loading');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();
  const reference = searchParams.get('reference');

  useEffect(() => {
    if (!reference) { setState('failed'); setMessage('No payment reference found.'); return; }

    const verify = async (attempt: number): Promise<void> => {
      try {
        const { data } = await api.get<ApiResponse<VerifyResult>>(`/payments/verify/${reference}`);
        if (data.data.paid) {
          setState('success');
        } else if (attempt < 4 && data.data.status === 'pending') {
          // Paystack redirects before their API reflects success — retry with backoff
          await new Promise(r => setTimeout(r, attempt * 1500));
          return verify(attempt + 1);
        } else {
          setState('failed');
          setMessage(`Payment status: ${data.data.status}`);
        }
      } catch (err: unknown) {
        const e = err as { response?: { data?: { message?: string } } };
        setState('failed');
        setMessage(e.response?.data?.message ?? 'Could not verify payment.');
      }
    };

    verify(1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state === 'loading') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--gray-50)' }}>
        <div style={{ textAlign: 'center' }}>
          <span className="spinner spinner-primary" style={{ width: 32, height: 32, margin: '0 auto 16px' }} />
          <p style={{ color: 'var(--gray-500)', fontSize: 14 }}>Verifying your payment…</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--gray-50)', padding: 24 }}>
      <div className="card fade-up" style={{ padding: 40, maxWidth: 420, width: '100%', textAlign: 'center' }}>
        {state === 'success' ? (
          <>
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <CheckCircle size={36} color="var(--primary)" />
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8, letterSpacing: '-0.03em' }}>Order confirmed!</h2>
            <p style={{ color: 'var(--gray-500)', fontSize: 14, lineHeight: 1.6, marginBottom: 6 }}>
              Your order is being prepared. A runner will deliver it to your floor shortly.
            </p>
            <p style={{ color: 'var(--gray-400)', fontSize: 12, fontFamily: 'monospace', marginBottom: 28 }}>Ref: {reference}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button className="btn btn-primary btn-full" onClick={() => navigate('/orders')}>
                <ClipboardList size={15} />
                Track my order
              </button>
              <button className="btn btn-secondary btn-full" onClick={() => navigate('/menu')}>
                <UtensilsCrossed size={15} />
                Back to menu
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--error-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <XCircle size={36} color="var(--error)" />
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8, letterSpacing: '-0.03em' }}>Payment not confirmed</h2>
            <p style={{ color: 'var(--gray-500)', fontSize: 14, marginBottom: 28 }}>{message}</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button className="btn btn-secondary" onClick={() => navigate('/cart')}>Back to cart</button>
              <button className="btn btn-primary" onClick={() => navigate('/menu')}>Browse menu</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
