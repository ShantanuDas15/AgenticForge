import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { KeyRound, Lock, ArrowRight, Layers, Eye, EyeOff } from 'lucide-react';
import { z } from 'zod';
import useUIStore from '@/store/useUIStore';
import apiClient from '@/services/apiClient';
import Button from '@/components/common/Button';
import { API_ROUTES } from '@/config/constants';

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Recovery token is required.'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters.'),
  confirmNewPassword: z.string()
}).refine((data) => data.newPassword === data.confirmNewPassword, {
  message: "Passwords do not match",
  path: ["confirmNewPassword"]
});

function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);

  useEffect(() => {
    const urlToken = searchParams.get('token');
    if (urlToken) {
      setToken(urlToken);
    }
  }, [searchParams]);

  const handleInputChange = (field, val, setter) => {
    setter(val);
    if (errors[field]) {
      setErrors((prev) => {
        const updated = { ...prev };
        delete updated[field];
        return updated;
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});

    const validation = resetPasswordSchema.safeParse({ token, newPassword, confirmNewPassword });
    if (!validation.success) {
      const formattedErrors = {};
      validation.error.issues.forEach((issue) => {
        const path = issue.path[0];
        if (!formattedErrors[path]) {
          formattedErrors[path] = issue.message;
        }
      });
      setErrors(formattedErrors);
      useUIStore.getState().addToast('Please correct validation errors before submitting.', 'error');
      return;
    }

    setIsLoading(true);
    try {
      await apiClient.post(API_ROUTES.AUTH.RESET_PASSWORD, { token, new_password: newPassword });
      useUIStore.getState().addToast('Password successfully reset. You can now log in.', 'success');
      navigate('/login');
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Failed to reset password.';
      if (err.response?.status === 422 || msg.toLowerCase().includes('token') || msg.toLowerCase().includes('expired')) {
        setErrors({ token: msg });
      } else {
        useUIStore.getState().addToast(msg, 'error');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const getInputClass = (field) => {
    const baseClass = "w-full bg-[#12121a] border rounded-lg py-3 pl-11 pr-4 text-forge-text focus:outline-none transition-all placeholder-zinc-600";
    if (errors[field]) {
      return `${baseClass} border-red-500/50 focus:border-red-500 focus:ring-1 focus:ring-red-500`;
    }
    return `${baseClass} border-forge-border focus:border-forge-accent focus:ring-1 focus:ring-forge-accent`;
  };

  const getIconWrapperClass = (field) => {
    const base = "absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none transition-colors";
    if (errors[field]) {
      return `${base} text-red-500`;
    }
    return `${base} text-zinc-500 group-focus-within:text-forge-accent`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-forge-bg bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-900 via-forge-bg to-forge-bg p-4 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-forge-accent/20 blur-[130px] rounded-full pointer-events-none mix-blend-screen" />

      <div className="glass-card w-full max-w-md p-8 shadow-2xl relative z-10 border-forge-accent/30 animate-in fade-in zoom-in-95 duration-500">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 bg-forge-surface/50 border border-forge-border rounded-xl flex items-center justify-center shadow-lg mb-4 backdrop-blur-md">
            <Layers className="text-forge-accent" size={28} />
          </div>
          <h1 className="text-2xl font-bold text-forge-text tracking-tight">AgenticForge</h1>
          <p className="text-forge-muted-text text-sm mt-2 text-center max-w-xs">
            Enter your recovery token and a new secure password.
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-forge-muted-text uppercase tracking-wider">Recovery Token</label>
            <div className="relative group">
              <div className={getIconWrapperClass('token')}>
                <KeyRound size={18} />
              </div>
              <input 
                type="text" 
                value={token}
                onChange={(e) => handleInputChange('token', e.target.value, setToken)}
                className={`${getInputClass('token')} font-mono text-sm`}
                placeholder="Paste token here"
              />
            </div>
            {errors.token && (
              <p className="text-red-400 text-xs font-medium mt-1 animate-in fade-in duration-200">{errors.token}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-forge-muted-text uppercase tracking-wider">New Password</label>
            <div className="relative group">
              <div className={getIconWrapperClass('newPassword')}>
                <Lock size={18} />
              </div>
              <input 
                type={showNewPassword ? 'text' : 'password'} 
                value={newPassword}
                onChange={(e) => handleInputChange('newPassword', e.target.value, setNewPassword)}
                className={`${getInputClass('newPassword')} ${showNewPassword ? '' : 'tracking-widest'}`}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-500 hover:text-forge-accent transition-colors"
              >
                {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.newPassword && (
              <p className="text-red-400 text-xs font-medium mt-1 animate-in fade-in duration-200">{errors.newPassword}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-forge-muted-text uppercase tracking-wider">Confirm New Password</label>
            <div className="relative group">
              <div className={getIconWrapperClass('confirmNewPassword')}>
                <Lock size={18} />
              </div>
              <input 
                type={showConfirmNewPassword ? 'text' : 'password'} 
                value={confirmNewPassword}
                onChange={(e) => handleInputChange('confirmNewPassword', e.target.value, setConfirmNewPassword)}
                className={`${getInputClass('confirmNewPassword')} ${showConfirmNewPassword ? '' : 'tracking-widest'}`}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-500 hover:text-forge-accent transition-colors"
              >
                {showConfirmNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.confirmNewPassword && (
              <p className="text-red-400 text-xs font-medium mt-1 animate-in fade-in duration-200">{errors.confirmNewPassword}</p>
            )}
          </div>

          <Button type="submit" isLoading={isLoading} className="w-full py-3.5 mt-2 flex items-center justify-center gap-2 text-base shadow-xl shadow-forge-accent/20">
            Update Password
            {!isLoading && <ArrowRight size={18} strokeWidth={2.5} />}
          </Button>
        </form>

        <div className="mt-8 pt-6 border-t border-forge-border/50 text-center text-sm text-forge-muted-text">
          Remember your password?{' '}
          <button 
            type="button" 
            onClick={() => navigate('/login')}
            className="text-forge-text font-semibold hover:text-forge-accent transition-colors underline decoration-forge-border hover:decoration-forge-accent underline-offset-4"
          >
            Log in
          </button>
        </div>
      </div>
    </div>
  );
}

export default ResetPassword;
