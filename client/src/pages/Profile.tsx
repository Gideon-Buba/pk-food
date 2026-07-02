import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, Lock, Phone, User as UserIcon, ClipboardList, LogOut, ChevronRight } from 'lucide-react';
import { clearToken } from '../api/client';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '../api/client';
import { FLOORS } from '../constants/floors';
import type { FloorValue } from '../constants/floors';
import type { ApiResponse, User } from '../types';

export default function Profile() {
  const navigate = useNavigate();
  const [user, setUser]     = useState<User | null>(null);
  const [name, setName]           = useState('');
  const [phone, setPhone]         = useState('');
  const [floor, setFloor]         = useState<FloorValue | ''>('');
  const [officeNumber, setOffice] = useState('');
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);

  useEffect(() => {
    api.get<ApiResponse<User>>('/auth/me')
      .then(r => {
        const u = r.data.data;
        setUser(u);
        setName(u.name ?? '');
        setPhone(u.phone ? u.phone.replace(/^\+234/, '') : '');
        setFloor((u.floor as FloorValue | undefined) ?? '');
        setOffice(u.officeNumber ?? '');
      })
      .catch(() => toast.error('Could not load profile'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch('/auth/profile', {
        name,
        phone: phone ? `+234${phone}` : undefined,
        floor: floor || undefined,
        officeNumber: officeNumber || undefined,
      });
      toast.success('Profile saved');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e.response?.data?.message ?? 'Could not save profile');
    } finally {
      setSaving(false);
    }
  };

  const initials = name
    ? name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() ?? '?';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--gray-50)' }}>
      {/* Header */}
      <header className="app-header">
        <div className="app-header-inner">
          <button
            className="btn btn-ghost btn-icon"
            onClick={() => navigate(-1)}
            style={{ color: 'var(--gray-600)' }}
          >
            <ArrowLeft size={18} />
          </button>
          <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--gray-900)' }}>Profile</span>
        </div>
      </header>

      <div className="page-wrap" style={{ maxWidth: 560 }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 32 }}>
            <div className="skeleton" style={{ height: 80, borderRadius: '50%', width: 80, margin: '0 auto' }} />
            <div className="skeleton" style={{ height: 200, borderRadius: 14 }} />
          </div>
        ) : (
          <>
            {/* Avatar */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 32, paddingBottom: 24 }}>
              <div style={{
                width: 80, height: 80, borderRadius: '50%',
                background: 'var(--primary)', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-display)',
                marginBottom: 12, flexShrink: 0,
              }}>
                {initials}
              </div>
              <p style={{ fontSize: 13, color: 'var(--gray-500)' }}>{user?.email}</p>
            </div>

            {/* Form card */}
            <div className="card" style={{ padding: 24 }}>
              <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Label htmlFor="name" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <UserIcon size={13} /> Full name
                  </Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="e.g. John Doe"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Label htmlFor="phone" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Phone size={13} /> Phone number <span style={{ fontWeight: 400, color: 'var(--gray-400)', fontSize: 12 }}>(optional)</span>
                  </Label>
                  <div style={{ display: 'flex' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', padding: '0 12px',
                      borderRadius: '6px 0 0 6px', border: '1px solid hsl(214.3 31.8% 91.4%)',
                      borderRight: 'none', background: 'hsl(210 40% 96.1%)',
                      fontSize: 13, color: 'var(--gray-500)', flexShrink: 0, userSelect: 'none',
                    }}>
                      +234
                    </span>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="8012345678"
                      value={phone}
                      onChange={e => {
                        const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                        setPhone(digits);
                      }}
                      maxLength={10}
                      style={{ borderRadius: '0 6px 6px 0' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Label htmlFor="floor" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Building2 size={13} /> Floor <span style={{ fontWeight: 400, color: 'var(--gray-400)', fontSize: 12 }}>(for delivery)</span>
                  </Label>
                  <select
                    id="floor"
                    className="input"
                    value={floor}
                    onChange={e => setFloor(e.target.value as FloorValue)}
                  >
                    <option value="">Select floor</option>
                    {FLOORS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Label htmlFor="office" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    Wing / Office <span style={{ fontWeight: 400, color: 'var(--gray-400)', fontSize: 12 }}>(optional)</span>
                  </Label>
                  <select
                    id="office"
                    className="input"
                    value={officeNumber}
                    onChange={e => setOffice(e.target.value)}
                  >
                    <option value="">Select wing</option>
                    <option value="A">Wing A</option>
                    <option value="B">Wing B</option>
                    <option value="C">Wing C</option>
                  </select>
                </div>

                <Button type="submit" className="w-full" disabled={saving}>
                  {saving && <span className="spinner" style={{ width: 15, height: 15 }} />}
                  {saving ? 'Saving…' : 'Save changes'}
                </Button>
              </form>
            </div>

            {/* Read-only email */}
            <div className="card" style={{ padding: 20, marginTop: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 8,
                  background: 'var(--gray-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <Lock size={15} color="var(--gray-500)" />
                </div>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-500)', marginBottom: 2 }}>Work email — cannot be changed</p>
                  <p style={{ fontSize: 14, color: 'var(--gray-900)', fontWeight: 500 }}>{user?.email}</p>
                </div>
              </div>
            </div>

            {/* Quick links */}
            <div className="card" style={{ marginTop: 16, overflow: 'hidden' }}>
              {[
                { icon: <ClipboardList size={16} color="var(--primary)" />, label: 'My Orders', sub: 'View your order history', onClick: () => navigate('/orders') },
                { icon: <LogOut size={16} color="var(--error)" />, label: 'Sign out', sub: 'Log out of your account', onClick: () => { clearToken(); navigate('/login'); }, danger: true },
              ].map((item, i, arr) => (
                <button
                  key={item.label}
                  onClick={item.onClick}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    width: '100%', padding: '14px 20px',
                    background: 'none', border: 'none', cursor: 'pointer',
                    borderBottom: i < arr.length - 1 ? '1px solid var(--gray-100)' : 'none',
                    transition: 'background 0.12s',
                    textAlign: 'left',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--gray-50)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--gray-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {item.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: item.danger ? 'var(--error)' : 'var(--gray-900)', margin: 0 }}>{item.label}</p>
                    <p style={{ fontSize: 12, color: 'var(--gray-400)', margin: 0 }}>{item.sub}</p>
                  </div>
                  <ChevronRight size={16} color="var(--gray-300)" />
                </button>
              ))}
            </div>

            <p style={{ fontSize: 12, color: 'var(--gray-400)', textAlign: 'center', marginTop: 20 }}>
              To change your password, use "Forgot password" on the sign-in screen.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
