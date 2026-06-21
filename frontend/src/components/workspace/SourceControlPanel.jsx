import { useState } from 'react';
import { GitCommit, GitBranch, Check, ExternalLink } from 'lucide-react';
import useFlowStore from '@/store/useFlowStore';
import useUIStore from '@/store/useUIStore';
import { gitService } from '@/services/gitService';
import useAuthStore from '@/store/useAuthStore';
import Button from '@/components/common/Button';
import Textarea from '@/components/common/Textarea';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import useSettingsStore from '@/store/useSettingsStore';

const gitCommitSchema = z.object({
  repoName: z.string().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/, 'Target Repository must be in "owner/repo" format.'),
  commitMessage: z.string().min(1, 'Commit message is required.')
});

/**
 * SourceControlPanel — A sidebar panel for committing generated code to a GitHub repo.
 */
function SourceControlPanel() {
  const workspaceFiles = useFlowStore((state) => state.workspaceFiles);
  const threadId = useFlowStore((state) => state.threadId);
  const tier = useAuthStore((state) => state.tier);
  const isPro = tier === 'pro_architect' || tier === 'Pro Architect';
  const hasGithubToken = useSettingsStore((state) => state.hasGithubToken);
  const navigate = useNavigate();
  
  const [repoName, setRepoName] = useState('agentic-forge/demo-app');
  const [commitMessage, setCommitMessage] = useState('');
  const [isCommitting, setIsCommitting] = useState(false);
  const [commitUrl, setCommitUrl] = useState(null);

  const handleCommit = async () => {
    const validation = gitCommitSchema.safeParse({ repoName, commitMessage });
    if (!validation.success) {
      useUIStore.getState().addToast(validation.error.issues[0].message, 'error');
      return;
    }

    setIsCommitting(true);
    setCommitUrl(null); // Reset URL on new commit
    try {
      const data = await gitService.commitAndPush(repoName, commitMessage, workspaceFiles, threadId);
      useUIStore.getState().addToast(`Successfully pushed to ${repoName}!`, 'success');
      setCommitUrl(data.commit_url);
      setCommitMessage('');
    } catch (err) {
      useUIStore.getState().addToast(err.message || 'Failed to push to GitHub.', 'error');
    } finally {
      setIsCommitting(false);
    }
  };

  if (!isPro) {
    return (
      <div className="glass-card w-[350px] h-full flex flex-col overflow-hidden shadow-2xl items-center justify-center p-6 text-center animate-in slide-in-from-left-4 duration-300">
        <GitBranch size={48} className="text-zinc-600 mb-4" />
        <h3 className="text-lg font-bold text-white mb-2">Pro Feature</h3>
        <p className="text-sm text-forge-muted-text mb-6">
          Source Control integration requires an active subscription tier.
        </p>
        <Button onClick={() => navigate('/settings?tab=billing')} className="w-full py-2.5 shadow-lg shadow-forge-accent/20">
          Upgrade to Pro Architect
        </Button>
      </div>
    );
  }

  if (!hasGithubToken) {
    return (
      <div className="glass-card w-[350px] h-full flex flex-col overflow-hidden shadow-2xl items-center justify-center p-6 text-center animate-in slide-in-from-left-4 duration-300">
        <GitBranch size={48} className="text-zinc-600 mb-4" />
        <h3 className="text-lg font-bold text-white mb-2">GitHub Not Connected</h3>
        <p className="text-sm text-forge-muted-text mb-6">
          GitHub account not connected. Please connect your GitHub account in Workspace Settings to enable source control.
        </p>
        <Button onClick={() => useSettingsStore.getState().openSettings()} className="w-full py-2.5 shadow-lg shadow-forge-accent/20">
          Open Settings
        </Button>
      </div>
    );
  }

  return (
    <div className="glass-card w-[350px] h-full flex flex-col overflow-hidden shadow-2xl animate-in slide-in-from-left-4 duration-300">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-forge-border bg-forge-surface/40 px-4 py-3 shrink-0">
        <GitBranch size={16} className="text-forge-accent" />
        <h3 className="text-xs font-bold text-forge-text uppercase tracking-wider">Source Control</h3>
      </div>

      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-5">
        
        {/* Repo Target */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-forge-muted-text">Target Repository</label>
          <input 
            type="text" 
            value={repoName}
            onChange={(e) => setRepoName(e.target.value)}
            className="w-full bg-[#12121a] border border-forge-border rounded-lg py-2.5 px-3 text-sm text-forge-text focus:outline-none focus:border-forge-accent transition-all font-mono"
            placeholder="username/repo"
          />
        </div>

        {/* Changes List */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-forge-muted-text flex justify-between">
            <span>Staged Changes</span>
            <span className="bg-forge-accent/20 text-forge-accent px-1.5 rounded-sm">{workspaceFiles.length}</span>
          </label>
          <div className="bg-[#12121a] border border-forge-border rounded-lg overflow-hidden">
            {workspaceFiles.length === 0 ? (
              <div className="p-4 text-xs text-forge-muted-text italic text-center opacity-70">
                Awaiting code generation to commit.
              </div>
            ) : (
              <ul className="max-h-[160px] overflow-y-auto custom-scrollbar">
                {workspaceFiles.map(file => (
                  <li key={file.filename} className="flex items-center gap-2 px-3 py-2 border-b border-forge-border/50 last:border-0 text-sm hover:bg-forge-surface/30 transition-colors">
                    <Check size={14} className="text-forge-accent" />
                    <span className="text-forge-text truncate">{file.filename}</span>
                    <span className="ml-auto text-[10px] font-bold uppercase text-green-400 bg-green-400/10 px-1 rounded">M</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Commit Input */}
        <div className="space-y-1.5 flex-1 flex flex-col">
          <label className="text-xs font-semibold text-forge-muted-text">Commit Message</label>
          <Textarea 
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            placeholder="feat: implemented multi-agent generated logic"
            className="w-full text-sm flex-1 min-h-[90px]"
          />
        </div>

      </div>

      {/* Action Footer */}
      <div className="p-4 border-t border-forge-border bg-forge-surface/20 shrink-0 space-y-3">
        {commitUrl && (
          <a
            href={commitUrl}
            target="_blank"
            rel="noreferrer"
            className="w-full py-2.5 flex items-center justify-center gap-2 bg-[#12121a] hover:bg-zinc-800/80 text-forge-accent text-sm font-medium rounded-lg transition-colors border border-forge-accent/30 shadow-[0_0_15px_rgba(168,85,247,0.1)]"
          >
            <ExternalLink size={16} />
            <span>View Commit <span className="font-mono text-xs ml-1 opacity-80">{commitUrl.split('/').pop().substring(0, 7)}</span></span>
          </a>
        )}
        <Button 
          onClick={handleCommit} 
          isLoading={isCommitting} 
          disabled={workspaceFiles.length === 0 || !commitMessage.trim()}
          className="w-full py-3 flex items-center justify-center gap-2 shadow-lg"
        >
          <GitCommit size={18} />
          Commit & Push
        </Button>
      </div>
    </div>
  );
}

export default SourceControlPanel;
