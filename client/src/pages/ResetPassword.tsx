import { useEffect, useRef, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Eye, EyeOff, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '../api/client';
import type { ApiResponse } from '../types';

export default function ResetPassword() {
  const [searchParams]        = useSearchParams();
  const token                 = searchParams.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [done, setDone]         = useState(false);
  const submitted               = useRef(false);

  useEffect(() => {
    if (!token) setError('No reset token found. Please use the link from your email.');
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitted.current) return;
    if (password !== confirm) { setError('Passwords do not match'); return; }
    submitted.current = true;
    setLoading(true);
    setError('');
    try {
      await api.post<ApiResponse<null>>('/auth/reset-password', { token, password });
      setDone(true);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message ?? 'Something went wrong. Please try again.');
      submitted.current = false;
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted px-4">
      <div className="w-full max-w-[400px] bg-white rounded-xl shadow-md p-8">

        {done ? (
          <div className="text-center py-4">
            <div className="w-14 h-14 rounded-full bg-primary-subtle flex items-center justify-center mx-auto mb-4">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#316752" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">Password updated</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Your password has been changed successfully. You can now sign in.
            </p>
            <Button asChild>
              <Link to="/login">Sign in <ArrowRight size={14} /></Link>
            </Button>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-semibold text-foreground mb-1">Set new password</h1>
            <p className="text-sm text-muted-foreground mb-6">Choose a strong password for your account.</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="password">New password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPw ? 'text' : 'password'}
                    placeholder="Min. 8 characters"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    minLength={8}
                    autoFocus
                    className="pr-10"
                    disabled={!token}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirm">Confirm password</Label>
                <Input
                  id="confirm"
                  type={showPw ? 'text' : 'password'}
                  placeholder="Repeat password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                  disabled={!token}
                />
              </div>

              {error && <p className="text-xs text-destructive">{error}</p>}

              <Button type="submit" className="w-full" disabled={loading || !token}>
                {loading && <span className="spinner" style={{ width: 15, height: 15 }} />}
                {loading ? 'Updating…' : 'Set new password'}
              </Button>
            </form>

            <p className="text-center mt-4">
              <Link to="/forgot-password" className="text-xs text-muted-foreground hover:text-primary transition-colors">
                Request a new link
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
