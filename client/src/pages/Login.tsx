import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, ArrowRight, FlaskConical, UserPlus, Mail } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { api, setToken } from '../api/client';
import type { ApiResponse } from '../types';

const IS_DEV = ['localhost', '127.0.0.1'].includes(window.location.hostname);

const TEST_ACCOUNTS = [
  { label: 'Staff',  email: 'staff@nrs.gov.ng',  tw: 'bg-blue-50 text-blue-700 hover:bg-blue-100' },
  { label: 'Admin',  email: 'admin@nrs.gov.ng',  tw: 'bg-red-50 text-red-700 hover:bg-red-100' },
  { label: 'Runner', email: 'runner@nrs.gov.ng', tw: 'bg-orange-50 text-orange-700 hover:bg-orange-100' },
] as const;

const FEATURES = [
  'Browse the full daily menu',
  'Pay seamlessly with Paystack',
  'Track your delivery in real time',
];

type Mode = 'login' | 'register';

export default function Login() {
  const navigate  = useNavigate();
  const [mode, setMode]         = useState<Mode>('login');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [registered, setRegistered] = useState(false);
  const [resending, setResending]   = useState(false);
  const [resendDone, setResendDone] = useState(false);
  const [devLoading, setDevLoading] = useState<string | null>(null);

  const switchMode = (m: Mode) => { setMode(m); setError(''); setConfirm(''); };

  const handleResend = async () => {
    setResending(true);
    try {
      await api.post('/auth/resend-verification', { email });
      setResendDone(true);
    } catch {
      // Silently ignore — server never reveals account status
      setResendDone(true);
    } finally {
      setResending(false);
    }
  };
  const isRegister = mode === 'register';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (isRegister && password !== confirm) { setError('Passwords do not match'); return; }
    setLoading(true);
    try {
      if (!isRegister) {
        const { data } = await api.post<ApiResponse<{ token: string }>>('/auth/login', { email, password });
        setToken(data.data.token);
        navigate('/menu');
      } else {
        await api.post('/auth/register', { email, password });
        setRegistered(true);
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message ?? (!isRegister ? 'Invalid email or password' : 'Registration failed'));
    } finally {
      setLoading(false);
    }
  };

  const handleDevLogin = async (devEmail: string) => {
    setDevLoading(devEmail);
    try {
      const { data } = await api.post<ApiResponse<{ token: string }>>(`/auth/dev-token/${devEmail}`);
      setToken(data.data.token);
      navigate('/menu');
    } catch {
      toast.error('Dev login failed — did you run prisma:seed?');
    } finally {
      setDevLoading(null);
    }
  };

  return (
    <div className="min-h-screen flex">

      {/* ── LEFT: Form panel ─────────────────────────── */}
      <div className="flex-1 flex flex-col justify-center px-8 py-12 bg-white">
        <div className="w-full max-w-[380px] mx-auto">

          <div className="mb-8">
            <span className="text-xs font-bold tracking-[0.2em] uppercase text-primary">PK Food</span>
          </div>

          {registered ? (
            <div className="text-center py-8">
              <div className="w-14 h-14 rounded-full bg-primary-subtle flex items-center justify-center mx-auto mb-5">
                <Mail size={24} className="text-primary" />
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">Check your inbox</h2>
              <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                We sent a verification link to <span className="font-medium text-foreground">{email}</span>.
                Click it to activate your account.
              </p>
              {resendDone ? (
                <p className="text-sm text-primary font-medium mb-4">New link sent — check your inbox.</p>
              ) : (
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resending}
                  className="text-sm text-muted-foreground hover:text-primary transition-colors mb-4 flex items-center gap-1.5 mx-auto"
                >
                  {resending && <span className="spinner" style={{ width: 12, height: 12 }} />}
                  {resending ? 'Sending…' : "Didn't receive it? Resend"}
                </button>
              )}
              <Button variant="outline" onClick={() => { setRegistered(false); setPassword(''); setConfirm(''); setResendDone(false); switchMode('login'); }}>
                Back to sign in
              </Button>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h1 className="text-2xl font-semibold text-foreground">
                  {isRegister ? 'Create account' : 'Welcome back'}
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {isRegister ? 'Join PK Food with your NRS email' : 'Sign in to your NRS account'}
                </p>
              </div>

              {/* Mode toggle — sliding blob */}
              <div className="relative flex bg-muted rounded-lg p-1 mb-6" style={{ isolation: 'isolate' }}>
                {/* blob */}
                <div style={{
                  position: 'absolute',
                  top: 4, bottom: 4,
                  left: isRegister ? '50%' : 4,
                  width: 'calc(50% - 4px)',
                  borderRadius: 6,
                  background: '#fff',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.10), 0 1px 2px rgba(0,0,0,0.06)',
                  transition: 'left 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
                  zIndex: 0,
                }} />
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  style={{ position: 'relative', zIndex: 1, transition: 'color 0.2s ease' }}
                  className={`flex-1 py-2 text-sm font-medium rounded-md ${!isRegister ? 'text-foreground' : 'text-muted-foreground'}`}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={() => switchMode('register')}
                  style={{ position: 'relative', zIndex: 1, transition: 'color 0.2s ease' }}
                  className={`flex-1 py-2 text-sm font-medium rounded-md ${isRegister ? 'text-foreground' : 'text-muted-foreground'}`}
                >
                  Create account
                </button>
              </div>

              {/* Single form — confirm field animates in/out, button stays put */}
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

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <Link to="/forgot-password" className="text-xs text-muted-foreground hover:text-primary transition-colors">
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPw ? 'text' : 'password'}
                      placeholder={isRegister ? 'Min. 8 characters' : 'Your password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      minLength={isRegister ? 8 : undefined}
                      className="pr-10"
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

                {/* Confirm password — slides in/out without moving button */}
                <div style={{
                  display: 'grid',
                  gridTemplateRows: isRegister ? '1fr' : '0fr',
                  transition: 'grid-template-rows 0.25s ease',
                }}>
                  <div style={{ overflow: 'hidden' }}>
                    <div className="space-y-1.5 pb-0.5">
                      <Label htmlFor="confirm">Confirm password</Label>
                      <Input
                        id="confirm"
                        type={showPw ? 'text' : 'password'}
                        placeholder="Repeat password"
                        value={confirm}
                        onChange={e => setConfirm(e.target.value)}
                        required={isRegister}
                        tabIndex={isRegister ? 0 : -1}
                      />
                    </div>
                  </div>
                </div>

                {/* Error — fixed height slot so button doesn't jump */}
                <div style={{ minHeight: 20 }}>
                  {error && <p className="text-xs text-destructive">{error}</p>}
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading
                    ? <span className="spinner" style={{ width: 15, height: 15 }} />
                    : isRegister ? <UserPlus size={15} /> : <ArrowRight size={15} />}
                  {loading
                    ? (isRegister ? 'Creating account…' : 'Signing in…')
                    : isRegister ? 'Create account' : 'Sign in'}
                </Button>
              </form>

              <p className="text-xs text-muted-foreground text-center mt-4">
                Only @nrs.gov.ng addresses are accepted
              </p>

              {IS_DEV && (
                <div className="mt-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Separator className="flex-1" />
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium px-1">
                      <FlaskConical size={11} /> Dev
                    </span>
                    <Separator className="flex-1" />
                  </div>
                  <div className="flex gap-2">
                    {TEST_ACCOUNTS.map(acc => (
                      <button
                        key={acc.email}
                        type="button"
                        onClick={() => handleDevLogin(acc.email)}
                        disabled={devLoading !== null}
                        className={`flex-1 py-2 rounded-md text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 ${acc.tw}`}
                      >
                        {devLoading === acc.email && <span className="spinner" style={{ width: 10, height: 10 }} />}
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

      {/* ── RIGHT: Brand panel ───────────────────────── */}
      <div className="hidden lg:flex w-[480px] bg-primary-darker flex-col justify-center p-14 relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-64 h-64 rounded-full bg-white/[0.03] pointer-events-none" />

        <div className="relative">
          <div className="mb-10 inline-block bg-white/10 rounded-xl p-4">
            <img
              src="/logo.jpeg"
              alt="PK Limited"
              style={{ height: 72, width: 'auto', mixBlendMode: 'screen' }}
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          </div>

          <h1
            className="text-5xl font-light text-white mb-4 leading-tight"
            style={{ fontFamily: 'var(--font-heading)', letterSpacing: '0.04em' }}
          >
            PK Food
          </h1>
          <p className="text-white/70 text-[15px] leading-relaxed mb-10" style={{ fontFamily: 'var(--font-ui)' }}>
            Order fresh meals from PK Canteen and have them delivered right to your floor — no queues, no hassle.
          </p>

          <ul className="space-y-4">
            {FEATURES.map(f => (
              <li key={f} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0">
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M2 5l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <span className="text-white/80 text-sm">{f}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

    </div>
  );
}
