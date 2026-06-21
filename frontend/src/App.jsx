import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from '@/components/common/Toast';
import SettingsModal from '@/components/layout/SettingsModal';
import { Loader2 } from 'lucide-react';
import ProtectedRoute from '@/components/layout/ProtectedRoute';

// Lazy load the heavy route components to split the JS bundle
const Dashboard = React.lazy(() => import('@/pages/Dashboard'));
const Workspace = React.lazy(() => import('@/pages/Workspace'));
const Login = React.lazy(() => import('@/pages/Login'));
const AccountBilling = React.lazy(() => import('@/pages/AccountBilling'));
const ResetPassword = React.lazy(() => import('@/pages/ResetPassword'));

/**
 * Loading fallback for Suspense while downloading route chunks.
 */
function PageLoader() {
  return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-forge-bg text-forge-muted-text">
      <Loader2 className="animate-spin mb-4 text-forge-accent" size={32} />
      <p className="text-sm font-medium tracking-wide">Initializing Forge UI...</p>
    </div>
  );
}

import useBillingStream from '@/hooks/useBillingStream';

/**
 * App — Root routing component.
 * Features React.lazy route splitting, ProtectedRoutes for auth, and global UI containers.
 */
function App() {
  useBillingStream();

  return (
    <>
      <ToastContainer />
      <SettingsModal />
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            
            <Route element={<ProtectedRoute />}>
              <Route path="/"          element={<Dashboard />} />
              <Route path="/workspace" element={<Workspace />} />
              <Route path="/account-billing"  element={<AccountBilling />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </>
  );
}

export default App;
