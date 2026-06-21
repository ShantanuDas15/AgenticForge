import { useState } from 'react';
import { X, Mail, KeyRound, CheckCircle2, ArrowRight } from 'lucide-react';
import useUIStore from '@/store/useUIStore';
import apiClient from '@/services/apiClient';
import Button from '@/components/common/Button';
import { z } from 'zod';
import { API_ROUTES } from '@/config/constants';

const forgotPasswordSchema = z.object({
  email: z.string().min(1, 'Email is required.').email('Invalid email address format.')
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Recovery token is required.'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters.')
});

export default function ForgotPasswordModal({ isOpen, onClose }) {
  const [step, setStep] = useState(1); // 1: Email, 2: Token+New Password, 3: Success
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleRequestReset = async (e) => {
    e.preventDefault();
    const validation = forgotPasswordSchema.safeParse({ email });
    if (!validation.success) {
      return useUIStore.getState().addToast(validation.error.issues[0].message, 'error');
    }
    
    setIsLoading(true);
    try {
      await apiClient.post(API_ROUTES.AUTH.FORGOT_PASSWORD, { email });
      useUIStore.getState().addToast('Reset link sent!', 'success');
      
      setStep(2);
    } catch (err) {
      useUIStore.getState().addToast('Failed to request password reset.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    const validation = resetPasswordSchema.safeParse({ token, newPassword });
    if (!validation.success) {
      return useUIStore.getState().addToast(validation.error.issues[0].message, 'error');
    }
    
    setIsLoading(true);
    try {
      await apiClient.post(API_ROUTES.AUTH.RESET_PASSWORD, { token, new_password: newPassword });
      useUIStore.getState().addToast('Password successfully reset.', 'success');
      setStep(3);
    } catch (err) {
      useUIStore.getState().addToast(err.response?.data?.detail || 'Failed to reset password.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const resetAndClose = () => {
    setStep(1);
    setEmail('');
    setToken('');
    setNewPassword('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="glass-card relative w-full max-w-md p-6 shadow-2xl border-forge-accent/20 animate-in zoom-in-95 duration-200 bg-forge-bg/95">
        
        <button 
          onClick={resetAndClose}
          className="absolute top-4 right-4 text-forge-muted-text hover:text-white bg-forge-surface/50 hover:bg-forge-surface p-1.5 rounded-lg transition-colors"
        >
          <X size={18} />
        </button>

        <div className="mb-6">
          <h2 className="text-xl font-bold text-forge-text flex items-center gap-2">
            <KeyRound className="text-forge-accent" /> Account Recovery
          </h2>
          <p className="text-sm text-forge-muted-text mt-2">
            {step === 1 && "Enter your email address to receive a secure password reset link."}
            {step === 2 && "Enter your recovery token and a new secure password."}
            {step === 3 && "Your password has been successfully reset."}
          </p>
        </div>

        {step === 1 && (
          <form onSubmit={handleRequestReset} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-forge-muted-text uppercase tracking-wider">Email Address</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500 group-focus-within:text-forge-accent">
                  <Mail size={18} />
                </div>
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#12121a] border border-forge-border rounded-lg py-3 pl-11 pr-4 text-forge-text focus:outline-none focus:border-forge-accent focus:ring-1 focus:ring-forge-accent transition-all"
                  placeholder="architect@domain.com"
                />
              </div>
            </div>
            <Button type="submit" isLoading={isLoading} className="w-full py-3 mt-2 flex items-center justify-center gap-2">
              Send Reset Link <ArrowRight size={16} />
            </Button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-forge-muted-text uppercase tracking-wider">Recovery Token</label>
              <input 
                type="text" 
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="w-full bg-[#12121a] border border-forge-border rounded-lg py-3 px-4 text-forge-text focus:outline-none focus:border-forge-accent focus:ring-1 focus:ring-forge-accent transition-all font-mono text-sm"
                placeholder="Paste token here"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-forge-muted-text uppercase tracking-wider">New Password</label>
              <input 
                type="password" 
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-[#12121a] border border-forge-border rounded-lg py-3 px-4 text-forge-text focus:outline-none focus:border-forge-accent focus:ring-1 focus:ring-forge-accent transition-all tracking-widest"
                placeholder="••••••••"
              />
            </div>
            <Button type="submit" isLoading={isLoading} className="w-full py-3 mt-2">
              Update Password
            </Button>
          </form>
        )}

        {step === 3 && (
          <div className="flex flex-col items-center py-6 text-center">
            <CheckCircle2 size={48} className="text-emerald-400 mb-4" />
            <h3 className="text-lg font-bold text-white mb-2">Password Updated!</h3>
            <p className="text-zinc-400 text-sm mb-6">You can now safely log in with your new credentials.</p>
            <Button onClick={resetAndClose} className="w-full py-3">
              Back to Login
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
