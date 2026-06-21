import { X, AlertTriangle } from 'lucide-react';
import Button from '@/components/common/Button';

export default function ConfirmModal({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirm', isDanger = false, isLoading = false }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="glass-card relative w-full max-w-sm p-6 shadow-2xl border-forge-accent/20 animate-in zoom-in-95 duration-200 bg-forge-bg/95">
        
        <button 
          onClick={onClose}
          disabled={isLoading}
          className="absolute top-4 right-4 text-forge-muted-text hover:text-white bg-forge-surface/50 hover:bg-forge-surface p-1.5 rounded-lg transition-colors"
        >
          <X size={18} />
        </button>

        <div className="flex flex-col items-center text-center mb-6 mt-2">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${isDanger ? 'bg-red-500/10 text-red-500' : 'bg-forge-accent/10 text-forge-accent'}`}>
            <AlertTriangle size={24} />
          </div>
          <h2 className="text-xl font-bold text-forge-text tracking-tight">
            {title}
          </h2>
          <p className="text-sm text-forge-muted-text mt-2 leading-relaxed">
            {message}
          </p>
        </div>

        <div className="flex items-center gap-3 w-full">
          <Button 
            onClick={onClose} 
            disabled={isLoading}
            className="flex-1 py-2.5 bg-forge-surface/40 hover:bg-forge-surface border border-forge-border text-forge-text shadow-none"
          >
            Cancel
          </Button>
          <Button 
            onClick={onConfirm} 
            isLoading={isLoading}
            className={`flex-1 py-2.5 ${isDanger ? 'bg-red-500/80 hover:bg-red-500 text-white shadow-lg shadow-red-500/20' : 'bg-forge-accent hover:bg-forge-accent/90 text-white shadow-lg shadow-forge-accent/20'}`}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}
