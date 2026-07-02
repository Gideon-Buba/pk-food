import { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import { Eye, EyeOff, ArrowRight, FlaskConical, UserPlus, Mail } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { api, setToken } from '../api/client';
import { useCartStore } from '../store/cart';
import type { ApiResponse } from '../types';

interface JwtPayload { role: string; }

function roleHome(token: string): string {
  try {
    const { role } = jwtDecode<JwtPayload>(token);
    if (role === 'ADMIN')  return '/admin';
    if (role === 'RUNNER') return '/runner';
  } catch { /* fall through */ }
  return '/menu';
}

const IS_DEV = ['localhost', '127.0.0.1'].includes(window.location.hostname);

const TEST_ACCOUNTS = [
  { label: 'Staff',  email: 'staff@nrs.gov.ng',  tw: 'bg-blue-50 text-blue-700 hover:bg-blue-100' },
  { label: 'Admin',  email: 'admin@nrs.gov.ng',  tw: 'bg-red-50 text-red-700 hover:bg-red-100' },
  { label: 'Runner', email: 'runner@nrs.gov.ng', tw: 'bg-orange-50 text-orange-700 hover:bg-orange-100' },
] as const;

const CANTEEN_PHOTOS = [
  '/canteen.webp',
  '/canteen-2.webp',
  '/canteen-3.webp',
  '/canteen-4.webp',
  '/canteen-5.webp',
];

type Mode = 'login' | 'register';

export default function Login() {
  const navigate  = useNavigate();
  const clearCart = useCartStore(s => s.clearCart);
  const [mode, setMode]         = useState<Mode>('login');
  const [email, setEmail]       = useState('');
  const [name, setName]         = useState('');
  const [phone, setPhone]       = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [registered, setRegistered] = useState(false);
  const [resending, setResending]   = useState(false);
  const [resendDone, setResendDone] = useState(false);
  const [devLoading, setDevLoading] = useState<string | null>(null);

  const [photoIdx, setPhotoIdx] = useState(0);
  const slideTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    slideTimer.current = setInterval(() => setPhotoIdx(i => (i + 1) % CANTEEN_PHOTOS.length), 5000);
    return () => { if (slideTimer.current) clearInterval(slideTimer.current); };
  }, []);

  const goToPhoto = (i: number) => {
    if (slideTimer.current) clearInterval(slideTimer.current);
    setPhotoIdx(i);
    slideTimer.current = setInterval(() => setPhotoIdx(idx => (idx + 1) % CANTEEN_PHOTOS.length), 5000);
  };

  const switchMode = (m: Mode) => { setMode(m); setError(''); setConfirm(''); setName(''); setPhone(''); };

  const handleResend = async () => {
    setResending(true);
    try {
      await api.post('/auth/resend-verification', { email });
      setResendDone(true);
    } catch {
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
        clearCart();
        setToken(data.data.token);
        navigate(roleHome(data.data.token));
      } else {
        await api.post('/auth/register', { email, password, name, phone: phone ? `+234${phone}` : undefined });
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
      clearCart();
      setToken(data.data.token);
      navigate(roleHome(data.data.token));
    } catch {
      toast.error('Dev login failed — did you run prisma:seed?');
    } finally {
      setDevLoading(null);
    }
  };

  return (
    <div className="flex" style={{ height: '100dvh', overflow: 'hidden', background: '#0a1c14' }}>

      {/* ── Mobile-only: full-screen rotating photo background ── */}
      <div className="login-mobile-bg">
        {CANTEEN_PHOTOS.map((src, i) => (
          <div key={src} style={{
            position: 'absolute', inset: 0,
            backgroundImage: `url(${src})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center 35%',
            opacity: i === photoIdx ? 1 : 0,
            transition: 'opacity 1.2s ease',
          }} />
        ))}
        {/* Gradient overlay — darker at bottom for legibility */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to bottom, rgba(10,28,20,0.52) 0%, rgba(10,28,20,0.45) 40%, rgba(10,28,20,0.72) 100%)',
        }} />
      </div>

      {/* ── LEFT: Form panel (full-width on mobile, ~half on desktop) ── */}
      <div
        className="flex-1 flex flex-col justify-between lg:justify-center relative z-10 lg:bg-white"
        style={{ padding: '48px 24px 36px', overflowY: 'auto', height: '100%' }}
      >

        {/* Mobile hero — above card, hidden on desktop */}
        <div className="lg:hidden mb-6">
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 18 }}>
            <img src="/logo.jpeg" alt="PK Food" style={{ height: 30, width: 'auto', borderRadius: 6 }}
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', fontFamily: 'var(--font-ui)' }}>
              PK Food · NRS HQ
            </span>
          </div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 40, fontWeight: 300, color: '#fff', lineHeight: 1.08, marginBottom: 10 }}>
            Stay at<br /><span style={{ fontWeight: 600 }}>your desk.</span>
          </h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 1.65, fontFamily: 'var(--font-ui)', maxWidth: 300 }}>
            Order from PK Canteen without leaving your floor.
          </p>
        </div>

        {/* ── Form card (glass on mobile, plain on desktop) ── */}
        <div className="login-form-card lg:max-w-[380px]">

          {/* Desktop logo — inside card, hidden on mobile */}
          <div className="hidden lg:block mb-8">
            <img src="/logo.jpeg" alt="PK Food" style={{ height: 36, width: 'auto', borderRadius: 6, marginBottom: 10 }}
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            <span className="text-xs font-bold tracking-[0.2em] uppercase text-primary">PK Food · NRS HQ</span>
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
                <button type="button" onClick={handleResend} disabled={resending}
                  className="text-sm text-muted-foreground hover:text-primary transition-colors mb-4 flex items-center gap-1.5 mx-auto">
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
                  {isRegister ? 'Create account' : 'Sign in'}
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {isRegister ? 'Join with your NRS work email' : 'Use your NRS work email to continue'}
                </p>
              </div>

              {/* Mode toggle */}
              <div className="relative flex bg-muted rounded-lg p-1 mb-6" style={{ isolation: 'isolate' }}>
                <div style={{
                  position: 'absolute', top: 4, bottom: 4,
                  left: isRegister ? '50%' : 4,
                  width: 'calc(50% - 4px)',
                  borderRadius: 6, background: '#fff',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.10), 0 1px 2px rgba(0,0,0,0.06)',
                  transition: 'left 0.22s cubic-bezier(0.4, 0, 0.2, 1)', zIndex: 0,
                }} />
                <button type="button" onClick={() => switchMode('login')}
                  style={{ position: 'relative', zIndex: 1, transition: 'color 0.18s ease' }}
                  className={`flex-1 py-2 text-sm rounded-md ${!isRegister ? 'text-foreground font-semibold' : 'text-muted-foreground font-medium'}`}>
                  Sign in
                </button>
                <button type="button" onClick={() => switchMode('register')}
                  style={{ position: 'relative', zIndex: 1, transition: 'color 0.18s ease' }}
                  className={`flex-1 py-2 text-sm rounded-md ${isRegister ? 'text-foreground font-semibold' : 'text-muted-foreground font-medium'}`}>
                  Create account
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">

                {/* Full name — register only */}
                <div style={{ display: 'grid', gridTemplateRows: isRegister ? '1fr' : '0fr', transition: 'grid-template-rows 0.25s ease' }}>
                  <div style={{ overflow: 'hidden' }}>
                    <div className="space-y-1.5 pb-0.5">
                      <Label htmlFor="name">Full name</Label>
                      <Input id="name" type="text" placeholder="e.g. John Doe"
                        value={name} onChange={e => setName(e.target.value)}
                        required={isRegister} tabIndex={isRegister ? 0 : -1} />
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="email">Work email</Label>
                  <Input id="email" type="email" placeholder="john.doe@nrs.gov.ng"
                    value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    {!isRegister && (
                      <Link to="/forgot-password" className="text-xs text-muted-foreground hover:text-primary transition-colors">
                        Forgot password?
                      </Link>
                    )}
                  </div>
                  <div className="relative">
                    <Input id="password" type={showPw ? 'text' : 'password'}
                      placeholder={isRegister ? 'Min. 8 characters' : 'Your password'}
                      value={password} onChange={e => setPassword(e.target.value)}
                      required minLength={isRegister ? 8 : undefined} className="pr-10" />
                    <button type="button" onClick={() => setShowPw(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                      {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {/* Confirm password — register only */}
                <div style={{ display: 'grid', gridTemplateRows: isRegister ? '1fr' : '0fr', transition: 'grid-template-rows 0.25s ease' }}>
                  <div style={{ overflow: 'hidden' }}>
                    <div className="space-y-1.5 pb-0.5">
                      <Label htmlFor="confirm">Confirm password</Label>
                      <Input id="confirm" type={showPw ? 'text' : 'password'} placeholder="Repeat password"
                        value={confirm} onChange={e => setConfirm(e.target.value)}
                        required={isRegister} tabIndex={isRegister ? 0 : -1} />
                    </div>
                  </div>
                </div>

                {/* Phone — register only */}
                <div style={{ display: 'grid', gridTemplateRows: isRegister ? '1fr' : '0fr', transition: 'grid-template-rows 0.25s ease' }}>
                  <div style={{ overflow: 'hidden' }}>
                    <div className="space-y-1.5 pb-0.5">
                      <Label htmlFor="phone">
                        Phone <span className="text-muted-foreground font-normal text-xs">(optional)</span>
                      </Label>
                      <div className="flex">
                        <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-input bg-muted text-sm text-muted-foreground select-none">
                          +234
                        </span>
                        <Input id="phone" type="tel" placeholder="8012345678"
                          value={phone}
                          onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                          tabIndex={isRegister ? 0 : -1} className="rounded-l-none" maxLength={10} />
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ minHeight: 20 }}>
                  {error && <p className="text-xs text-destructive">{error}</p>}
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <span className="spinner" style={{ width: 15, height: 15 }} /> : isRegister ? <UserPlus size={15} /> : <ArrowRight size={15} />}
                  {loading ? (isRegister ? 'Creating account…' : 'Signing in…') : isRegister ? 'Create account' : 'Sign in'}
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
                      <button key={acc.email} type="button" onClick={() => handleDevLogin(acc.email)}
                        disabled={devLoading !== null}
                        className={`flex-1 py-2 rounded-md text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 ${acc.tw}`}>
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

        {/* Mobile: photo dots — below card, hidden on desktop */}
        <div className="lg:hidden flex items-center justify-center gap-2 mt-8">
          {CANTEEN_PHOTOS.map((_, i) => (
            <button
              key={i}
              onClick={() => goToPhoto(i)}
              style={{
                width: i === photoIdx ? 22 : 6,
                height: 6, borderRadius: 3,
                border: 'none', cursor: 'pointer', padding: 0,
                background: i === photoIdx ? '#fff' : 'rgba(255,255,255,0.35)',
                transition: 'all 0.35s ease',
              }}
            />
          ))}
        </div>
      </div>

      {/* ── RIGHT: Canteen photo panel (desktop only) ── */}
      <div className="hidden lg:block" style={{ width: 520, position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
        {CANTEEN_PHOTOS.map((src, i) => (
          <div key={src} style={{
            position: 'absolute', inset: 0,
            backgroundImage: `url(${src})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center 35%',
            opacity: i === photoIdx ? 1 : 0,
            transition: 'opacity 1.2s ease',
          }} />
        ))}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to top, rgba(10,28,20,0.96) 0%, rgba(10,28,20,0.55) 45%, rgba(10,28,20,0.2) 100%)',
        }} />
        <div style={{ position: 'relative', zIndex: 1, height: '100%', display: 'flex', flexDirection: 'column', padding: '40px 48px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)',
            borderRadius: 10, padding: '8px 14px', alignSelf: 'flex-start',
          }}>
            <img src="/logo.jpeg" alt="PK" style={{ height: 28, width: 'auto', borderRadius: 4 }}
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            <span style={{ color: '#fff', fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-ui)', letterSpacing: '0.04em' }}>PK Food</span>
          </div>
          <div style={{ flex: 1 }} />
          <div>
            <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 46, fontWeight: 300, color: '#fff', lineHeight: 1.1, letterSpacing: '0.01em', marginBottom: 18 }}>
              Stay at<br /><span style={{ fontWeight: 600 }}>your desk.</span>
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 15, lineHeight: 1.75, fontFamily: 'var(--font-ui)', maxWidth: 360 }}>
              PK Canteen is right here in the building — and now it comes to you. No more leaving your floor, no queue, no wasted time. Order in seconds, eat where you work.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 32 }}>
              {CANTEEN_PHOTOS.map((_, i) => (
                <button key={i} onClick={() => goToPhoto(i)} style={{
                  width: i === photoIdx ? 24 : 6, height: 6,
                  borderRadius: 3, border: 'none', cursor: 'pointer', padding: 0,
                  background: i === photoIdx ? '#fff' : 'rgba(255,255,255,0.3)',
                  transition: 'all 0.35s ease',
                }} />
              ))}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
