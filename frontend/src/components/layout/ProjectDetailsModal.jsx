import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Terminal, FileText, Code, Copy, Check, ExternalLink, Clock, Zap } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import useProjectStore from '@/store/useProjectStore';
import Button from '@/components/common/Button';

/**
 * ProjectDetailsModal — Read-only modal displaying generated plan and code from a historical project.
 */
function ProjectDetailsModal() {
  const navigate = useNavigate();
  const { selectedProject, clearSelectedProject } = useProjectStore();
  const [activeTab, setActiveTab] = useState('plan'); // 'plan' | 'code'
  const [copied, setCopied] = useState(false);

  if (!selectedProject) return null;

  const { thread_id, user_prompt, final_plan, final_code, iterations_taken, created_at, total_tokens } = selectedProject;

  const handleCopy = async () => {
    if (final_code) {
      try {
        await navigator.clipboard.writeText(final_code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy code: ', err);
      }
    }
  };

  const handleResume = () => {
    clearSelectedProject();
    navigate(`/workspace?thread_id=${thread_id}`);
  };

  // Format the date safely
  const formattedDate = created_at ? new Date(created_at).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }) : 'Unknown Date';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 md:p-10 pointer-events-auto animate-in fade-in duration-200">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={clearSelectedProject}
      />
      
      {/* Modal Surface */}
      <div className="glass-card relative z-10 w-full max-w-4xl h-[85vh] flex flex-col shadow-2xl border-forge-accent/20 animate-in zoom-in-95 duration-200 bg-forge-bg/95">
        
        {/* Header */}
        <div className="p-6 border-b border-forge-border/60 flex items-start justify-between gap-4 shrink-0 bg-forge-surface/30">
          <div className="space-y-1.5 flex-1 min-w-0">
            <h2 className="text-xl font-bold tracking-tight text-forge-text flex items-center gap-2">
              <Terminal className="text-forge-accent shrink-0" size={20} />
              <span>Project Inspection</span>
              <span className="text-xs text-zinc-500 font-mono font-normal bg-zinc-800/40 px-2.5 py-0.5 rounded-full border border-zinc-700/30">ID: {selectedProject.id}</span>
            </h2>
            <div className="text-sm text-forge-muted-text italic bg-forge-bg/60 p-3 rounded-lg border border-forge-border/40 font-medium max-h-20 overflow-y-auto mt-2 select-text leading-relaxed">
              "{user_prompt || 'No prompt provided.'}"
            </div>
          </div>
          <button 
            onClick={clearSelectedProject}
            className="text-forge-muted-text hover:text-white bg-forge-surface/50 hover:bg-forge-surface p-1.5 rounded-lg transition-colors shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="px-6 border-b border-forge-border/60 bg-forge-surface/10 shrink-0 flex items-center justify-between">
          <div className="flex gap-1 pt-2">
            <button
              onClick={() => setActiveTab('plan')}
              className={`px-4 py-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all ${
                activeTab === 'plan'
                  ? 'border-forge-accent text-forge-accent bg-forge-accent/5'
                  : 'border-transparent text-forge-muted-text hover:text-forge-text'
              }`}
            >
              <FileText size={16} />
              <span>Architectural Plan</span>
            </button>
            <button
              onClick={() => setActiveTab('code')}
              className={`px-4 py-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all ${
                activeTab === 'code'
                  ? 'border-forge-accent text-forge-accent bg-forge-accent/5'
                  : 'border-transparent text-forge-muted-text hover:text-forge-text'
              }`}
            >
              <Code size={16} />
              <span>Generated Code</span>
            </button>
          </div>

          {activeTab === 'code' && final_code && (
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md text-forge-muted-text hover:text-white hover:bg-forge-surface transition-all"
              title="Copy Code"
            >
              {copied ? (
                <>
                  <Check size={14} className="text-forge-reviewer animate-fade-in" />
                  <span className="text-forge-reviewer">Copied</span>
                </>
              ) : (
                <>
                  <Copy size={14} />
                  <span>Copy Code</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Tab Content (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-6 bg-[#09090d]">
          {activeTab === 'plan' ? (
            final_plan ? (
              <div className="prose prose-invert prose-sm max-w-none text-forge-text select-text pr-2 leading-relaxed custom-scrollbar">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{final_plan}</ReactMarkdown>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-zinc-500 py-12">
                <FileText size={42} className="opacity-30 mb-3" />
                <p className="italic text-sm">No architectural plan was saved for this project.</p>
              </div>
            )
          ) : (
            final_code ? (
              <pre className="code-surface h-full w-full border-none m-0 bg-transparent p-0 overflow-auto scroll-smooth select-text pr-2 custom-scrollbar">
                <code className="text-[13px] leading-relaxed block font-mono font-medium text-emerald-300">
                  {final_code}
                </code>
              </pre>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-zinc-500 py-12">
                <Code size={42} className="opacity-30 mb-3" />
                <p className="italic text-sm">No generated code was saved for this project.</p>
              </div>
            )
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-forge-border/60 bg-forge-surface/30 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-zinc-500 font-medium">
            <div className="flex items-center gap-1.5">
              <Clock size={14} />
              <span>Generated on {formattedDate}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Terminal size={14} />
              <span>Completed in {iterations_taken || 1} turns</span>
            </div>
            <div className="flex items-center gap-1.5 text-forge-accent/80">
              <Zap size={14} />
              <span>{total_tokens > 1000 ? `${(total_tokens / 1000).toFixed(1)}k` : (total_tokens || 0)} Tokens Consumed</span>
            </div>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              onClick={clearSelectedProject}
              className="px-5 py-2.5 rounded-lg border border-forge-border text-forge-muted-text hover:text-white hover:bg-forge-surface/50 transition-colors text-sm font-semibold w-full sm:w-auto text-center"
            >
              Close
            </button>
            <Button
              onClick={handleResume}
              className="px-5 py-2.5 flex items-center justify-center gap-2 text-sm shadow-xl shadow-forge-accent/20 w-full sm:w-auto"
            >
              <ExternalLink size={16} />
              <span>Resume in Workspace</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProjectDetailsModal;
