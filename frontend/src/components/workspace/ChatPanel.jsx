import { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import useFlowStore from '@/store/useFlowStore';

/**
 * ChatPanel — Displays the live internal monologue and system events.
 * Sits as a sidebar panel and auto-scrolls to the latest message.
 */
function ChatPanel() {
  const agentLogs = useFlowStore((state) => state.agentLogs);
  const endOfMessagesRef = useRef(null);

  // Auto-scroll to bottom whenever a new log is pushed to the array
  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [agentLogs]);

  // Utility to format ISO timestamp to HH:MM:SS
  const formatTime = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  };

  return (
    <div className="glass-card w-80 h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-forge-border bg-forge-surface/40 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-forge-accent animate-pulse-slow"></span>
        <h2 className="text-sm font-bold text-forge-text uppercase tracking-wider">
          Live Stream
        </h2>
      </div>

      {/* Log Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {agentLogs.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-xs text-forge-muted-text italic">
              Awaiting instructions...
            </p>
          </div>
        ) : (
          agentLogs.map((log, index) => {
            const isSystem = log.node === 'system';
            
            // Define styling for feedback logs
            const isFeedback = log.isFeedback;
            const isApproved = log.status === 'approved';
            let headerColor = 'text-forge-accent';
            if (isSystem) headerColor = 'text-forge-muted-text';
            else if (isFeedback) headerColor = isApproved ? 'text-green-400' : 'text-red-400';

            return (
              <div 
                key={index} 
                className={`flex flex-col animate-fade-in ${isSystem ? 'opacity-70' : ''}`}
              >
                <div className="flex items-baseline justify-between mb-1">
                  <span className={`text-xs font-bold uppercase tracking-wider ${headerColor}`}>
                    {log.node}
                  </span>
                  <span className="text-[10px] text-forge-muted-text font-mono">
                    {formatTime(log.timestamp)}
                  </span>
                </div>
                <div className={`text-sm leading-relaxed break-words prose prose-invert prose-sm max-w-none ${
                  isSystem ? 'text-forge-muted-text italic' : 
                  isFeedback ? (isApproved ? 'text-green-300 bg-green-900/20 p-3 rounded border border-green-800/50' : 'text-red-300 bg-red-900/20 p-3 rounded border border-red-800/50') : 'text-forge-text'
                }`}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {log.message}
                  </ReactMarkdown>
                </div>
                {log.state?.tokens_consumed > 0 && (
                  <div className="mt-2 flex items-center gap-1.5 text-[10px] font-mono text-zinc-500 bg-zinc-900/50 w-fit px-2 py-0.5 rounded border border-zinc-800">
                    <span className="text-forge-accent text-[11px]">⚡</span>
                    {log.state.tokens_consumed > 1000 ? `${(log.state.tokens_consumed / 1000).toFixed(1)}k` : log.state.tokens_consumed} tokens
                  </div>
                )}
              </div>
            );
          })
        )}
        
        {/* Invisible anchor element for auto-scroll targeting */}
        <div ref={endOfMessagesRef} className="h-px w-full shrink-0" />
      </div>
    </div>
  );
}

export default ChatPanel;
