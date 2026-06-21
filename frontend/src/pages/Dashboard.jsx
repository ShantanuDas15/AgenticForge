import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { History, Layers, Plus, Loader2, LogOut, Settings as SettingsIcon, User } from 'lucide-react';
import useProjectStore from '@/store/useProjectStore';
import useFlowStore from '@/store/useFlowStore';
import useAuthStore from '@/store/useAuthStore';
import useSettingsStore from '@/store/useSettingsStore';
import ProjectCard from '@/components/layout/ProjectCard';
import ProjectDetailsModal from '@/components/layout/ProjectDetailsModal';
import { useHealthCheck } from '@/hooks/useHealthCheck';

/**
 * Dashboard — Displays the project history grid and allows creating new projects.
 */
function Dashboard() {
  const navigate = useNavigate();
  const { projects, isLoading, error, fetchProjects, hasMore } = useProjectStore();
  const isHealthy = useHealthCheck(30000); // Check API health every 30s
  const isActive = useAuthStore((state) => state.isActive);
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    fetchProjects(true);
  }, [fetchProjects]);

  const handleNewProject = () => {
    // Step 4.3: Session Isolation
    // Clear any persisted thread from localStorage so we get a clean slate
    localStorage.removeItem('forge_active_thread');
    // Reset the Zustand flow store to ensure the visual canvas is empty
    useFlowStore.getState().resetCanvas();
    
    navigate('/workspace');
  };

  return (
    <div className="min-h-screen flex flex-col bg-forge-bg text-forge-text">
      
      {/* Global App Header (Dashboard Context) */}
      <header className="h-16 border-b border-forge-border bg-forge-surface/80 backdrop-blur-md flex items-center justify-between px-8 shrink-0 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Layers className="text-forge-accent" size={26} />
          <h1 className="text-xl font-bold tracking-wide bg-gradient-to-r from-forge-accent to-forge-coder bg-clip-text text-transparent">
            AgenticForge
          </h1>
          {/* Subtle health status connectivity badge */}
          <div className="flex items-center gap-1.5 ml-3 bg-zinc-900/60 border border-forge-border/40 px-2.5 py-1 rounded-full text-[10px] font-bold select-none transition-all duration-300">
            <span className={`w-1.5 h-1.5 rounded-full ${isHealthy ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
            <span className={isHealthy ? 'text-emerald-400/90' : 'text-rose-400/90'}>
              {isHealthy ? 'System Online' : 'System Offline'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-3 mr-4 border-r border-forge-border/60 pr-5">
            <div className="w-9 h-9 rounded-full bg-forge-accent/20 border border-forge-accent/30 flex items-center justify-center text-forge-accent shadow-inner">
              <User size={18} />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-forge-text tracking-wide">{user?.name || 'Architect'}</span>
              <span className="text-[11px] font-mono text-forge-muted-text/70">{user?.email || 'admin@agenticforge.local'}</span>
            </div>
          </div>
          <button 
            onClick={() => navigate('/settings')}
            className="p-2 text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
            title="Account & Billing"
          >
            <User size={20} />
          </button>
          <button 
            onClick={() => useSettingsStore.getState().openSettings()}
            className="p-2 text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
            title="Workspace Settings"
          >
            <SettingsIcon size={20} />
          </button>
          <button 
            onClick={() => useAuthStore.getState().logout()}
            className="p-2 text-zinc-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
            title="End Session"
          >
            <LogOut size={20} />
          </button>
          <button 
            onClick={handleNewProject}
            disabled={!isActive}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold transition-all shadow-lg ${
              isActive 
                ? 'bg-forge-accent hover:bg-purple-500 text-white shadow-forge-accent/20 active:scale-95' 
                : 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700/50'
            }`}
          >
            <Plus size={18} strokeWidth={2.5} />
            New Project
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-8 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-900/40 via-zinc-950 to-zinc-950">
        
        <div className="max-w-7xl mx-auto">
          {/* Suspended Banner */}
          {!isActive && (
            <div className="bg-amber-500/10 border border-amber-500/20 text-amber-500 p-4 rounded-xl mb-8 flex items-center gap-3">
              <span className="font-bold uppercase tracking-wider text-sm bg-amber-500/20 px-2 py-1 rounded">Account Suspended</span> 
              <span className="text-sm">Your account is currently inactive. Please visit the Settings page to reactivate or upgrade your tier to resume code generation.</span>
            </div>
          )}

          {/* Section Header */}
          <div className="flex items-center gap-3 mb-8 pb-4 border-b border-zinc-800/50">
            <History className="text-zinc-400" size={24} />
            <h2 className="text-2xl font-bold text-zinc-100 tracking-tight">Project History</h2>
          </div>

          {/* Error State */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-lg mb-6 flex items-center gap-2">
              <span className="font-bold">Error:</span> {error}
            </div>
          )}

          {/* Grid Section */}
          {isLoading && projects.length === 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-in fade-in duration-500">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="animate-pulse bg-zinc-900/40 border border-zinc-800/40 p-5 rounded-xl h-[180px] flex flex-col gap-4">
                  <div className="flex justify-between">
                    <div className="h-5 w-24 bg-zinc-800 rounded-full"></div>
                    <div className="h-5 w-20 bg-zinc-800 rounded-full"></div>
                  </div>
                  <div className="space-y-2 mt-2">
                    <div className="h-4 bg-zinc-800 rounded w-full"></div>
                    <div className="h-4 bg-zinc-800 rounded w-5/6"></div>
                  </div>
                  <div className="mt-auto pt-4 border-t border-zinc-800/50 flex justify-between">
                    <div className="h-4 w-16 bg-zinc-800 rounded"></div>
                    <div className="h-4 w-16 bg-zinc-800 rounded"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 bg-zinc-900/20 border border-zinc-800/50 rounded-2xl border-dashed">
              <History className="text-zinc-700 mb-6" size={56} />
              <p className="text-zinc-300 text-xl font-semibold mb-2">No projects found in the archive.</p>
              <p className="text-zinc-500 text-sm">Click the "New Project" button above to start your first session.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {projects.map((project) => (
                  <ProjectCard key={project.id} project={project} />
                ))}
              </div>
              
              {hasMore && (
                <div className="flex justify-center mt-12 mb-8">
                  <button 
                    onClick={() => fetchProjects()}
                    disabled={isLoading}
                    className="px-6 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold rounded-full shadow-lg border border-zinc-700/50 transition-all"
                  >
                    {isLoading ? 'Loading...' : 'Load More Projects'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Historical Project Inspection Modal */}
      <ProjectDetailsModal />
    </div>
  );
}

export default Dashboard;
