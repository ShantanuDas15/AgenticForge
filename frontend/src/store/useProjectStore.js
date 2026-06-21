import { create } from 'zustand';
import apiClient from '@/services/apiClient';
import { API_ROUTES } from '@/config/constants';

/**
 * useProjectStore — Manages historical project data from the REST API.
 *
 * Consumed by:
 *   - Dashboard.jsx  (renders the project history list)
 *   - Workspace.jsx  (saves thread_id after generation completes)
 */
const useProjectStore = create((set, get) => ({
  // --- State ---
  projects: [],
  selectedProject: null, // Holds the detailed project data for inspection
  isLoading: false,
  error: null,
  hasMore: true,

  // --- Actions ---

  /**
   * Fetch projects from GET /api/v1/projects/ with pagination
   */
  fetchProjects: async (reset = false) => {
    const { projects } = get();
    const skip = reset ? 0 : projects.length;
    const limit = 12;

    set({ isLoading: true, error: null });
    if (reset) set({ hasMore: true });

    try {
      const { data } = await apiClient.get(`${API_ROUTES.PROJECTS.BASE}/?skip=${skip}&limit=${limit}`);
      set({ 
        projects: reset ? data : [...projects, ...data], 
        isLoading: false,
        hasMore: data.length === limit
      });
    } catch (err) {
      set({ error: err.message, isLoading: false });
    }
  },

  /**
   * Fetch details of a single project from GET /api/v1/projects/{id}
   */
  getProject: async (projectId) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await apiClient.get(API_ROUTES.PROJECTS.BY_ID(projectId));
      set({ selectedProject: data, isLoading: false });
      return data;
    } catch (err) {
      set({ error: err.message, isLoading: false });
      return null;
    }
  },

  /**
   * Clear selected project state (closes inspection view).
   */
  clearSelectedProject: () => set({ selectedProject: null }),

  /**
   * Delete a project from DELETE /api/v1/projects/{id}
   * Optimistically removes from local state before the API call.
   */
  deleteProject: async (projectId) => {
    // Optimistic update
    const previous = get().projects;
    set({ projects: previous.filter((p) => p.id !== projectId) });
    try {
      await apiClient.delete(API_ROUTES.PROJECTS.BY_ID(projectId));
      if (get().selectedProject?.id === projectId) {
        set({ selectedProject: null });
      }
    } catch (err) {
      // Rollback on failure
      set({ projects: previous, error: err.message });
    }
  },

  /**
   * Clear any stored error message.
   */
  clearError: () => set({ error: null }),
}));

export default useProjectStore;
