import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layers, Mail, Lock, User, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { z } from 'zod';
import useAuthStore from '@/store/useAuthStore';
import useUIStore from '@/store/useUIStore';
import Button from '@/components/common/Button';
import ForgotPasswordModal from '@/components/layout/ForgotPasswordModal';

// Client-side schema validation matching Pydantic backend models
const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Email address is required')
    .email('Invalid email address format'),
  password: z
    .string()
    .min(1, 'Password is required'),
});

const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name must not exceed 50 characters'),
  email: z
    .string()
    .trim()
    .min(1, 'Email address is required')
    .email('Invalid email address format'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

/**
 * Login — The authentication gateway for AgenticForge.
 * Features a sleek glassmorphic design and handles both Login/Registration.
 */
function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [errors, setErrors] = useState({});
  const [showForgotPwd, setShowForgotPwd] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const navigate = useNavigate();
  const { login, register, isLoading } = useAuthStore();

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

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setName('');
    setErrors({});
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});

    const formData = isLogin ? { email, password } : { email, password, name, confirmPassword };
    const schema = isLogin ? loginSchema : registerSchema;

    const validation = schema.safeParse(formData);

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

    if (isLogin) {
      const success = await login(email, password);
      if (success) navigate('/'); // Route to dashboard on success
    } else {
      const result = await register(email, password, name);
      if (result?.success) {
        navigate('/');
      } else if (result?.error && result.error.includes('[USER_ALREADY_EXISTS]')) {
         setErrors({ email: 'An account with this email address already exists.' });
      }
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
      
      {/* Decorative background blur to add that premium AI aesthetic */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-forge-accent/20 blur-[130px] rounded-full pointer-events-none mix-blend-screen" />

      <div className="glass-card w-full max-w-md p-8 shadow-2xl relative z-10 border-forge-accent/30 animate-in fade-in zoom-in-95 duration-500">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 bg-forge-surface/50 border border-forge-border rounded-xl flex items-center justify-center shadow-lg mb-4 backdrop-blur-md">
            <Layers className="text-forge-accent" size={28} />
          </div>
          <h1 className="text-2xl font-bold text-forge-text tracking-tight">AgenticForge</h1>
          <p className="text-forge-muted-text text-sm mt-2 text-center max-w-xs">
            {isLogin ? 'Sign in to access your multi-agent architecture studio.' : 'Provision your workspace environment.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          {!isLogin && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-forge-muted-text uppercase tracking-wider">Full Name</label>
              <div className="relative group">
                <div className={getIconWrapperClass('name')}>
                  <User size={18} />
                </div>
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => handleInputChange('name', e.target.value, setName)}
                  className={getInputClass('name')}
                  placeholder="Senior Architect"
                />
              </div>
              {errors.name && (
                <p className="text-red-400 text-xs font-medium mt-1 animate-in fade-in duration-200">{errors.name}</p>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-forge-muted-text uppercase tracking-wider">Email Address</label>
            <div className="relative group">
              <div className={getIconWrapperClass('email')}>
                <Mail size={18} />
              </div>
              <input 
                type="email" 
                value={email}
                onChange={(e) => handleInputChange('email', e.target.value, setEmail)}
                className={getInputClass('email')}
                placeholder="architect@domain.com"
              />
            </div>
            {errors.email && (
              <p className="text-red-400 text-xs font-medium mt-1 animate-in fade-in duration-200">{errors.email}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-forge-muted-text uppercase tracking-wider">Password</label>
              {isLogin && (
                <button 
                  type="button" 
                  onClick={() => setShowForgotPwd(true)}
                  className="text-xs font-medium text-forge-accent hover:text-purple-400 transition-colors"
                >
                  Forgot password?
                </button>
              )}
            </div>
            <div className="relative group">
              <div className={getIconWrapperClass('password')}>
                <Lock size={18} />
              </div>
              <input 
                type={showPassword ? 'text' : 'password'} 
                value={password}
                onChange={(e) => handleInputChange('password', e.target.value, setPassword)}
                className={`${getInputClass('password')} ${showPassword ? '' : 'tracking-widest'}`}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-500 hover:text-forge-accent transition-colors"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.password && (
              <p className="text-red-400 text-xs font-medium mt-1 animate-in fade-in duration-200">{errors.password}</p>
            )}
          </div>

          {!isLogin && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-forge-muted-text uppercase tracking-wider">Confirm Password</label>
              <div className="relative group">
                <div className={getIconWrapperClass('confirmPassword')}>
                  <Lock size={18} />
                </div>
                <input 
                  type={showConfirmPassword ? 'text' : 'password'} 
                  value={confirmPassword}
                  onChange={(e) => handleInputChange('confirmPassword', e.target.value, setConfirmPassword)}
                  className={`${getInputClass('confirmPassword')} ${showConfirmPassword ? '' : 'tracking-widest'}`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-500 hover:text-forge-accent transition-colors"
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-red-400 text-xs font-medium mt-1 animate-in fade-in duration-200">{errors.confirmPassword}</p>
              )}
            </div>
          )}

          <Button type="submit" isLoading={isLoading} className="w-full py-3.5 mt-2 flex items-center justify-center gap-2 text-base shadow-xl shadow-forge-accent/20">
            {isLogin ? 'Initialize Session' : 'Create Account'}
            {!isLoading && <ArrowRight size={18} strokeWidth={2.5} />}
          </Button>
        </form>

        <div className="mt-8 pt-6 border-t border-forge-border/50 text-center text-sm text-forge-muted-text">
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button 
            type="button" 
            onClick={toggleMode}
            className="text-forge-text font-semibold hover:text-forge-accent transition-colors underline decoration-forge-border hover:decoration-forge-accent underline-offset-4"
          >
            {isLogin ? 'Sign up' : 'Log in'}
          </button>
        </div>
      </div>
      
      <ForgotPasswordModal isOpen={showForgotPwd} onClose={() => setShowForgotPwd(false)} />
    </div>
  );
}

export default Login;
