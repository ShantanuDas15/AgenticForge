import { NavLink } from 'react-router-dom';
import { LayoutDashboard, MonitorPlay, Settings, LogOut, Layers } from 'lucide-react';
import useAuthStore from '@/store/useAuthStore';
import useUIStore from '@/store/useUIStore';

function Sidebar() {
  const logout = useAuthStore((state) => state.logout);
  const openSettings = useUIStore((state) => state.openSettings);

  return (
    <aside className="w-16 md:w-64 flex-shrink-0 bg-[#12121a] border-r border-forge-border flex flex-col transition-all duration-300">
      <div className="h-14 flex items-center justify-center md:justify-start md:px-4 border-b border-forge-border shrink-0">
        <Layers className="text-forge-accent w-6 h-6 md:mr-2" />
        <span className="hidden md:block font-bold text-forge-text tracking-tight">AgenticForge</span>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 space-y-2 px-2 custom-scrollbar">
        <NavLink 
          to="/" 
          className={({ isActive }) => `flex items-center justify-center md:justify-start gap-3 px-3 py-2.5 rounded-lg transition-colors ${isActive ? 'bg-forge-accent/10 text-forge-accent' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-white'}`}
          title="Dashboard"
        >
          <LayoutDashboard size={20} />
          <span className="hidden md:block text-sm font-medium">Dashboard</span>
        </NavLink>
        <NavLink 
          to="/workspace" 
          className={({ isActive }) => `flex items-center justify-center md:justify-start gap-3 px-3 py-2.5 rounded-lg transition-colors ${isActive ? 'bg-forge-accent/10 text-forge-accent' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-white'}`}
          title="Workspace"
        >
          <MonitorPlay size={20} />
          <span className="hidden md:block text-sm font-medium">Workspace</span>
        </NavLink>
      </nav>

      <div className="p-2 border-t border-forge-border space-y-2 shrink-0">
        <button 
          onClick={openSettings}
          className="w-full flex items-center justify-center md:justify-start gap-3 px-3 py-2.5 rounded-lg text-zinc-400 hover:bg-zinc-800/50 hover:text-white transition-colors"
          title="Settings"
        >
          <Settings size={20} />
          <span className="hidden md:block text-sm font-medium">Settings</span>
        </button>
        <button 
          onClick={logout}
          className="w-full flex items-center justify-center md:justify-start gap-3 px-3 py-2.5 rounded-lg text-zinc-400 hover:bg-red-500/10 hover:text-red-400 transition-colors"
          title="Log Out"
        >
          <LogOut size={20} />
          <span className="hidden md:block text-sm font-medium">Log Out</span>
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
