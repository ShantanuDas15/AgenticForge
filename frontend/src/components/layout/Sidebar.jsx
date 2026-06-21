import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, MonitorPlay, Settings, LogOut, ChevronLeft } from 'lucide-react';
import useAuthStore from '@/store/useAuthStore';
import useUIStore from '@/store/useUIStore';

function Sidebar() {
  const logout = useAuthStore((state) => state.logout);
  const [isCollapsed, setIsCollapsed] = useState(() => localStorage.getItem('forge_sidebar_collapsed') === 'true');

  const toggleSidebar = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem('forge_sidebar_collapsed', String(newState));
  };

  return (
    <aside className={`flex-shrink-0 bg-[#12121a] border-r border-forge-border flex flex-col transition-all duration-300 relative ${isCollapsed ? 'w-16' : 'w-16 md:w-64'}`}>
      
      {/* Collapse Toggle Button - Only visible on desktop */}
      <button 
        onClick={toggleSidebar}
        className="hidden md:flex absolute -right-3 top-6 bg-[#12121a] border border-forge-border rounded-full p-1 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors z-50 shadow-md"
        title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
      >
        <ChevronLeft size={14} className={`transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`} />
      </button>

      <div className={`h-14 flex items-center justify-center md:px-4 border-b border-forge-border shrink-0 ${isCollapsed ? 'md:justify-center' : 'md:justify-start'}`}>
        <img src="/favicon.jpg" alt="Logo" className={`w-6 h-6 rounded object-cover ${!isCollapsed ? 'md:mr-2' : ''}`} />
        {!isCollapsed && <span className="hidden md:block font-bold text-forge-text tracking-tight animate-in fade-in duration-300">AgenticForge</span>}
      </div>

      <nav className="flex-1 overflow-y-auto py-4 space-y-2 px-2 custom-scrollbar overflow-x-hidden">
        <NavLink 
          to="/" 
          className={({ isActive }) => `flex items-center justify-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${!isCollapsed ? 'md:justify-start' : ''} ${isActive ? 'bg-forge-accent/10 text-forge-accent' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-white'}`}
          title="Dashboard"
        >
          <LayoutDashboard size={20} className="shrink-0" />
          {!isCollapsed && <span className="hidden md:block text-sm font-medium animate-in fade-in duration-300 whitespace-nowrap">Dashboard</span>}
        </NavLink>
        <NavLink 
          to="/workspace" 
          className={({ isActive }) => `flex items-center justify-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${!isCollapsed ? 'md:justify-start' : ''} ${isActive ? 'bg-forge-accent/10 text-forge-accent' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-white'}`}
          title="Workspace"
        >
          <MonitorPlay size={20} className="shrink-0" />
          {!isCollapsed && <span className="hidden md:block text-sm font-medium animate-in fade-in duration-300 whitespace-nowrap">Workspace</span>}
        </NavLink>
      </nav>

      <div className="p-2 border-t border-forge-border space-y-2 shrink-0 overflow-x-hidden">
        <NavLink 
          to="/account-billing"
          className={({ isActive }) => `w-full flex items-center justify-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${!isCollapsed ? 'md:justify-start' : ''} ${isActive ? 'bg-forge-accent/10 text-forge-accent' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-white'}`}
          title="Account Settings"
        >
          <Settings size={20} className="shrink-0" />
          {!isCollapsed && <span className="hidden md:block text-sm font-medium animate-in fade-in duration-300 whitespace-nowrap">Settings</span>}
        </NavLink>
        <button 
          onClick={() => logout()}
          className={`w-full flex items-center justify-center gap-3 px-3 py-2.5 rounded-lg text-zinc-400 hover:bg-red-500/10 hover:text-red-400 transition-colors ${!isCollapsed ? 'md:justify-start' : ''}`}
          title="Log Out"
        >
          <LogOut size={20} className="shrink-0" />
          {!isCollapsed && <span className="hidden md:block text-sm font-medium animate-in fade-in duration-300 whitespace-nowrap">Log Out</span>}
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
