// src/pages/AuthCallback.jsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '@/store/useAuthStore';
import useUIStore from '@/store/useUIStore';

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const accessToken  = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const userRaw      = params.get('user');

    if (!accessToken || !userRaw) {
      useUIStore.getState().addToast('Google sign-in failed. Please try again.', 'error');
      navigate('/login');
      return;
    }

    const user = JSON.parse(userRaw);

    // Mirror the exact pattern from useAuthStore.login()
    localStorage.setItem('forge_token',         accessToken);
    localStorage.setItem('forge_refresh_token', refreshToken);
    localStorage.setItem('forge_user',          JSON.stringify(user));
    localStorage.setItem('forge_isActive',      String(user.is_active));
    localStorage.setItem('forge_tier',          user.subscription_tier || 'Free Developer');

    useAuthStore.setState({
      user,
      token:           accessToken,
      refreshToken,
      isAuthenticated: true,
      isActive:        user.is_active !== false,
      tier:            user.subscription_tier || 'Free Developer',
    });

    // Remove tokens from URL immediately (security hygiene)
    window.history.replaceState({}, document.title, '/');

    useUIStore.getState().addToast(`Welcome, ${user.name}!`, 'success');
    navigate('/');
  }, [navigate]);

  // ponytail: shown for <200ms during the redirect
  return (
    <div className="min-h-screen flex items-center justify-center bg-forge-bg">
      <p className="text-forge-muted-text text-sm animate-pulse">Completing sign-in…</p>
    </div>
  );
}
