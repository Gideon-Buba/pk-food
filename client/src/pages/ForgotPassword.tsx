import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '../api/client';
import type { ApiResponse } from '../types';

export default function ForgotPassword() {
  const [email, setEmail]     = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent]       = useState(false);
  const [error, setError]     = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.post<ApiResponse<null>>('/auth/forgot-password', { email });
      setSent(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted px-4">
      <div className="w-full max-w-[400px] bg-white rounded-xl shadow-md p-8">

        <Link to="/login" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft size={14} /> Back to sign in
        </Link>

        {sent ? (
          <div className="text-center py-4">
            <div className="w-14 h-14 rounded-full bg-primary-subtle flex items-center justify-center mx-auto mb-4">
              <Mail size={24} className="text-primary" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">Check your inbox</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              If <span className="font-medium text-foreground">{email}</span> is registered and verified,
              you'll receive a password reset link shortly. It expires in 60 minutes.
            </p>
            <p className="text-xs text-muted-foreground mt-4">Didn't get it? Check your spam folder.</p>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-semibold text-foreground mb-1">Forgot password?</h1>
            <p className="text-sm text-muted-foreground mb-6">
              Enter your work email and we'll send you a reset link.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Work email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@nrs.gov.ng"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              {error && <p className="text-xs text-destructive">{error}</p>}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <span className="spinner" style={{ width: 15, height: 15 }} />}
                {loading ? 'Sending…' : 'Send reset link'}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
