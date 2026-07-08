import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { clearToken } from '../api/client';
import QueuePanel from '../components/QueuePanel';

export default function RunnerQueue() {
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: '100vh', background: 'var(--gray-50)' }}>
      <header className="nav-header">
        <div className="nav-inner">
          <div style={{ fontWeight: 800, fontSize: 17, flex: 1, letterSpacing: '-0.02em' }}>
            Delivery queue
          </div>
          <button
            className="btn btn-ghost btn-icon"
            onClick={() => { clearToken(); navigate('/login'); }}
            title="Sign out"
            style={{ color: 'var(--error)' }}
          >
            <LogOut size={17} />
          </button>
        </div>
      </header>

      <div className="page-wrap" style={{ maxWidth: 680, paddingTop: 24 }}>
        <QueuePanel />
      </div>
    </div>
  );
}
