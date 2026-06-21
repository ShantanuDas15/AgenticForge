import useAuthStore from '@/store/useAuthStore';
import { UserCircle } from 'lucide-react';

function Header() {
  const user = useAuthStore((state) => state.user);
  const tier = useAuthStore((state) => state.tier);

  return (
    <header className="h-14 flex-shrink-0 bg-[#12121a] border-b border-forge-border px-6 flex items-center justify-between transition-all duration-300">
      <div className="flex items-center gap-2">
        {/* Placeholder for future breadcrumbs or contextual actions */}
      </div>

      <div className="flex items-center gap-4">
        <div className="flex flex-col items-end hidden md:flex">
          <span className="text-sm font-bold text-forge-text">{user?.name || 'Developer'}</span>
          <span className="text-[10px] text-forge-accent font-mono uppercase tracking-wider">{tier || 'Free Developer'}</span>
        </div>
        <div className="w-8 h-8 rounded-full bg-forge-surface/50 border border-forge-border flex items-center justify-center shadow-inner cursor-default">
          <UserCircle size={20} className="text-zinc-400" />
        </div>
      </div>
    </header>
  );
}

export default Header;
