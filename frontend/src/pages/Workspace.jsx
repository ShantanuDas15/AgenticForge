import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ReactFlow, Background, Controls } from '@xyflow/react';
import { Settings, MessageSquare, GitBranch, Rocket, Loader2, AlertTriangle, Sparkles, XCircle } from 'lucide-react';
import '@xyflow/react/dist/style.css';

import useFlowStore from '@/store/useFlowStore';
import useWebSocket from '@/hooks/useWebSocket';
import useThreadHistory from '@/hooks/useThreadHistory';
import useSettingsStore from '@/store/useSettingsStore';
import useUIStore from '@/store/useUIStore';
import { MAX_ITERATIONS } from '@/config/constants';

import AgentNode from '@/components/workspace/AgentNode';
import ChatPanel from '@/components/workspace/ChatPanel';
import SourceControlPanel from '@/components/workspace/SourceControlPanel';
import DeploymentPanel from '@/components/workspace/DeploymentPanel';
import FileExplorer from '@/components/workspace/FileExplorer';
import CodeEditor from '@/components/workspace/CodeEditor';
import TerminalPanel from '@/components/workspace/TerminalPanel';
import HitlModal from '@/components/workspace/HitlModal';
import Textarea from '@/components/common/Textarea';
import Button from '@/components/common/Button';

// Register custom node types for React Flow
const nodeTypes = {
  agentNode: AgentNode,
};

/**
 * Workspace — The main execution environment.
 * Assembles the React Flow canvas, floating panels, and the central prompt input.
 */
