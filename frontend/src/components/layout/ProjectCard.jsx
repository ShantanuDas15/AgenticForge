import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Clock, Terminal, Database, Trash2, ExternalLink, Zap } from 'lucide-react';
import { useState } from 'react';
import useProjectStore from '@/store/useProjectStore';
import ConfirmModal from '@/components/common/ConfirmModal';

/**
 * ProjectCard — Displays a summary of a past generation on the Dashboard.
 */
function ProjectCard({ project }) {
  const navigate = useNavigate();
  const deleteProject = useProjectStore((state) => state.deleteProject);
  const getProject = useProjectStore((state) => state.getProject);
  const [showConfirm, setShowConfirm] = useState(false);

  const { id, thread_id, user_prompt, iterations_taken, created_at, total_tokens } = project;

  const handleInspect = () => {
    getProject(id);
  };

  const handleResume = (e) => {
    e.stopPropagation(); // Prevent triggering the card's inspect click
    navigate(`/workspace?thread_id=${thread_id}`);
  };

  const handleDeleteClick = (e) => {
    e.stopPropagation(); // Prevent triggering the card's inspect click
    setShowConfirm(true);
  };

  const handleConfirmDelete = () => {
    deleteProject(id);
    setShowConfirm(false);
  };

  // Format the date safely
  const formattedDate = created_at ? new Date(created_at).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }) : 'Unknown Date';

  return (
    <div 
      onClick={handleInspect}
      className="bg-zinc-900/40 border border-zinc-800/60 p-5 rounded-xl hover:bg-zinc-900 hover:border-forge-accent/40 transition-all group flex flex-col gap-4 shadow-sm cursor-pointer relative duration-300"
    >
      {/* Top Bar */}
      <div className="flex items-center justify-between text-xs text-zinc-400">
        <div className="flex items-center gap-1.5 text-emerald-400/90 font-medium bg-emerald-400/10 px-2 py-0.5 rounded-full">
          <CheckCircle2 size={14} />
          <span>Complete</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock size={14} />
          <span>{formattedDate}</span>
        </div>
      </div>

      {/* Body: Prompt */}
      <div className="flex-1">
        <p className="text-sm text-zinc-300 line-clamp-3 group-hover:text-indigo-100 transition-colors leading-relaxed">
          {user_prompt || 'No prompt provided.'}
        </p>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-2 pt-4 border-t border-zinc-800/50">
        <div className="flex items-center gap-4 text-xs text-zinc-500">
          <div className="flex items-center gap-1.5" title="Iterations Taken">
            <Terminal size={14} />
            <span>{iterations_taken || 1} turns</span>
          </div>
          <div className="flex items-center gap-1.5" title="Tokens Consumed">
            <Zap size={14} />
            <span>{total_tokens > 1000 ? `${(total_tokens / 1000).toFixed(1)}k` : (total_tokens || 0)} tokens</span>
          </div>
          <div className="flex items-center gap-1.5" title="Cached State Available">
            <Database size={14} />
            <span>Cached</span>
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="flex items-center gap-1">
          <button 
            onClick={handleResume}
            className="text-zinc-500 hover:text-forge-accent transition-colors p-1.5 rounded-md hover:bg-forge-accent/10"
            title="Resume in Workspace"
          >
            <ExternalLink size={16} />
          </button>
          <button 
            onClick={handleDeleteClick}
            className="text-zinc-600 hover:text-red-400 transition-colors p-1.5 rounded-md hover:bg-red-400/10"
            title="Delete Project"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <ConfirmModal 
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Project"
        message="Are you sure you want to delete this project? This action cannot be undone."
        confirmText="Delete Project"
        isDanger={true}
      />
    </div>
  );
}

export default ProjectCard;
