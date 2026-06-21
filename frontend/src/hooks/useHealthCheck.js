import { useState, useEffect } from 'react';
import axios from 'axios';
import { API_ROUTES } from '@/config/constants';

const silentClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  timeout: 5000,
});

/**
 * useHealthCheck — Periodic background polling to verify API connectivity.
 * Pings GET /health every 30s. Silently handles errors to avoid spamming toasts.
 */
export function useHealthCheck(intervalMs = 30000) {
  const [isHealthy, setIsHealthy] = useState(true);

  useEffect(() => {
    let active = true;

    const checkHealth = async () => {
      try {
        const response = await silentClient.get(API_ROUTES.HEALTH);
        if (active) {
          setIsHealthy(response.data?.status === 'healthy');
        }
      } catch (err) {
        if (active) {
          setIsHealthy(false);
        }
      }
    };

    // Run immediately on mount
    checkHealth();

    const intervalId = setInterval(checkHealth, intervalMs);

    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [intervalMs]);

  return isHealthy;
}
