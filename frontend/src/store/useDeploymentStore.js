import { create } from 'zustand';
import apiClient from '@/services/apiClient';
import { API_ROUTES } from '@/config/constants';

/**
 * useDeploymentStore — Manages cloud deployment states and artifacts.
 */
const useDeploymentStore = create((set) => ({
  status: 'idle', // 'idle' | 'building' | 'deploying' | 'live' | 'error'
  provider: 'vercel', // 'vercel' | 'netlify'
  liveUrl: null,
  message: null,
  error: null,
  isMock: false,

  setProvider: (provider) => set({ provider }),
  
  deploy: async (files, provider) => {
    set({ status: 'building', error: null, liveUrl: null, message: null });
    
    try {
      set({ status: 'deploying' });
      const { data } = await apiClient.post(API_ROUTES.DEPLOY.BASE, { provider, files });
      
      set({ status: 'live', liveUrl: data.liveUrl, message: data.message, isMock: data.is_mock });
    } catch (err) {
      set({ status: 'error', error: err.message || 'Deployment failed' });
    }
  },

  reset: () => set({ status: 'idle', liveUrl: null, error: null, message: null, isMock: false }),
}));

export default useDeploymentStore;
