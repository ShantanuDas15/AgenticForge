import { useEffect, useState } from 'react';
import apiClient from '@/services/apiClient';
import useFlowStore, { inferLanguage } from '@/store/useFlowStore';
import { API_ROUTES } from '@/config/constants';

/**
 * useThreadHistory — Hydrates the workspace canvas from the backend REST API
 * when resuming a previously executed thread from the Dashboard.
 */
function useThreadHistory(threadId) {
  const [isHydrating, setIsHydrating] = useState(false);
  const [hydrationError, setHydrationError] = useState(null);

  useEffect(() => {
    // Only attempt hydration if a thread ID exists
    if (!threadId) return;

    let isMounted = true;

    const hydrateHistory = async () => {
      setIsHydrating(true);
      setHydrationError(null);
      
      try {
        const { data } = await apiClient.get(API_ROUTES.FORGE.THREAD_HISTORY(threadId));
        
        if (!isMounted) return;

        // Reset the canvas entirely before applying historical state
        const store = useFlowStore.getState();
        store.resetCanvas();

        if (data && data.history && Array.isArray(data.history) && data.history.length > 0) {
          // Iterate through historical turns and recreate the internal monologue
          data.history.forEach((turn, index) => {
            const nodeName = turn.node || 'system';
            const message = turn.message || `Restored historical record [Turn ${index + 1}]`;
            store.appendLog(nodeName, message);
          });

          // Extract final code and plan from the most recent valid turn
          const lastTurn = data.history[data.history.length - 1];
          const finalPlan = lastTurn.state?.current_plan || '';
          const finalCode = lastTurn.state?.current_code || '';
          const workspaceFiles = lastTurn.state?.workspace_files || [];
          
          const isInterrupted = lastTurn.type === 'interrupted';

          // Inject the extracted state instantly into Zustand
          useFlowStore.setState({
            currentPlan: finalPlan,
            currentCode: finalCode,
            workspaceFiles: workspaceFiles.map(f => ({ ...f, language: f.language || inferLanguage(f.filename) })),
            workflowStatus: isInterrupted ? 'interrupted' : 'complete',
            interrupted: isInterrupted,
            interruptState: isInterrupted ? lastTurn.state : null
          });
          
          store.appendLog('system', 'Workspace successfully hydrated from database archive.');
        }

      } catch (err) {
        if (!isMounted) return;

        if (err.response?.status === 403 || err.message?.includes('403')) {
          // ponytail: interceptor handles toast+redirect; we just need the canvas log
          useFlowStore.getState().appendLog('system', 'Access denied: this thread belongs to another account.');
          return;
        }

        const status = err.message.includes('404') || err.response?.status === 404;
        if (!status) {
          console.error('[History Hydration Error]', err);
          setHydrationError(err.message);
        }
      } finally {
        if (isMounted) {
          setIsHydrating(false);
        }
      }
    };

    hydrateHistory();

    return () => {
      isMounted = false; // Cleanup to prevent race conditions on fast unmounts
    };
  }, [threadId]);

  return { isHydrating, hydrationError };
}

export default useThreadHistory;
