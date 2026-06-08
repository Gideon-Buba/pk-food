import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Menu from './pages/Menu';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import OrderConfirmation from './pages/OrderConfirmation';
import AdminDashboard from './pages/AdminDashboard';
import RunnerQueue from './pages/RunnerQueue';
import ProtectedRoute from './components/ProtectedRoute';
import AuthCallback from './components/AuthCallback';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/" element={<Navigate to="/menu" replace />} />

        <Route
          path="/menu"
          element={<ProtectedRoute><Menu /></ProtectedRoute>}
        />
        <Route
          path="/cart"
          element={<ProtectedRoute><Cart /></ProtectedRoute>}
        />
        <Route
          path="/checkout"
          element={<ProtectedRoute><Checkout /></ProtectedRoute>}
        />
        <Route
          path="/order-confirmation"
          element={<ProtectedRoute><OrderConfirmation /></ProtectedRoute>}
        />
        <Route
          path="/admin"
          element={<ProtectedRoute roles={['ADMIN']}><AdminDashboard /></ProtectedRoute>}
        />
        <Route
          path="/runner"
          element={<ProtectedRoute roles={['RUNNER', 'ADMIN']}><RunnerQueue /></ProtectedRoute>}
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
