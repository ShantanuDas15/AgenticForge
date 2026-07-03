import { Navigate, Outlet } from 'react-router-dom';
import { useEffect } from 'react';
import useAuthStore from '@/store/useAuthStore';
import useSettingsStore from '@/store/useSettingsStore';
import apiClient from '@/services/apiClient';
import useBillingStream from '@/hooks/useBillingStream';
import Header from './Header';
import Sidebar from './Sidebar';
import { API_ROUTES } from '@/config/constants';

/**
 * ProtectedRoute — A layout wrapper that intercepts unauthenticated users
 * and violently redirects them to the login wall.
 */
function ProtectedRoute() {
  useBillingStream(); // ponytail: hook must be called unconditionally before any early returns
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isActive = useAuthStore((state) => state.isActive);
  const sessionExpired = useAuthStore((state) => state.sessionExpired);
  const logout = useAuthStore((state) => state.logout);

  useEffect(() => {
    if (isAuthenticated) {
      useSettingsStore.getState().initialize();
      
      const checkStatus = async () => {
        try {
          const { data } = await apiClient.get(API_ROUTES.BILLING.STATUS);
          useAuthStore.getState().setIsActive(data.is_active);
          useAuthStore.getState().setTier(data.subscription_tier);
        } catch (err) {
          console.error('Failed to revalidate active status:', err);
        }
      };
      checkStatus();
    }
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    // replace=true ensures the login page overwrites the history stack
    return <Navigate to="/login" replace />;
  }

  // Render the wrapped child routes (e.g., Dashboard, Workspace)
  return (
    <>
      {sessionExpired && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="glass-card max-w-md p-8 text-center flex flex-col items-center border-yellow-500/20 shadow-[0_0_50px_rgba(234,179,8,0.1)]">
            <div className="w-16 h-16 bg-yellow-500/10 rounded-full flex items-center justify-center mb-6">
               <svg className="w-8 h-8 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">Session Expired</h2>
            <p className="text-forge-muted-text mb-8 text-sm leading-relaxed">
              Your session has expired. Please save your work locally if needed, then log in again to continue.
            </p>
            <button 
              onClick={() => logout("Session expired. Please log in again.", "warning")}
              className="px-8 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white font-medium rounded-lg transition-colors border border-zinc-700 w-full"
            >
              Back to Login
            </button>
          </div>
        </div>
      )}
      {!isActive && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="glass-card max-w-md p-8 text-center flex flex-col items-center border-red-500/20 shadow-[0_0_50px_rgba(239,68,68,0.1)]">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
               <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">Account Suspended</h2>
            <p className="text-forge-muted-text mb-8 text-sm leading-relaxed">
              Your AgenticForge account has been marked as inactive. Please contact your system administrator to restore access to your workspace.
            </p>
            <button 
              onClick={logout}
              className="px-8 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white font-medium rounded-lg transition-colors border border-zinc-700 w-full"
            >
              Sign Out
            </button>
          </div>
        </div>
      )}
      <div className="flex h-screen bg-forge-bg text-forge-text overflow-hidden">
        <Sidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <Header />
          <main className="flex-1 overflow-auto relative">
            <Outlet />
          </main>
        </div>
      </div>
    </>
  );
}

export default ProtectedRoute;
