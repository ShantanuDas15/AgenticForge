import { useState, useEffect } from 'react';
import { Copy, CheckCircle2, FileText, FileCode, FileJson } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import useFlowStore from '@/store/useFlowStore';
import DiffEditor from '@/components/workspace/DiffEditor';

/**
 * CodeEditor — Displays the active file's content based on the FileExplorer selection.
 * Supports Markdown rendering for architecture plans and code formatting for generated logic.
 */
function CodeEditor() {
  const currentPlan = useFlowStore((state) => state.currentPlan);
  const workspaceFiles = useFlowStore((state) => state.workspaceFiles);
  const activeFileIndex = useFlowStore((state) => state.activeFileIndex);
  
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState('code'); // 'code' | 'diff'

  // Determine what content to display
  let activeContent = '';
  let isMarkdown = false;
  let activeFilename = '';

  if (activeFileIndex === -1 && currentPlan) {
    activeContent = currentPlan;
    isMarkdown = true;
    activeFilename = 'architecture.md';
  } else if (activeFileIndex >= 0 && workspaceFiles[activeFileIndex]) {
    activeContent = workspaceFiles[activeFileIndex].content;
    activeFilename = workspaceFiles[activeFileIndex].filename;
    isMarkdown = activeFilename.endsWith('.md');
  }

  const handleCopy = async () => {
    if (!activeContent) return;
    try {
      await navigator.clipboard.writeText(activeContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const getFileIcon = (filename) => {
    if (filename.endsWith('.js') || filename.endsWith('.jsx')) return <FileCode size={16} className="text-yellow-400" />;
    if (filename.endsWith('.json')) return <FileJson size={16} className="text-emerald-400" />;
    if (filename.endsWith('.py')) return <FileCode size={16} className="text-blue-400" />;
    if (filename.endsWith('.md')) return <FileText size={16} className="text-purple-400" />;
    return <FileText size={16} className="text-zinc-400" />;
  };

  return (
    <div className="glass-card w-[550px] flex-1 flex flex-col overflow-hidden shadow-2xl transition-all duration-300">
      {/* Editor Header / Tab Bar */}
      <div className="flex items-center justify-between border-b border-forge-border bg-[#0d0d14] px-4 py-2.5 shrink-0">
        
        {/* Active Tab Indicator & View Toggle */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            {activeFilename ? (
              <>
                {getFileIcon(activeFilename)}
                <span className="text-sm font-mono text-forge-text">{activeFilename}</span>
              </>
            ) : (
              <span className="text-sm font-semibold text-forge-muted-text">Editor</span>
            )}
          </div>
          
          {activeFilename && !isMarkdown && (
            <div className="flex items-center bg-black/50 rounded-md p-0.5 border border-forge-border">
              <button 
                onClick={() => setViewMode('code')}
                className={`px-3 py-1 text-xs font-semibold rounded-sm transition-colors ${viewMode === 'code' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                Code
              </button>
              <button 
                onClick={() => setViewMode('diff')}
                className={`px-3 py-1 text-xs font-semibold rounded-sm transition-colors ${viewMode === 'diff' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                Changes
              </button>
            </div>
          )}
        </div>
        
        {/* Actions */}
        <div className="flex items-center">
          <button 
            onClick={handleCopy}
            disabled={!activeContent}
            className="p-1.5 rounded-md text-forge-muted-text hover:bg-forge-surface hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            title="Copy content"
          >
            {copied ? (
              <CheckCircle2 size={16} className="text-forge-reviewer animate-fade-in" />
            ) : (
              <Copy size={16} />
            )}
          </button>
        </div>
      </div>

      {/* Content Display Area */}
      <div className="flex-1 bg-[#0d0d14] overflow-hidden p-4">
        {activeContent ? (
          isMarkdown ? (
            <div className="h-full w-full overflow-auto scroll-smooth prose prose-invert prose-sm max-w-none text-forge-text pr-2 custom-scrollbar">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {activeContent}
              </ReactMarkdown>
            </div>
          ) : viewMode === 'diff' ? (
            <DiffEditor activeFilename={activeFilename} activeContent={activeContent} />
          ) : (
            <pre className="code-surface h-full w-full border-none m-0 bg-transparent p-0 overflow-auto scroll-smooth custom-scrollbar">
              <code className="text-[13px] leading-relaxed block min-h-full">
                {activeContent}
              </code>
            </pre>
          )
        ) : (
          <div className="h-full flex items-center justify-center animate-fade-in">
            <div className="text-center space-y-4 text-forge-muted-text opacity-50">
              <FileCode size={48} className="mx-auto" strokeWidth={1} />
              <p className="text-xs italic leading-relaxed">
                Select a file from the workspace explorer<br/>to view its contents.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default CodeEditor;
