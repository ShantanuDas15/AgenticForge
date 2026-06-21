import { Rocket, Cloud, CheckCircle2, ExternalLink, Loader2, AlertCircle } from 'lucide-react';
import useDeploymentStore from '@/store/useDeploymentStore';
import useFlowStore from '@/store/useFlowStore';
import useAuthStore from '@/store/useAuthStore';
import Button from '@/components/common/Button';
import { useNavigate } from 'react-router-dom';

/**
 * DeploymentPanel — A sidebar UI for shipping generated applications to Edge networks in one click.
 */
function DeploymentPanel() {
  const { status, provider, liveUrl, message, error, isMock, setProvider, deploy, reset } = useDeploymentStore();
  const workspaceFiles = useFlowStore((state) => state.workspaceFiles);
  const tier = useAuthStore((state) => state.tier);
  const isPro = tier === 'pro_architect' || tier === 'Pro Architect';
  const navigate = useNavigate();

  const handleDeploy = () => {
    deploy(workspaceFiles, provider);
  };

  const isDeploying = status === 'building' || status === 'deploying';

  if (!isPro) {
    return (
      <div className="glass-card w-[350px] h-full flex flex-col overflow-hidden shadow-2xl items-center justify-center p-6 text-center animate-in slide-in-from-left-4 duration-300">
        <Rocket size={48} className="text-zinc-600 mb-4" />
        <h3 className="text-lg font-bold text-white mb-2">Pro Feature</h3>
        <p className="text-sm text-forge-muted-text mb-6">
          Cloud Deployment requires an active subscription tier.
        </p>
        <Button onClick={() => navigate('/account-billing?tab=billing')} className="w-full py-2.5 shadow-lg shadow-forge-accent/20">
          Upgrade to Pro Architect
        </Button>
      </div>
    );
  }

  return (
    <div className="glass-card w-[350px] h-full flex flex-col overflow-hidden shadow-2xl animate-in slide-in-from-left-4 duration-300">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-forge-border bg-forge-surface/40 px-4 py-3 shrink-0">
        <Rocket size={16} className="text-forge-accent" />
        <h3 className="text-xs font-bold text-forge-text uppercase tracking-wider">Cloud Deployment</h3>
      </div>

      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-6">
        
        {/* Provider Selection */}
        <div className="space-y-3">
          <label className="text-xs font-semibold text-forge-muted-text">Hosting Provider</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setProvider('vercel')}
              className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                provider === 'vercel' 
                  ? 'bg-zinc-800/80 border-forge-accent shadow-[0_0_15px_rgba(168,85,247,0.15)] text-white' 
                  : 'bg-[#12121a] border-forge-border text-zinc-500 hover:border-zinc-700'
              }`}
            >
              <Cloud size={26} className={provider === 'vercel' ? 'text-forge-accent' : ''} />
              <span className="text-xs font-bold tracking-wide">Vercel</span>
            </button>
            <button
              onClick={() => setProvider('netlify')}
              className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                provider === 'netlify' 
                  ? 'bg-zinc-800/80 border-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.15)] text-white' 
                  : 'bg-[#12121a] border-forge-border text-zinc-500 hover:border-zinc-700'
              }`}
            >
              <Cloud size={26} className={provider === 'netlify' ? 'text-emerald-400' : ''} />
              <span className="text-xs font-bold tracking-wide">Netlify</span>
            </button>
          </div>
        </div>

        {/* Dynamic Status Indicator */}
        <div className="bg-[#12121a] border border-forge-border rounded-xl p-6 min-h-[160px] flex flex-col items-center justify-center text-center space-y-3 relative overflow-hidden shadow-inner">
          
          {status === 'idle' && (
            <div className="animate-in fade-in duration-500 flex flex-col items-center">
              <Rocket size={36} className="text-zinc-600 mb-3" strokeWidth={1.5} />
              <p className="text-xs text-forge-muted-text max-w-[200px] leading-relaxed">
                Ready to deploy your AI-forged application to the global edge network.
              </p>
            </div>
          )}

          {isDeploying && (
            <div className="flex flex-col items-center space-y-5 animate-in fade-in zoom-in duration-500">
              <div className="relative flex items-center justify-center">
                <div className="absolute w-14 h-14 border-2 border-forge-accent/30 rounded-full animate-ping"></div>
                <Loader2 size={36} className="text-forge-accent animate-spin" />
              </div>
              <div className="space-y-1.5">
                <p className="text-sm font-bold text-forge-text tracking-wide">
                  {status === 'building' ? 'Compiling Assets...' : 'Pushing to Edge...'}
                </p>
                <p className="text-[11px] text-forge-muted-text font-mono uppercase tracking-widest">
                  {status === 'building' ? '[1/2] Bundling workspace' : '[2/2] Allocating URL'}
                </p>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="animate-in fade-in zoom-in-95 duration-300 flex flex-col items-center">
              <AlertCircle size={36} className="text-red-400 mb-3" />
              <p className="text-sm font-bold text-red-400">Deployment Failed</p>
              <p className="text-xs text-forge-muted-text mt-1">{error || 'An unknown compilation error occurred.'}</p>
            </div>
          )}

          {status === 'live' && (
            <div className="flex flex-col items-center space-y-4 animate-in fade-in zoom-in-95 duration-500">
              <div className="w-14 h-14 bg-green-400/10 rounded-full flex items-center justify-center relative">
                {isMock && (
                  <span className="absolute -top-1 -right-2 bg-amber-500 text-black text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-lg border border-amber-400 uppercase">Demo Mode</span>
                )}
                <CheckCircle2 size={28} className="text-green-400" />
              </div>
              <div className="space-y-2 w-full px-2 flex flex-col items-center">
                <p className="text-sm font-bold text-white tracking-wide">Deployment Successful!</p>
                {message && (
                  <div className={`w-full text-[11px] font-medium leading-relaxed p-2 rounded-lg border ${isMock ? 'bg-amber-500/10 border-amber-500/30 text-amber-200' : 'bg-zinc-800/50 border-zinc-700/50 text-zinc-400'}`}>
                    {isMock ? (
                      <div className="flex items-start justify-center gap-1.5 text-left">
                        <AlertCircle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                        <span>{message}</span>
                      </div>
                    ) : (
                      message
                    )}
                  </div>
                )}
                <div className="flex flex-col items-center gap-2 mt-2 w-full">
                  <a 
                    href={liveUrl} 
                    target="_blank" 
                    rel="noreferrer"
                    className="flex items-center justify-center gap-1.5 text-xs text-forge-accent hover:text-white font-mono bg-forge-accent/15 hover:bg-forge-accent px-4 py-2 rounded-lg transition-colors border border-forge-accent/30 shadow-lg shadow-forge-accent/10"
                  >
                    {liveUrl.replace('https://', '')}
                    <ExternalLink size={14} />
                  </a>
                  {isMock && (
                    <span className="bg-amber-500/10 text-amber-500 border border-amber-500/30 text-[10px] font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 uppercase tracking-wide">
                      <AlertCircle size={12} /> Demo Mode — Configure Token
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Action Footer */}
      <div className="p-4 border-t border-forge-border bg-forge-surface/20 shrink-0">
        {status === 'live' || status === 'error' ? (
          <Button onClick={reset} className="w-full py-3 bg-zinc-700 hover:bg-zinc-600 text-sm">
            Deploy New Version
          </Button>
        ) : (
          <Button 
            onClick={handleDeploy} 
            isLoading={isDeploying} 
            disabled={workspaceFiles.length === 0}
            className="w-full py-3 flex items-center justify-center gap-2 shadow-xl shadow-forge-accent/10 text-sm"
          >
            <Rocket size={18} />
            Deploy to {provider === 'vercel' ? 'Vercel' : 'Netlify'}
          </Button>
        )}
      </div>
    </div>
  );
}

export default DeploymentPanel;
