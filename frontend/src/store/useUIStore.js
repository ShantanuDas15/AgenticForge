import { create } from 'zustand';

/**
 * useUIStore — Manages global UI state (Toasts, Modals, etc.)
 */
const useUIStore = create((set) => ({
  toasts: [],
  
  /**
   * Add a new toast notification. Auto-removes after 5 seconds.
   * @param {string} message - The text to display
   * @param {'info' | 'success' | 'error'} type - The severity of the toast
   */
  addToast: (message, type = 'info') => {
    const id = crypto.randomUUID();
    
    set((state) => ({
      toasts: [...state.toasts, { id, message, type }]
    }));
    
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id)
      }));
    }, 5000);
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id)
    }));
  }
}));

export default useUIStore;
