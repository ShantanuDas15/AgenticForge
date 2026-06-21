import { create } from 'zustand';
import apiClient from '@/services/apiClient';
import { API_ROUTES } from '@/config/constants';

/**
 * useSettingsStore — Manages the LLM engine configuration and securely syncs BYOK API keys.
 */
const useSettingsStore = create((set) => ({
  llmProvider: 'groq',
  apiKey: '', // Only kept in memory for UI presentation; backed by DB encryption
  hasGithubToken: false,
  isSettingsOpen: false,
  isSaving: false,

  initialize: async () => {
    try {
      const { data } = await apiClient.get(API_ROUTES.USERS.SETTINGS);
      set({ 
        llmProvider: data.llm_provider, 
        apiKey: data.has_api_key ? '••••••••••••••••' : '',
        hasGithubToken: data.has_github_token
      });
    } catch (err) {
      console.error('Failed to fetch user settings:', err);
    }
  },

  setLlmProvider: (provider) => set({ llmProvider: provider }),

  setApiKey: (key) => set({ apiKey: key }),

  saveSettings: async () => {
    set({ isSaving: true });
    try {
      const { llmProvider, apiKey } = useSettingsStore.getState();
      const payload = { llm_provider: llmProvider };
      if (!apiKey || apiKey.trim() === '') {
        payload.api_key = ''; // Explicitly send empty string to delete
      } else if (apiKey && apiKey !== '••••••••••••••••') {
        payload.api_key = apiKey;
      }
      await apiClient.put(API_ROUTES.USERS.SETTINGS, payload);
    } catch (err) {
      console.error('Failed to save Configuration:', err);
      throw err;
    } finally {
      set({ isSaving: false });
    }
  },

  openSettings: () => set({ isSettingsOpen: true }),
  closeSettings: () => set({ isSettingsOpen: false }),
}));

export default useSettingsStore;
