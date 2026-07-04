import { useState } from 'react';
import { KeyRound, ShieldCheck, Eye, EyeOff, Trash2, AlertTriangle } from 'lucide-react';
import useUIStore from '@/store/useUIStore';
import useAuthStore from '@/store/useAuthStore';
import apiClient from '@/services/apiClient';
import Button from '@/components/common/Button';
import { API_ROUTES } from '@/config/constants';
import { useNavigate } from 'react-router-dom';

export default function SecurityTab() {
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Account deletion state
  const [showDeleteZone, setShowDeleteZone] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const isDeleteReady = deleteConfirmText === 'DELETE';

  const handleDeleteAccount = async () => {
    if (!isDeleteReady) return;
    setIsDeleting(true);
    try {
      await apiClient.delete(API_ROUTES.USERS.ME);
      useAuthStore.getState().logout();
      useUIStore.getState().addToast('Account permanently deleted.', 'success');
      navigate('/login', { replace: true });
    } catch (err) {
      useUIStore.getState().addToast('Failed to delete account. Please try again.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

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
      if (err.response?.status === 400 || err.response?.status === 401 || err.response?.status === 403) {
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

      {/* ── Danger Zone ──────────────────────────────────────────────── */}
      <div className="mt-10 border border-red-500/20 rounded-xl overflow-hidden">
        <div className="px-6 py-4 bg-red-500/5 border-b border-red-500/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-red-400" />
            <h3 className="text-sm font-bold text-red-400 uppercase tracking-wider">Danger Zone</h3>
          </div>
          {!showDeleteZone && (
            <button
              onClick={() => setShowDeleteZone(true)}
              className="text-xs font-semibold text-red-400/70 hover:text-red-400 border border-red-500/30 hover:border-red-500/60 px-3 py-1.5 rounded-lg transition-all"
            >
              Delete Account
            </button>
          )}
        </div>

        {showDeleteZone && (
          <div className="px-6 py-5 space-y-4 animate-in slide-in-from-top-2 duration-200">
            <div className="flex gap-3">
              <Trash2 size={20} className="text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-forge-text">Permanently delete your account</p>
                <p className="text-xs text-forge-muted-text mt-1 leading-relaxed">
                  This will immediately and irreversibly delete your account, all projects, and all agent history.
                  <strong className="text-red-400"> This action cannot be undone.</strong>
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-forge-muted-text uppercase tracking-wider">
                Type <span className="text-red-400 font-mono">DELETE</span> to confirm
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="DELETE"
                className="w-full max-w-xs bg-zinc-900 border border-red-500/30 rounded-lg py-2.5 px-4 text-forge-text font-mono text-sm focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/50 transition-all placeholder-zinc-600"
              />
            </div>

            <div className="flex items-center gap-3 pt-1">
              <Button
                onClick={handleDeleteAccount}
                isLoading={isDeleting}
                disabled={!isDeleteReady || isDeleting}
                className={`px-6 py-2.5 text-sm transition-all ${
                  isDeleteReady
                    ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/30'
                    : 'bg-red-600/30 text-red-400/50 cursor-not-allowed'
                }`}
              >
                <Trash2 size={14} className="mr-1.5" />
                Delete My Account
              </Button>
              <button
                onClick={() => { setShowDeleteZone(false); setDeleteConfirmText(''); }}
                className="text-sm text-forge-muted-text hover:text-forge-text transition-colors px-3 py-2"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