function Workspace() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const threadId = searchParams.get('thread_id');
  
  // Hydrate history from API instantly on mount if threadId exists
  const { isHydrating } = useThreadHistory(threadId);
  
  // Zustand State
  const nodes = useFlowStore((state) => state.nodes);
  const edges = useFlowStore((state) => state.edges);
  const workflowStatus = useFlowStore((state) => state.workflowStatus);
  const iterationCount = useFlowStore((state) => state.iterationCount);
  const setThreadId = useFlowStore((state) => state.setThreadId);
  const resetCanvas = useFlowStore((state) => state.resetCanvas);

  // WebSocket Hooks
  const { connect, disconnect, sendResume } = useWebSocket();
  const [prompt, setPrompt] = useState('');
  
  // Sidebar State
  const [leftPanelTab, setLeftPanelTab] = useState('chat'); // 'chat' | 'git' | 'deploy'

  // Step 4.3: Session Persistence & Hydration checks on Mount
  useEffect(() => {
    if (threadId) {
      // If URL has a thread_id, save it to Zustand and LocalStorage
      setThreadId(threadId);
      localStorage.setItem('forge_active_thread', threadId);
    } else {
      // If URL is missing thread_id, check LocalStorage to prevent session loss on refresh
      const storedThread = localStorage.getItem('forge_active_thread');
      if (storedThread) {
        console.info('[Workspace] Recovered session from local storage:', storedThread);
        navigate(`/workspace?thread_id=${storedThread}`, { replace: true });
      }
    }
    
    // Cleanup WebSocket on unmount
    return () => disconnect();
  }, [threadId, setThreadId, disconnect, navigate]);

  const handleForge = () => {
    if (!prompt.trim()) return;

    // Preflight Check: Verify LLM Provider and API Key
    const config = useSettingsStore.getState().config;
    let missingKey = false;

    if (config.llmProvider === 'groq' && !config.groqApiKey) missingKey = true;
    if (config.llmProvider === 'openai' && !config.openAIApiKey) missingKey = true;
    if (config.llmProvider === 'anthropic' && !config.anthropicApiKey) missingKey = true;

    if (missingKey) {
      useUIStore.getState().addToast(`Missing API Key for ${config.llmProvider.toUpperCase()}. Please configure it in Workspace Settings.`, 'error');
      useSettingsStore.getState().openSettings();
      return;
    }
    
    // Clear graph state if starting a brand new generation after finishing a previous one
    if (workflowStatus === 'complete' || workflowStatus === 'error') {
       resetCanvas(); 
    }
    
    // Step 4.3: Ensure we have a thread_id before sending the request
    let activeThread = threadId;
    if (!activeThread) {
      activeThread = crypto.randomUUID(); // Native browser API for fast UUIDs
      localStorage.setItem('forge_active_thread', activeThread);
      navigate(`/workspace?thread_id=${activeThread}`, { replace: true });
    }
    
    connect(prompt, activeThread);
    setPrompt('');
  };

  const isRunning = workflowStatus === 'running' || workflowStatus === 'interrupted';

  return (
    <div className="h-screen w-full flex flex-col bg-forge-bg text-forge-text overflow-hidden">
      
      {/* Top Header */}
      <header className="h-14 border-b border-forge-border bg-forge-surface/80 backdrop-blur-md flex items-center justify-between px-6 shrink-0 z-20 shadow-sm">
        <div className="flex items-center gap-3 cursor-pointer group" onClick={() => navigate('/')}>
          <img src="/favicon.jpg" alt="Logo" className="w-6 h-6 rounded object-cover group-hover:scale-105 transition-transform" />
          <h1 className="text-lg font-bold bg-gradient-to-r from-forge-accent to-forge-coder bg-clip-text text-transparent">
            AgenticForge
          </h1>
        </div>
        <div className="flex items-center gap-4">
          {isRunning && (
            <span className="px-2.5 py-1 text-xs rounded-full bg-forge-accent/10 border border-forge-accent/30 text-forge-accent font-medium shadow-sm animate-pulse">
              Iteration {iterationCount}/{MAX_ITERATIONS}
            </span>
          )}
          {threadId && (
            <span className="px-2.5 py-1 text-xs rounded-full bg-forge-surface/60 border border-forge-border text-forge-muted-text font-mono shadow-sm">
              Thread: {threadId.substring(0, 8)}
            </span>
          )}
          <button 
            onClick={() => useSettingsStore.getState().openSettings()}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-zinc-300 hover:text-white rounded-lg transition-all bg-forge-surface border border-forge-border hover:bg-forge-surface/80 hover:shadow-md hover:border-forge-accent/50"
            title="Workspace Settings"
          >
            <Settings size={16} className="text-forge-accent" />
            <span>Settings</span>
          </button>
        </div>
      </header>

      {/* Main Canvas Area */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* Hydration Overlay */}
        {isHydrating && (
          <div className="absolute inset-0 z-50 bg-forge-bg/90 backdrop-blur-md flex flex-col items-center justify-center animate-in fade-in duration-500 pointer-events-auto">
            <Loader2 className="animate-spin text-forge-accent mb-6" size={56} />
            <h3 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-forge-accent to-forge-coder bg-clip-text text-transparent">
              Hydrating Workspace
            </h3>
            <p className="text-forge-muted-text mt-2 font-medium">
              Reconstructing agent memory from the archive...
            </p>
          </div>
        )}

        {/* Error Banner */}
        {workflowStatus === 'error' && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-4 duration-300">
            <div className="glass-card bg-red-900/40 border border-red-500/50 shadow-xl shadow-red-500/10 px-6 py-3 flex items-center gap-3 backdrop-blur-xl rounded-xl">
              <AlertTriangle className="text-red-400 shrink-0" size={20} />
              <div>
                <h3 className="text-sm font-bold text-red-100">Workflow Error</h3>
                <p className="text-xs text-red-200/80">An execution failure occurred. Check the Terminal Panel for logs.</p>
              </div>
            </div>
          </div>
        )}

        {/* Left Sidebar: Activity & Source Control */}
        <div className="absolute left-4 top-4 bottom-24 z-10 pointer-events-none flex h-auto max-h-full">
          {/* Vertical Tab Strip */}
          <div className="w-12 mr-3 flex flex-col gap-3 pointer-events-auto">
            <button 
              onClick={() => setLeftPanelTab('chat')}
              className={`p-3 rounded-xl flex items-center justify-center transition-all shadow-lg border ${
                leftPanelTab === 'chat' 
                  ? 'bg-forge-accent text-white border-forge-accent shadow-forge-accent/20' 
                  : 'bg-forge-surface/80 text-forge-muted-text border-forge-border hover:bg-forge-surface hover:text-white backdrop-blur-md'
              }`}
              title="Agent Activity"
            >
              <MessageSquare size={20} />
            </button>
            <button 
              onClick={() => setLeftPanelTab('git')}
              className={`p-3 rounded-xl flex items-center justify-center transition-all shadow-lg border ${
                leftPanelTab === 'git' 
                  ? 'bg-forge-accent text-white border-forge-accent shadow-forge-accent/20' 
                  : 'bg-forge-surface/80 text-forge-muted-text border-forge-border hover:bg-forge-surface hover:text-white backdrop-blur-md'
              }`}
              title="Source Control"
            >
              <GitBranch size={20} />
            </button>
            <button 
              onClick={() => setLeftPanelTab('deploy')}
              className={`p-3 rounded-xl flex items-center justify-center transition-all shadow-lg border ${
                leftPanelTab === 'deploy' 
                  ? 'bg-forge-accent text-white border-forge-accent shadow-forge-accent/20' 
                  : 'bg-forge-surface/80 text-forge-muted-text border-forge-border hover:bg-forge-surface hover:text-white backdrop-blur-md'
              }`}
              title="Cloud Deployment"
            >
              <Rocket size={20} />
            </button>
          </div>
          
          {/* Active Panel View */}
          <div className="pointer-events-auto h-full">
            {leftPanelTab === 'chat' && <ChatPanel />}
            {leftPanelTab === 'git' && <SourceControlPanel />}
            {leftPanelTab === 'deploy' && <DeploymentPanel />}
          </div>
        </div>

        {/* Center: Interactive React Flow Canvas */}
        <div className="flex-1 w-full h-full pointer-events-auto">
          <ReactFlow 
            nodes={nodes} 
            edges={edges} 
            nodeTypes={nodeTypes}
            fitView
            minZoom={0.5}
            maxZoom={1.5}
            colorMode="dark"
            className="bg-forge-bg"
          >
            <Background color="#2a2a3e" gap={24} size={1.5} />
            <Controls position="bottom-right" className="mb-24 mr-4 border-forge-border fill-forge-text bg-forge-surface" />
          </ReactFlow>
        </div>

        {/* Right Sidebar: Multi-File IDE */}
        <div className="absolute right-4 top-4 bottom-24 z-10 pointer-events-none flex gap-3 h-auto max-h-full">
          <div className="pointer-events-auto h-full hidden xl:block">
            <FileExplorer />
          </div>
          <div className="pointer-events-auto h-full flex flex-col">
            <CodeEditor />
            <TerminalPanel />
          </div>
        </div>
      </div>

      {/* Bottom Prompt Bar */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[700px] z-20">
        <div className="glass-card p-2 flex items-end gap-3 shadow-2xl border-forge-accent/40 bg-forge-surface/95 backdrop-blur-2xl rounded-2xl relative overflow-hidden group">
          
          <div className="absolute inset-0 bg-gradient-to-r from-forge-accent/5 to-forge-coder/5 pointer-events-none" />

          <div className="p-3 text-forge-accent/70 shrink-0">
            <Sparkles size={20} className="animate-pulse" />
          </div>

          <Textarea 
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe the feature or app you want to forge..."
            className="border-none bg-transparent shadow-none focus:ring-0 min-h-[44px] max-h-[150px] !text-base w-full pb-3 placeholder-zinc-500 relative z-10"
            disabled={isRunning}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleForge();
              }
            }}
          />
          <div className="flex gap-2 mb-1.5 mr-1.5 relative z-10 shrink-0">
            {isRunning && (
              <button 
                onClick={() => sendResume(threadId, false, "USER_ABORTED")}
                className="p-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 rounded-xl shadow-lg transition-colors flex items-center justify-center group/stop"
                title="Stop Workflow"
              >
                <XCircle size={20} className="group-hover/stop:scale-110 transition-transform" />
              </button>
            )}
            <Button 
              onClick={handleForge} 
              isLoading={isRunning}
              disabled={!prompt.trim() && !isRunning}
              className={`px-6 py-3 rounded-xl shadow-lg transition-all duration-300 font-bold tracking-wide ${(!prompt.trim() && !isRunning) ? 'opacity-50 cursor-not-allowed' : 'bg-gradient-to-r from-forge-accent to-forge-coder hover:scale-105 hover:shadow-forge-accent/40 border-0 text-white'}`}
            >
              Forge
            </Button>
          </div>
        </div>
      </div>

      {/* Hidden Modals */}
      <HitlModal onSendResume={sendResume} />

    </div>
  );
}

export default Workspace;
