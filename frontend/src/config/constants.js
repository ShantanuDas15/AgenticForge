/**
 * Centralized Application Constants
 */

export const MAX_ITERATIONS = 3;

export const LLM_PROVIDERS = {
  GROQ: 'groq',
  OPENAI: 'openai',
  ANTHROPIC: 'anthropic',
};

export const TIERS = {
  FREE: 'Free Developer',
  PRO: 'pro_architect',
};

export const WS_EVENTS = {
  NODE_START: 'node_start',
  NODE_FINISH: 'node_finish',
  INTERRUPTED: 'interrupted',
  COMPLETE: 'complete',
  SANDBOX_OUTPUT: 'sandbox_output',
  ERROR: 'error',
};

export const API_ROUTES = {
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    FORGOT_PASSWORD: '/auth/forgot-password',
    RESET_PASSWORD: '/auth/reset-password',
  },
  USERS: {
    PROFILE: '/users/profile',
    PASSWORD: '/users/password',
    SETTINGS: '/users/settings',
    ME: '/users/me',
  },
  PROJECTS: {
    BASE: '/projects',
    BY_ID: (id) => `/projects/${id}`,
  },
  BILLING: {
    STATUS: '/billing/status',
    UPGRADE: '/billing/upgrade',
    DOWNGRADE: '/billing/downgrade',
  },
  GIT: {
    COMMIT: '/git/commit',
    GITHUB_LOGIN: '/git/github/login',
  },
  DEPLOY: {
    BASE: '/deploy',
  },
  FORGE: {
    GENERATE: '/forge/generate',
    RESUME: '/forge/resume',
    THREAD_HISTORY: (threadId) => `/forge/threads/${threadId}/history`,
  },
  USAGE: {
    WEEKLY: '/usage/weekly',
  },
  LLM_TEST: '/llm-test',
  HEALTH: '/health',
};
