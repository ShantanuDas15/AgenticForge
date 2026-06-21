import { FileCode, FileJson, FileText, ChevronRight, FolderOpen } from 'lucide-react';
import useFlowStore from '@/store/useFlowStore';

/**
 * FileExplorer — Hierarchical sidebar for navigating multi-file workspaces.
 */
function FileExplorer() {
  const workspaceFiles = useFlowStore((state) => state.workspaceFiles);
  const currentPlan = useFlowStore((state) => state.currentPlan);
  const activeFileIndex = useFlowStore((state) => state.activeFileIndex);
  const setActiveFileIndex = useFlowStore((state) => state.setActiveFileIndex);

  const getFileIcon = (filename) => {
    if (filename.endsWith('.js') || filename.endsWith('.jsx')) return <FileCode size={16} className="text-yellow-400" />;
    if (filename.endsWith('.json')) return <FileJson size={16} className="text-emerald-400" />;
    if (filename.endsWith('.py')) return <FileCode size={16} className="text-blue-400" />;
    if (filename.endsWith('.css')) return <FileCode size={16} className="text-pink-400" />;
    return <FileText size={16} className="text-zinc-400" />;
  };

  return (
    <div className="glass-card w-[220px] h-full flex flex-col overflow-hidden shadow-2xl">
      <div className="flex items-center gap-2 border-b border-forge-border bg-forge-surface/40 px-4 py-3 shrink-0">
        <FolderOpen size={16} className="text-forge-accent" />
        <h3 className="text-xs font-bold text-forge-text uppercase tracking-wider">Workspace</h3>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
        <ul className="space-y-1">
          {/* Architecture Plan */}
          {currentPlan && (
            <li>
              <button
                onClick={() => setActiveFileIndex(-1)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                  activeFileIndex === -1 
                    ? 'bg-forge-accent/10 text-forge-accent font-semibold' 
                    : 'text-forge-muted-text hover:text-forge-text hover:bg-forge-surface/50'
                }`}
              >
                <ChevronRight size={14} className={`transition-transform ${activeFileIndex === -1 ? 'rotate-90 text-forge-accent' : 'opacity-0'}`} />
                <FileText size={16} className={activeFileIndex === -1 ? "text-forge-accent" : "text-purple-400"} />
                <span className="truncate">architecture.md</span>
              </button>
            </li>
          )}

          {/* Generated Code Files */}
          {workspaceFiles.length === 0 && !currentPlan ? (
            <div className="p-4 text-center text-xs text-forge-muted-text italic">
              Awaiting agent generation...
            </div>
          ) : (
            workspaceFiles.map((file, index) => {
              const isActive = index === activeFileIndex;
              return (
                <li key={file.filename}>
                  <button
                    onClick={() => setActiveFileIndex(index)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                      isActive 
                        ? 'bg-forge-accent/10 text-forge-accent font-semibold' 
                        : 'text-forge-muted-text hover:text-forge-text hover:bg-forge-surface/50'
                    }`}
                  >
                    <ChevronRight size={14} className={`transition-transform ${isActive ? 'rotate-90 text-forge-accent' : 'opacity-0'}`} />
                    {getFileIcon(file.filename)}
                    <span className="truncate">{file.filename}</span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}

export default FileExplorer;
