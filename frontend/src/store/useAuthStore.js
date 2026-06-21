import { create } from 'zustand';
import useUIStore from '@/store/useUIStore';
import apiClient from '@/services/apiClient';
import { API_ROUTES } from '@/config/constants';

// Recover token and user data from session persistence
const token = localStorage.getItem('forge_token');
const refreshToken = localStorage.getItem('forge_refresh_token');
const user = JSON.parse(localStorage.getItem('forge_user') || 'null');

/**
 * useAuthStore — Manages the authentication state and JWT tokens.
 */
const useAuthStore = create((set, get) => ({
  user,
  token,
  refreshToken,
  isAuthenticated: !!token,
  isActive: localStorage.getItem('forge_isActive') !== 'false',
  tier: localStorage.getItem('forge_tier') || (user?.subscription_tier) || 'Free Developer',
  isLoading: false,
  sessionExpired: false,

  setSessionExpired: (status) => set({ sessionExpired: status }),

  setIsActive: (status) => {
    localStorage.setItem('forge_isActive', String(status));
    set({ isActive: status });
  },

  setTokens: (accessToken, newRefreshToken) => {
    localStorage.setItem('forge_token', accessToken);
    localStorage.setItem('forge_refresh_token', newRefreshToken);
    set({ token: accessToken, refreshToken: newRefreshToken });
  },

  setTier: (tier) => {
    localStorage.setItem('forge_tier', tier);
    set({ tier });
  },

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const { data } = await apiClient.post(API_ROUTES.AUTH.LOGIN, { email, password });
      
      localStorage.setItem('forge_token', data.access_token);
      localStorage.setItem('forge_refresh_token', data.refresh_token);
      localStorage.setItem('forge_user', JSON.stringify(data.user));
      localStorage.setItem('forge_isActive', String(data.user.is_active));
      localStorage.setItem('forge_tier', data.user.subscription_tier || 'Free Developer');
      
      set({ 
        user: data.user, 
        token: data.access_token, 
        refreshToken: data.refresh_token,
        isAuthenticated: true, 
        isLoading: false,
        isActive: data.user.is_active !== false,
        tier: data.user.subscription_tier || 'Free Developer'
      });
      useUIStore.getState().addToast(`Welcome back, ${data.user.name}.`, 'success');
      return true;
    } catch (err) {
      set({ isLoading: false });
      useUIStore.getState().addToast(err.message || 'Authentication failed', 'error');
      return false;
    }
  },

  updateProfile: async (name) => {
    set({ isLoading: true });
    try {
      const { data } = await apiClient.put(API_ROUTES.USERS.PROFILE, { name });
      const updatedUser = { ...get().user, name: data.name };
      
      localStorage.setItem('forge_user', JSON.stringify(updatedUser));
      set({ user: updatedUser, isLoading: false });
      
      useUIStore.getState().addToast('Profile updated successfully.', 'success');
      return true;
    } catch (err) {
      set({ isLoading: false });
      useUIStore.getState().addToast(err.message || 'Failed to update profile.', 'error');
      return false;
    }
  },

  register: async (email, password, name) => {
    set({ isLoading: true });
    try {
      const { data } = await apiClient.post(API_ROUTES.AUTH.REGISTER, { email, password, name });
      
      localStorage.setItem('forge_token', data.access_token);
      localStorage.setItem('forge_refresh_token', data.refresh_token);
      localStorage.setItem('forge_user', JSON.stringify(data.user));
      localStorage.setItem('forge_isActive', String(data.user.is_active));
      localStorage.setItem('forge_tier', data.user.subscription_tier || 'Free Developer');
      
      set({ 
        user: data.user, 
        token: data.access_token, 
        refreshToken: data.refresh_token,
        isAuthenticated: true, 
        isLoading: false,
        isActive: data.user.is_active !== false,
        tier: data.user.subscription_tier || 'Free Developer'
      });
      useUIStore.getState().addToast(`Welcome to AgenticForge, ${data.user.name}!`, 'success');
      return { success: true };
    } catch (err) {
      set({ isLoading: false });
      return { success: false, error: err.message };
    }
  },

  logout: (message = 'Session terminated cleanly.', type = 'info') => {
    localStorage.removeItem('forge_token');
    localStorage.removeItem('forge_refresh_token');
    localStorage.removeItem('forge_user');
    localStorage.removeItem('forge_isActive');
    localStorage.removeItem('forge_tier');
    set({ user: null, token: null, refreshToken: null, isAuthenticated: false, isActive: true, tier: 'Free Developer', sessionExpired: false });
    useUIStore.getState().addToast(message, type);
  }
}));

export default useAuthStore;
