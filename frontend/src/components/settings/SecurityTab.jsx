import { useState } from 'react';
import { KeyRound, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import useUIStore from '@/store/useUIStore';
import apiClient from '@/services/apiClient';
import Button from '@/components/common/Button';
import { API_ROUTES } from '@/config/constants';

export default function SecurityTab() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setError('');
    if (!currentPassword || !newPassword || !confirmPassword) {
      return useUIStore.getState().addToast('Please fill all password fields.', 'error');
    }
    if (newPassword !== confirmPassword) {
      return useUIStore.getState().addToast('New passwords do not match.', 'error');
    }
    if (newPassword.length < 8) {
      return useUIStore.getState().addToast('New password must be at least 8 characters.', 'error');
    }

    setIsLoading(true);
    try {
      await apiClient.put(API_ROUTES.USERS.PASSWORD, {
        current_password: currentPassword,
        new_password: newPassword,
      });
      useUIStore.getState().addToast('Password updated successfully.', 'success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        setError(err.response?.data?.detail || 'Incorrect current password.');
      } else {
        useUIStore.getState().addToast(err.response?.data?.detail || 'Failed to update password.', 'error');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-[#12121a] border border-forge-border rounded-xl p-6 shadow-xl animate-in fade-in duration-300 relative overflow-hidden">
      {/* Decorative gradient */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-forge-coder/5 rounded-full blur-[80px] pointer-events-none" />

      <div className="mb-8 border-b border-forge-border/50 pb-5">
        <h2 className="text-xl font-bold text-forge-text flex items-center gap-2">
          <ShieldCheck className="text-forge-coder" size={24} />
          Account Security
        </h2>
        <p className="text-sm text-forge-muted-text mt-1.5 leading-relaxed max-w-2xl">
          Securely manage your account credentials. We recommend rotating your password periodically to maintain optimal security.
        </p>
      </div>

      <form onSubmit={handleUpdatePassword} className="space-y-6 max-w-md">
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-forge-muted-text uppercase tracking-wider">Current Password</label>
          <div className="relative group">
            <div className={`absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none transition-colors ${error ? 'text-red-500' : 'text-zinc-500 group-focus-within:text-forge-coder'}`}>
              <KeyRound size={18} />
            </div>
            <input 
              type={showCurrentPassword ? 'text' : 'password'} 
              value={currentPassword}
              onChange={(e) => {
                setCurrentPassword(e.target.value);
                if (error) setError('');
              }}
              className={`w-full bg-zinc-900 border rounded-lg py-3 pl-11 pr-4 text-forge-text focus:outline-none transition-all ${showCurrentPassword ? '' : 'tracking-widest'} ${error ? 'border-red-500/50 focus:border-red-500 focus:ring-1 focus:ring-red-500' : 'border-forge-border focus:border-forge-coder focus:ring-1 focus:ring-forge-coder'}`}
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowCurrentPassword(!showCurrentPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-500 hover:text-forge-coder transition-colors"
            >
              {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {error && (
            <p className="text-red-400 text-xs font-medium mt-1 animate-in fade-in duration-200">{error}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-forge-muted-text uppercase tracking-wider">New Password</label>
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500 group-focus-within:text-forge-coder">
              <KeyRound size={18} />
            </div>
            <input 
              type={showNewPassword ? 'text' : 'password'} 
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={`w-full bg-zinc-900 border border-forge-border rounded-lg py-3 pl-11 pr-4 text-forge-text focus:outline-none focus:border-forge-coder focus:ring-1 focus:ring-forge-coder transition-all ${showNewPassword ? '' : 'tracking-widest'}`}
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowNewPassword(!showNewPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-500 hover:text-forge-coder transition-colors"
            >
              {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-forge-muted-text uppercase tracking-wider">Confirm New Password</label>
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500 group-focus-within:text-forge-coder">
              <KeyRound size={18} />
            </div>
            <input 
              type={showConfirmPassword ? 'text' : 'password'} 
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={`w-full bg-zinc-900 border border-forge-border rounded-lg py-3 pl-11 pr-4 text-forge-text focus:outline-none focus:border-forge-coder focus:ring-1 focus:ring-forge-coder transition-all ${showConfirmPassword ? '' : 'tracking-widest'}`}
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-500 hover:text-forge-coder transition-colors"
            >
              {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <div className="pt-2">
          <Button type="submit" isLoading={isLoading} className="px-8 py-3 bg-forge-coder hover:bg-emerald-500 text-white shadow-lg shadow-forge-coder/20">
            Update Password
          </Button>
        </div>
      </form>
    </div>
  );
}
