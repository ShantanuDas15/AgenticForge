import { useRef, useCallback } from 'react';
import useFlowStore from '@/store/useFlowStore';
import useProjectStore from '@/store/useProjectStore';
import useUIStore from '@/store/useUIStore';
import useSettingsStore from '@/store/useSettingsStore';
import useAuthStore from '@/store/useAuthStore';
import { forgeApi } from '@/services/apiClient';
import { WS_EVENTS } from '@/config/constants';

const getWsBaseUrl = () => {
  if (import.meta.env.VITE_WS_BASE_URL) {
    return import.meta.env.VITE_WS_BASE_URL;
  }
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/api/v1`;
  }
  return '/api/v1';
};

const WS_BASE = getWsBaseUrl();

/**
 * useWebSocket — Manages the WebSocket connection to the FastAPI agent stream.
 *
 * Returns:
 *   connect(prompt, threadId?)  — Opens a new WS connection and sends the prompt.
 *   sendResume(feedback)        — Sends feedback for HITL resume (called from HitlModal).
 *   disconnect()                — Cleanly closes the active connection.
 */
function useWebSocket() {
  const wsRef = useRef(null);
  
  // State refs for exponential backoff reconnection
  const reconnectCountRef = useRef(0);
  const activePromptRef = useRef(null);
  const activeThreadIdRef = useRef(null);
  const activeFeedbackRef = useRef(undefined);
  const intentionalCloseRef = useRef(false);

  // Heartbeat refs
  const heartbeatIntervalRef = useRef(null);
  const heartbeatTimeoutRef = useRef(null);

  const stopHeartbeat = useCallback(() => {
    clearInterval(heartbeatIntervalRef.current);
    clearTimeout(heartbeatTimeoutRef.current);
  }, []);

  const startHeartbeat = useCallback((ws) => {
    stopHeartbeat();
    heartbeatIntervalRef.current = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }));
        
        // Wait 5 seconds for a pong response
        clearTimeout(heartbeatTimeoutRef.current);
        heartbeatTimeoutRef.current = setTimeout(() => {
          console.warn('[WS] Heartbeat timeout. Proxy connection likely dropped. Closing.');
          ws.close(); // Triggers onclose and exponential backoff reconnection
        }, 5000);
      }
    }, 30000); // Send ping every 30s
  }, [stopHeartbeat]);

  // Zustand actions — stable references, safe to use inside callbacks
  const setAgentActive    = useFlowStore((s) => s.setAgentActive);
  const setAgentComplete  = useFlowStore((s) => s.setAgentComplete);
  const setInterrupted    = useFlowStore((s) => s.setInterrupted);
  const setWorkflowStatus = useFlowStore((s) => s.setWorkflowStatus);
  const setThreadId       = useFlowStore((s) => s.setThreadId);
  const appendLog         = useFlowStore((s) => s.appendLog);
  const appendSandboxLog  = useFlowStore((s) => s.appendSandboxLog);
  const fetchProjects     = useProjectStore((s) => s.fetchProjects);

  /**
   * Route an incoming StreamEvent to the correct store action.
   * StreamEvent shape: { type, node, message, state }
   */
  const handleMessage = useCallback((event) => {
    let data;
    try {
      data = JSON.parse(event.data);
    } catch {
      console.error('[WS] Failed to parse message:', event.data);
      return;
    }

    const { type, node, message, state: agentState } = data;

    switch (type) {
      case 'pong':
        // Received heartbeat response, clear timeout
        clearTimeout(heartbeatTimeoutRef.current);
        break;

      case WS_EVENTS.NODE_START:
        setAgentActive(node);
        appendLog(node, message);
        break;

      case WS_EVENTS.NODE_FINISH:
        setAgentComplete(node, agentState);
        appendLog(node, message);
        break;

      case WS_EVENTS.INTERRUPTED:
        setInterrupted(agentState);
        appendLog('system', message);
        break;

      case WS_EVENTS.COMPLETE:
        setWorkflowStatus('complete');
        appendLog('system', message);
        // Refresh the project history on the Dashboard
        fetchProjects();
        break;

      case WS_EVENTS.SANDBOX_OUTPUT:
        appendSandboxLog(message);
        break;

      case WS_EVENTS.ERROR:
        setWorkflowStatus('error');
        appendLog('system', `ERROR: ${message}`);
        useUIStore.getState().addToast(message, 'error');
        break;

      default:
        console.warn('[WS] Unknown StreamEvent type:', type);
    }
  }, [setAgentActive, setAgentComplete, setInterrupted, setWorkflowStatus, appendLog, fetchProjects]);

  /**
   * Open a new WebSocket connection and send the initial generation prompt.
   * Integrates an exponential backoff strategy if the connection drops abnormally.
   */
  const connect = useCallback((prompt, threadId = null, isReconnect = false) => {
    if (!isReconnect) {
      activePromptRef.current = prompt;
      activeThreadIdRef.current = threadId;
      activeFeedbackRef.current = undefined;
      reconnectCountRef.current = 0;
    }
    intentionalCloseRef.current = false;

    // Close any existing connection first
    if (wsRef.current) {
      wsRef.current.close();
    }

    const token = useAuthStore.getState().token;
    const ws = new WebSocket(`${WS_BASE}/ws/forge/stream?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.info('[WS] Connection established.');
      
      startHeartbeat(ws);

      if (isReconnect) {
        useUIStore.getState().addToast('Reconnected to AgenticForge successfully.', 'success');
        appendLog('system', 'Connection restored.');
      }
      
      reconnectCountRef.current = 0; // Reset counter on success

      const { llmProvider } = useSettingsStore.getState();

      const payload = { 
        prompt: activePromptRef.current,
        llm_provider: llmProvider
      };
      if (activeThreadIdRef.current) payload.thread_id = activeThreadIdRef.current;
      ws.send(JSON.stringify(payload));
    };

    ws.onmessage = handleMessage;

    ws.onerror = (err) => {
      console.error('[WS] Connection error:', err);
      // We rely on onclose to handle the retry logic rather than throwing an explicit error toast here,
      // as onerror is always followed by onclose.
    };

    ws.onclose = (event) => {
      console.info('[WS] Connection closed.', event.code);
      wsRef.current = null;
      stopHeartbeat();

      // Do not attempt to reconnect if the user intentionally navigated away or hard stopped
      if (intentionalCloseRef.current) return;
      
      // 1000 is a normal closure
      if (event.code === 1000) return;

      const attempt = reconnectCountRef.current + 1;
      reconnectCountRef.current = attempt;

      // 3 retry attempts with exponential backoff mappings
      if (attempt <= 3) {
        const timeoutMap = { 1: 1000, 2: 3000, 3: 5000 };
        const delay = timeoutMap[attempt];
        
        appendLog('system', `Connection dropped. Attempting to reconnect in ${delay/1000}s... (Attempt ${attempt}/3)`);
        useUIStore.getState().addToast(`Connection dropped. Reconnecting in ${delay/1000}s...`, 'info');
        
        setTimeout(() => {
           connect(activePromptRef.current, activeThreadIdRef.current, true);
        }, delay);
      } else {
        appendLog('system', 'WebSocket connection failed. Falling back to REST API...');
        useUIStore.getState().addToast('WebSocket unavailable. Using REST API fallback.', 'info');
        
        forgeApi.generate(activePromptRef.current, activeThreadIdRef.current)
          .then((data) => {
             useFlowStore.getState().handleRestFallback(data);
             fetchProjects();
          })
          .catch((err) => {
             setWorkflowStatus('error');
             appendLog('system', `REST API fallback failed: ${err.message}`);
          });
      }
    };
  }, [handleMessage, setWorkflowStatus, appendLog]);

  /**
   * Sends feedback payload back to the backend to resume a paused execution.
   */
  const sendResume = useCallback((feedback) => {
    const thread_id = useFlowStore.getState().threadId || activeThreadIdRef.current;
    if (!thread_id) {
      useUIStore.getState().addToast('Cannot resume: missing thread ID.', 'error');
      return;
    }

    activeThreadIdRef.current = thread_id;
    activeFeedbackRef.current = feedback;
    reconnectCountRef.current = 0;

    // Cleanly close the active /stream socket
    intentionalCloseRef.current = true;
    if (wsRef.current) {
      wsRef.current.close();
    }

    const token = useAuthStore.getState().token;
    // Open a new socket to the dedicated /resume endpoint
    const ws = new WebSocket(`${WS_BASE}/ws/forge/resume?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.info('[WS] Connection established for /resume.');
      intentionalCloseRef.current = false; // re-enable auto-reconnect
      
      startHeartbeat(ws);

      const payload = { thread_id };
      if (feedback) payload.human_feedback = feedback;
      ws.send(JSON.stringify(payload));
      
      appendLog('system', 'Resuming workflow with human feedback...');
    };

    ws.onmessage = handleMessage;

    ws.onerror = (err) => {
      console.error('[WS] Connection error:', err);
    };

    ws.onclose = (event) => {
      console.info('[WS] Connection closed.', event.code);
      wsRef.current = null;
      stopHeartbeat();

      if (intentionalCloseRef.current) return;
      if (event.code === 1000) return;

      const attempt = reconnectCountRef.current + 1;
      reconnectCountRef.current = attempt;

      if (attempt <= 3) {
        const timeoutMap = { 1: 1000, 2: 3000, 3: 5000 };
        const delay = timeoutMap[attempt];
        
        appendLog('system', `Connection dropped. Attempting to reconnect in ${delay/1000}s... (Attempt ${attempt}/3)`);
        useUIStore.getState().addToast(`Connection dropped. Reconnecting in ${delay/1000}s...`, 'info');
        
        setTimeout(() => {
           sendResume(activeFeedbackRef.current);
        }, delay);
      } else {
        appendLog('system', 'WebSocket connection failed. Falling back to REST API...');
        useUIStore.getState().addToast('WebSocket unavailable. Using REST API fallback.', 'info');
        
        forgeApi.resume(activeThreadIdRef.current, activeFeedbackRef.current)
          .then((data) => {
             useFlowStore.getState().handleRestFallback(data);
             fetchProjects();
          })
          .catch((err) => {
             setWorkflowStatus('error');
             appendLog('system', `REST API fallback failed: ${err.message}`);
          });
      }
    };
  }, [handleMessage, appendLog, connect, setWorkflowStatus]);

  /**
   * Disconnect the active WebSocket connection cleanly.
   */
  const disconnect = useCallback(() => {
    intentionalCloseRef.current = true;
    stopHeartbeat();
    wsRef.current?.close();
    wsRef.current = null;
  }, [stopHeartbeat]);

  return { connect, disconnect, sendResume };
}

export default useWebSocket;
