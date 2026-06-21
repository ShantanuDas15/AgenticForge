import { X, AlertCircle, CheckCircle2, Info, AlertTriangle } from 'lucide-react';
import useUIStore from '@/store/useUIStore';

/**
 * ToastContainer — Renders all active toasts in the top-right corner.
 * Should be mounted once in App.jsx.
 */
export function ToastContainer() {
  const toasts = useUIStore((state) => state.toasts);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} />
      ))}
    </div>
  );
}

function Toast({ toast }) {
  const removeToast = useUIStore((state) => state.removeToast);

  const getStyle = () => {
    switch (toast.type) {
      case 'error': return 'bg-red-500/10 border-red-500/30 text-red-400 shadow-red-500/10';
      case 'success': return 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-emerald-500/10';
      case 'warning': return 'bg-amber-500/10 border-amber-500/30 text-amber-400 shadow-amber-500/10';
      default: return 'bg-blue-500/10 border-blue-500/30 text-blue-400 shadow-blue-500/10';
    }
  };

  const getIcon = () => {
    switch (toast.type) {
      case 'error': return <AlertCircle size={20} />;
      case 'success': return <CheckCircle2 size={20} />;
      case 'warning': return <AlertTriangle size={20} />;
      default: return <Info size={20} />;
    }
  };

  return (
    <div className={`flex items-start gap-3 px-4 py-3 rounded-lg border shadow-xl backdrop-blur-xl w-[350px] animate-fade-in pointer-events-auto transition-all ${getStyle()}`}>
      <div className="shrink-0 mt-0.5">{getIcon()}</div>
      <p className="flex-1 text-sm font-medium leading-relaxed">{toast.message}</p>
      <button 
        onClick={() => removeToast(toast.id)}
        className="shrink-0 opacity-60 hover:opacity-100 transition-opacity p-1 -mt-1 -mr-1 rounded-md hover:bg-white/10"
      >
        <X size={16} />
      </button>
    </div>
  );
}
