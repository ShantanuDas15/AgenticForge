import { useEffect } from 'react';
import useAuthStore from '@/store/useAuthStore';

export default function useBillingStream() {
  const token = useAuthStore(state => state.token);
  const setTier = useAuthStore(state => state.setTier);
  const setIsActive = useAuthStore(state => state.setIsActive);

  useEffect(() => {
    if (!token) return;
    let sse = null;
    let retryCount = 0;
    let timeoutId = null;
    let isMounted = true;

    const connect = () => {
      if (!isMounted) return;
      
      const url = `${import.meta.env.VITE_API_BASE_URL || '/api/v1'}/billing/stream?token=${token}`;
      sse = new EventSource(url);
      
      sse.onopen = () => {
        retryCount = 0;
      };
      
      sse.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.tier) setTier(data.tier);
          if (data.is_active !== undefined) setIsActive(data.is_active);
        } catch (e) {
          console.error("SSE parse error", e);
        }
      };
      
      sse.onerror = () => {
        sse.close();
        if (!isMounted) return;
        
        const delay = [1000, 3000, 5000][retryCount] ?? 10000;
        retryCount = Math.min(retryCount + 1, 3);
        timeoutId = setTimeout(connect, delay);
      };
    };
    
    connect();
    
    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
      if (sse) sse.close();
    };
  }, [token, setTier, setIsActive]);
}
