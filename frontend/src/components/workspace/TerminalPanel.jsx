import { useEffect, useRef } from 'react';
import { Terminal } from 'lucide-react';
import useFlowStore from '@/store/useFlowStore';

/**
 * TerminalPanel — A secure execution output window.
 * Slides up from the bottom when sandbox execution logs are present.
 */
function TerminalPanel() {
  const sandboxLogs = useFlowStore((state) => state.sandboxLogs);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [sandboxLogs]);

  return (
    <div className="glass-card w-[550px] h-[250px] shrink-0 flex flex-col overflow-hidden shadow-2xl mt-3 animate-in slide-in-from-bottom-4 duration-300">
      {/* Terminal Header */}
      <div className="flex items-center gap-2 border-b border-forge-border bg-black px-4 py-2 shrink-0">
        <Terminal size={14} className="text-forge-accent" />
        <h3 className="text-[11px] font-bold text-forge-muted-text uppercase tracking-widest">Execution Sandbox</h3>
      </div>
      
      {/* Console Output */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 bg-black font-mono text-[13px] leading-relaxed custom-scrollbar text-green-400 relative"
      >
        {sandboxLogs.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-600 space-y-2 select-none text-center">
            <Terminal size={32} />
            <p className="text-xs font-bold text-zinc-500">Sandbox output will appear here during code generation</p>
          </div>
        ) : (
          <>
            {sandboxLogs.map((log, index) => (
              <div key={index} className="whitespace-pre-wrap break-words mb-1">
                <span className="text-zinc-600 mr-3 select-none">[{new Date(log.timestamp).toLocaleTimeString([], { hour12: false })}]</span>
                {log.message}
              </div>
            ))}
            {/* Blinking cursor effect for immersion */}
            <div className="animate-pulse inline-block w-2 h-4 bg-green-400 align-middle ml-1"></div>
          </>
        )}
      </div>
    </div>
  );
}

export default TerminalPanel;
