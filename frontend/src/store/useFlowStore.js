import { create } from 'zustand';

// ponytail: colocated here — only caller; no need for a separate utils file
export const inferLanguage = (filename = '') => {
  const ext = filename.split('.').pop().toLowerCase();
  return { py: 'python', js: 'javascript', jsx: 'javascript', ts: 'typescript',
           tsx: 'typescript', html: 'html', css: 'css', json: 'json',
           md: 'markdown', sh: 'shell', yml: 'yaml', yaml: 'yaml' }[ext] || 'plaintext';
};

/**
 * Initial React Flow node layout.
 * Three agents arranged horizontally: Planner → Coder → Reviewer.
 * Each node carries a `status` field that drives the AgentNode visual ring.
 */
const INITIAL_NODES = [
  {
    id: 'planner',
    type: 'agentNode',
    position: { x: 80, y: 200 },
    data: { label: 'Planner', role: 'architect', status: 'idle' },
  },
  {
    id: 'coder',
    type: 'agentNode',
    position: { x: 380, y: 200 },
    data: { label: 'Coder', role: 'engineer', status: 'idle' },
  },
  {
    id: 'reviewer',
    type: 'agentNode',
    position: { x: 680, y: 200 },
    data: { label: 'Reviewer', role: 'qa', status: 'idle' },
  },
];

const INITIAL_EDGES = [
  { id: 'e-planner-coder',    source: 'planner',  target: 'coder',    animated: false },
  { id: 'e-coder-reviewer',   source: 'coder',    target: 'reviewer', animated: false },
];

/**
 * useFlowStore — Manages the live React Flow canvas and real-time agent state.
 *
 * Consumed by:
 *   - Workspace.jsx        (renders the ReactFlow canvas)
 *   - useWebSocket.js      (calls setAgentActive/Complete on stream events)
 *   - AgentNode.jsx        (reads data.status for visual ring)
 *   - HitlModal.jsx        (reads interrupted + interruptState)
 *   - ChatPanel.jsx        (reads agentLogs)
 *   - CodeEditor.jsx       (reads currentCode)
 */
