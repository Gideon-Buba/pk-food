import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import { Toaster } from 'react-hot-toast';
import Login from './pages/Login';
import Menu from './pages/Menu';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import OrderConfirmation from './pages/OrderConfirmation';
import AdminDashboard from './pages/AdminDashboard';
import RunnerQueue from './pages/RunnerQueue';
import RunnerHistory from './pages/RunnerHistory';
import MyOrders from './pages/MyOrders';
import ProtectedRoute from './components/ProtectedRoute';
import VerifyEmail from './pages/VerifyEmail';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Profile from './pages/Profile';
import BottomNav from './components/BottomNav';
import ActiveOrderBar from './components/ActiveOrderBar';

const AUTH_PATHS = ['/login', '/verify-email', '/forgot-password', '/reset-password'];

function RoleHome() {
  const token = localStorage.getItem('pk_food_token');
  if (token) {
    try {
      const { role } = jwtDecode<{ role: string }>(token);
      if (role === 'ADMIN')  return <Navigate to="/admin"  replace />;
      if (role === 'RUNNER') return <Navigate to="/runner" replace />;
    } catch { /* fall through */ }
  }
  return <Navigate to="/menu" replace />;
}

function AppContent() {
  const { pathname } = useLocation();
  const isAuth = AUTH_PATHS.some(p => pathname === p || pathname.startsWith(p + '?'));

  return (
    <>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/" element={<RoleHome />} />
        <Route path="/menu" element={<ProtectedRoute><Menu /></ProtectedRoute>} />
        <Route path="/cart" element={<ProtectedRoute><Cart /></ProtectedRoute>} />
        <Route path="/checkout" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
        <Route path="/order-confirmation" element={<ProtectedRoute><OrderConfirmation /></ProtectedRoute>} />
        <Route path="/orders" element={<ProtectedRoute><MyOrders /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute roles={['ADMIN']}><AdminDashboard /></ProtectedRoute>} />
        <Route path="/runner" element={<ProtectedRoute roles={['RUNNER', 'ADMIN']}><RunnerQueue /></ProtectedRoute>} />
        <Route path="/runner-history" element={<ProtectedRoute roles={['RUNNER', 'ADMIN']}><RunnerHistory /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {!isAuth && <ActiveOrderBar />}
      {!isAuth && <BottomNav />}
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3000,
          style: {
            borderRadius: '10px',
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: '14px',
            fontWeight: 500,
            boxShadow: '0 4px 16px rgba(0,0,0,.12)',
          },
          success: { iconTheme: { primary: '#316752', secondary: '#fff' } },
        }}
      />
      <AppContent />
    </BrowserRouter>
  );
}
