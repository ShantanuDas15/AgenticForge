import { useState, useEffect } from 'react';
import { Github, Link } from 'lucide-react';
import useUIStore from '@/store/useUIStore';
import useSettingsStore from '@/store/useSettingsStore';
import apiClient from '@/services/apiClient';
import Button from '@/components/common/Button';
import { API_ROUTES } from '@/config/constants';

export default function IntegrationsTab() {
  const [isLoading, setIsLoading] = useState(false);
  const hasGithubToken = useSettingsStore((state) => state.hasGithubToken);

  useEffect(() => {
    useSettingsStore.getState().initialize();
  }, []);

  const handleConnectGitHub = async () => {
    setIsLoading(true);
    try {
      const { data } = await apiClient.get(API_ROUTES.GIT.GITHUB_LOGIN);
      if (data && data.url) {
        window.location.href = data.url;
      } else {
        useUIStore.getState().addToast('Invalid response from GitHub login endpoint.', 'error');
        setIsLoading(false);
      }
    } catch (err) {
      useUIStore.getState().addToast(err.response?.data?.detail || 'Failed to initiate GitHub OAuth flow.', 'error');
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-[#12121a] border border-forge-border rounded-xl p-6 shadow-xl animate-in fade-in duration-300 relative overflow-hidden">
      {/* Decorative gradient */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/5 rounded-full blur-[80px] pointer-events-none" />

      <div className="mb-8 border-b border-forge-border/50 pb-5">
        <h2 className="text-xl font-bold text-forge-text flex items-center gap-2">
          <Link className="text-purple-400" size={24} />
          Integrations
        </h2>
        <p className="text-sm text-forge-muted-text mt-1.5 leading-relaxed max-w-2xl">
          Connect your AgenticForge workspace with external tools and services to supercharge your workflow.
        </p>
      </div>

      <div className="space-y-6 max-w-2xl">
        <div className="flex items-center justify-between p-5 bg-zinc-900 border border-forge-border rounded-lg">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center">
              <Github size={24} className="text-white" />
            </div>
            <div>
              <h3 className="text-white font-bold">GitHub</h3>
              <p className="text-sm text-zinc-400 mt-0.5">Commit code directly to your repositories from the workspace.</p>
            </div>
          </div>
          <Button 
            onClick={hasGithubToken ? undefined : handleConnectGitHub} 
            isLoading={isLoading && !hasGithubToken}
            disabled={hasGithubToken}
            className={`px-6 py-2 shadow-lg ${hasGithubToken ? 'bg-zinc-800 text-zinc-400 cursor-not-allowed shadow-none border border-forge-border' : 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-600/20'}`}
          >
            {hasGithubToken ? 'Connected' : 'Connect'}
          </Button>
        </div>
      </div>
    </div>
  );
}