const useFlowStore = create((set, get) => ({
  // --- React Flow Canvas State ---
  nodes: INITIAL_NODES,
  edges: INITIAL_EDGES,

  // --- Agent Execution State ---
  agentLogs: [],       // Array of { node, message, timestamp } for ChatPanel
  currentPlan: '',
  workspaceFiles: [],  // Array of { filename, content, language }
  activeFileIndex: -1, // -1 corresponds to currentPlan, 0+ corresponds to workspaceFiles
  fileHistory: {},     // Record<filename, string[]> mapping file names to historical content strings
  sandboxLogs: [],     // Array of { message, timestamp } from execution sandbox
  threadId: null,      // Active thread_id for multi-turn sessions

  // --- HITL State ---
  interrupted: false,
  interruptState: null, // { current_code, current_plan } from 'interrupted' StreamEvent

  // --- Status: 'idle' | 'running' | 'interrupted' | 'complete' | 'error' ---
  workflowStatus: 'idle',
  iterationCount: 1,

  // --- Actions ---

  /**
   * Called by useWebSocket on 'node_start' or 'node_finish' events.
   * Sets the matching canvas node's status to 'active'.
   */
  setAgentActive: (nodeName) => {
    set((state) => ({
      workflowStatus: 'running',
      nodes: state.nodes.map((n) =>
        n.id === nodeName
          ? { ...n, data: { ...n.data, status: 'active' } }
          : n,
      ),
    }));
  },

  /**
   * Called by useWebSocket on 'node_finish' events.
   * Marks the node complete and captures state updates (plan/code).
   */
  setAgentComplete: (nodeName, stateUpdate) => {
    set((state) => {
      const newLog = {
        node: nodeName,
        message: `Agent '${nodeName}' completed.`,
        timestamp: new Date().toISOString(),
        state: stateUpdate,
      };

      const logsToAdd = [newLog];
      if (nodeName === 'reviewer' && stateUpdate?.reviewer_feedback) {
        logsToAdd.push({
          node: 'Reviewer Feedback',
          message: stateUpdate.reviewer_feedback === 'APPROVED' 
            ? '✅ Code approved. Ready for deployment.' 
            : `❌ **Revisions Requested:**\n\n${stateUpdate.reviewer_feedback}`,
          timestamp: new Date().toISOString(),
          isFeedback: true,
          status: stateUpdate.reviewer_feedback === 'APPROVED' ? 'approved' : 'rejected'
        });
      }

      const updatedWorkspaceFiles = stateUpdate?.workspace_files
          ? stateUpdate.workspace_files.map(f => ({ ...f, language: f.language || inferLanguage(f.filename) }))
          : (stateUpdate?.current_code ? [{ filename: 'main.py', content: stateUpdate.current_code, language: inferLanguage('main.py') }] : state.workspaceFiles);
          
      const updatedFileHistory = { ...state.fileHistory };
      updatedWorkspaceFiles.forEach(file => {
        if (!updatedFileHistory[file.filename]) {
          updatedFileHistory[file.filename] = [];
        }
        const history = updatedFileHistory[file.filename];
        if (history.length === 0 || history[history.length - 1] !== file.content) {
          updatedFileHistory[file.filename] = [...history, file.content];
        }
      });

      return {
        nodes: state.nodes.map((n) =>
          n.id === nodeName
            ? { ...n, data: { ...n.data, status: 'complete' } }
            : n,
        ),
        agentLogs: [...state.agentLogs, ...logsToAdd],
        currentPlan:  stateUpdate?.current_plan  ?? state.currentPlan,
        iterationCount: stateUpdate?.iteration_count ?? state.iterationCount,
        workspaceFiles: updatedWorkspaceFiles,
        fileHistory: updatedFileHistory,
        edges: state.edges.map((e) =>
          e.source === nodeName ? { ...e, animated: true } : e,
        ),
      };
    });
  },

  /**
   * Called by useWebSocket on 'interrupted' events.
   * Puts the canvas into the HITL paused state for the modal.
   */
  setInterrupted: (interruptPayload) => {
    set({
      workflowStatus: 'interrupted',
      interrupted: true,
      interruptState: interruptPayload,
    });
  },

  /**
   * Called when the user submits the HITL modal or starts a new session.
   * Resets the live canvas to its initial idle state.
   */
  resetCanvas: () => {
    set({
      nodes: INITIAL_NODES,
      edges: INITIAL_EDGES,
      agentLogs: [],
      currentPlan: '',
      workspaceFiles: [],
      fileHistory: {},
      activeFileIndex: -1,
      sandboxLogs: [],
      interrupted: false,
      interruptState: null,
      workflowStatus: 'idle',
      iterationCount: 1,
    });
  },

  /**
   * Sets the active thread_id — persisted to localStorage in Workspace.jsx.
   */
  setThreadId: (id) => set({ threadId: id }),

  /**
   * Appends a system log message to the chat panel feed.
   */
  appendLog: (node, message) => {
    set((state) => ({
      agentLogs: [...state.agentLogs, { node, message, timestamp: new Date().toISOString() }],
    }));
  },

  /**
   * Mark workflow as complete or errored.
   */
  setWorkflowStatus: (status) => set({ workflowStatus: status }),

  /**
   * Change the currently active file tab in the IDE.
   */
  setActiveFileIndex: (index) => set({ activeFileIndex: index }),

  /**
   * Appends a log line to the sandbox terminal.
   */
  appendSandboxLog: (message) => {
    set((state) => ({
      sandboxLogs: [...state.sandboxLogs, { message, timestamp: new Date().toISOString() }],
    }));
  },

  /**
   * Handle REST API fallback response by emitting synthetic events
   * to visually update the React Flow canvas and chat feed.
   */
  handleRestFallback: (data) => {
    const state = get();
    
    // Synthetic Planner Events
    state.setAgentActive('planner');
    state.appendLog('planner', 'Analyzing requirements (REST Fallback)...');
    setTimeout(() => {
      state.setAgentComplete('planner', { current_plan: data.plan });
      
      // Synthetic Coder Events
      state.setAgentActive('coder');
      state.appendLog('coder', 'Writing code (REST Fallback)...');
      setTimeout(() => {
        state.setAgentComplete('coder', { 
          current_plan: data.plan, 
          current_code: data.code, 
          iteration_count: data.iterations,
          workspace_files: data.workspace_files
        });
        
        // Synthetic Reviewer Events
        state.setAgentActive('reviewer');
        state.appendLog('reviewer', 'Reviewing code (REST Fallback)...');
        setTimeout(() => {
          state.setAgentComplete('reviewer', { reviewer_feedback: 'APPROVED', workspace_files: data.workspace_files });
          state.setWorkflowStatus('complete');
          state.appendLog('system', 'REST API generation complete.');
        }, 500);
      }, 500);
    }, 500);
  },
}));

export default useFlowStore;
