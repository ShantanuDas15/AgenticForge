import axios from 'axios';
import useUIStore from '@/store/useUIStore';
import useAuthStore from '@/store/useAuthStore';
import useDeploymentStore from '@/store/useDeploymentStore';
import useFlowStore from '@/store/useFlowStore';
import { API_ROUTES } from '@/config/constants';

/**
 * Shared Axios instance.
 * Base URL reads from the Vite environment variable defined in .env.local.
 * The Vite proxy (vite.config.js) forwards /api/* → localhost:8000/api/*,
 * so VITE_API_BASE_URL="/api/v1" works in both dev and production.
 */
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30s — LangGraph generation can take time
});

// --- Request Interceptor ---
// Injects the JWT Bearer token into outgoing requests if authenticated
apiClient.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// --- Token Refresh Logic ---
let isRefreshing = false;
let failedQueue = [];
let refreshTimeout = null;

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

const refreshAccessToken = async () => {
  const authStore = useAuthStore.getState();
  const refreshToken = authStore.refreshToken;

  if (!refreshToken) {
    if (authStore.isAuthenticated) authStore.setSessionExpired(true);
    throw new Error("Session expired. Please log in again.");
  }

  try {
    const { data } = await axios.post((import.meta.env.VITE_API_BASE_URL || '/api/v1') + '/auth/refresh', {
      refresh_token: refreshToken
    });
    
    authStore.setTokens(data.access_token, data.refresh_token);
    if (data.user) {
      useAuthStore.setState({ user: data.user, tier: data.user.subscription_tier });
      localStorage.setItem('forge_user', JSON.stringify(data.user));
      localStorage.setItem('forge_tier', data.user.subscription_tier);
    }
    processQueue(null, data.access_token);
    return data.access_token;
  } catch (refreshError) {
    processQueue(refreshError, null);
    if (authStore.isAuthenticated) authStore.setSessionExpired(true);
    throw new Error("Session expired. Please log in again.");
  }
};

// Proactively schedule a refresh 60s before token expiry
useAuthStore.subscribe((state, prevState) => {
  if (state.token && state.token !== prevState?.token) {
    try {
      const payload = JSON.parse(atob(state.token.split('.')[1]));
      const timeUntilExpiry = payload.exp * 1000 - Date.now();
      const timeUntilRefresh = timeUntilExpiry - 60000;
      
      if (refreshTimeout) clearTimeout(refreshTimeout);
      
      if (timeUntilRefresh > 0) {
        refreshTimeout = setTimeout(() => {
          if (!isRefreshing) {
            isRefreshing = true;
            refreshAccessToken().catch(() => {}).finally(() => { isRefreshing = false; });
          }
        }, timeUntilRefresh);
      }
    } catch (e) {
      // Ignore invalid JWT payload
    }
  } else if (!state.token && refreshTimeout) {
    clearTimeout(refreshTimeout);
  }
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Session Teardown / Refresh on 401 Unauthorized
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise(function(resolve, reject) {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers.Authorization = 'Bearer ' + token;
          return apiClient(originalRequest);
        }).catch(err => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const token = await refreshAccessToken();
        originalRequest.headers.Authorization = 'Bearer ' + token;
        return apiClient(originalRequest);
      } catch (err) {
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    // Explicit 403 Forbidden / 422 Unprocessable handler for cross-tenant protection
    if (error.response?.status === 403 || error.response?.status === 422) {
      const detail = error.response?.data?.detail || "Access denied to requested resource.";
      const errorCode = error.response?.data?.error_code;
      
      if (errorCode === 'ACCOUNT_SUSPENDED') {
        useAuthStore.getState().setIsActive(false);
        return Promise.reject(new Error(detail)); // Return early to prevent toast flash
      }
      
      if (errorCode === 'FORBIDDEN') {
        useUIStore.getState().addToast('Upgrade Required: ' + detail, 'error');
        window.location.href = '/settings?tab=billing';
        return Promise.reject(new Error(detail));
      }
      
      // Surface field-level Pydantic errors when present (RequestValidationError path only).
      // Custom ValidationError exceptions also return 422 but carry no `errors` array — the
      // array presence check is the discriminator, so those paths are completely unaffected.
      const pydanticErrors = error.response?.data?.errors;
      if (pydanticErrors?.length > 0) {
        const fieldMessages = pydanticErrors
          .map(e => {
            const field = e.loc?.length > 0 ? e.loc[e.loc.length - 1] : 'field';
            return `${field}: ${e.msg}`;
          })
          .join(' · ');
        useUIStore.getState().addToast(fieldMessages, 'error');
        return Promise.reject(new Error(fieldMessages));
      }

      useUIStore.getState().addToast(errorCode ? `[${errorCode}] ${detail}` : detail, 'error');
      
      if (error.config?.url?.includes('/history') || error.config?.url?.includes('/forge')) {
         window.location.href = '/'; // Safe redirect out of unauthorized workspace
      }
      return Promise.reject(new Error(detail));
    }

    const isHistory404 = error.config?.url?.includes('/history') && error.response?.status === 404;
    
    // Check for explicit error_code from backend instead of string matching
    const isRegisterDuplicate = error.config?.url?.includes('/register') && 
                                error.response?.status === 400 && 
                                (error.response?.data?.error_code === 'USER_ALREADY_EXISTS' || error.response?.data?.detail?.includes('already exists'));
    
    const errorCode = error.response?.data?.error_code;
    const detail = error.response?.data?.detail;
    
    if (errorCode === 'DEPLOYMENT_ERROR') {
      useDeploymentStore.setState({ status: 'error', error: detail || 'Deployment failed.' });
    } else if (errorCode === 'GENERATION_ERROR') {
      useFlowStore.getState().setWorkflowStatus('error');
      useFlowStore.getState().appendLog('system', `Generation Error: ${detail || 'An unexpected error occurred.'}`);
    }
    
    const message = errorCode && detail 
      ? `[${errorCode}] ${detail}`
      : detail || error.message || 'An unexpected error occurred.';
      
    const isSilencedError = errorCode === 'DEPLOYMENT_ERROR' || errorCode === 'GENERATION_ERROR';
      
    if (!isHistory404 && !isRegisterDuplicate && !isSilencedError) {
      useUIStore.getState().addToast(message, 'error');
    }
    
    return Promise.reject(new Error(message));
  },
);

// --- REST API Fallbacks for Code Generation ---
// Used when WebSockets are unavailable or for headless execution
export const forgeApi = {
  generate: async (prompt, threadId = null) => {
    const payload = { prompt };
    if (threadId) payload.thread_id = threadId;
    const { data } = await apiClient.post(API_ROUTES.FORGE.GENERATE, payload);
    return data;
  },
  resume: async (threadId, humanFeedback = null) => {
    const payload = { thread_id: threadId };
    if (humanFeedback) payload.human_feedback = humanFeedback;
    const { data } = await apiClient.post(API_ROUTES.FORGE.RESUME, payload);
    return data;
  }
};

export default apiClient;
