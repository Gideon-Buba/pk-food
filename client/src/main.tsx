import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { registerServiceWorker, registerPushNotifications } from './lib/push';

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

createRoot(root).render(<App />);

// Register SW on every load, then attempt push subscription.
// If the user is already logged in (stored JWT), this subscribes immediately.
// If not logged in, registerPushNotifications exits early — AuthCallback
// calls it again after the magic-link login completes.
registerServiceWorker()
  .then(() => registerPushNotifications())
  .catch((err) => console.warn('[push] Startup push setup failed:', err));
