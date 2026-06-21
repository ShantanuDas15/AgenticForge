import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Layers, ArrowLeft, CreditCard, Activity, User as UserIcon, Shield, Edit2, Check, X, Link2 } from 'lucide-react';
import useAuthStore from '@/store/useAuthStore';
import useSettingsStore from '@/store/useSettingsStore';
import useUIStore from '@/store/useUIStore';
import apiClient from '@/services/apiClient';
import UsageChart from '@/components/settings/UsageChart';
import BillingTab from '@/components/settings/BillingTab';
import SecurityTab from '@/components/settings/SecurityTab';
import IntegrationsTab from '@/components/settings/IntegrationsTab';
import ConfirmModal from '@/components/common/ConfirmModal';
import { API_ROUTES } from '@/config/constants';

/**
 * Settings — The global SaaS configuration dashboard covering User Profile, Billing, and Usage.
 */
function Settings() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const user = useAuthStore((state) => state.user);
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const isLoading = useAuthStore((state) => state.isLoading);
  const llmProvider = useSettingsStore((state) => state.llmProvider);
  
  const [activeTab, setActiveTab] = useState('billing'); // 'billing' | 'usage'
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState(user?.name || '');

  useEffect(() => {
    useSettingsStore.getState().initialize();
    
    const upgrade = searchParams.get('upgrade');
    const github = searchParams.get('github');
    let hasParams = false;

    if (upgrade === 'success') {
      useUIStore.getState().addToast('Subscription successfully upgraded!', 'success');
      setActiveTab('billing');
      hasParams = true;
    } else if (upgrade === 'canceled') {
      useUIStore.getState().addToast('Subscription upgrade canceled.', 'info');
      setActiveTab('billing');
      hasParams = true;
    }

    if (github === 'success') {
      useUIStore.getState().addToast('GitHub successfully connected!', 'success');
      setActiveTab('integrations');
      hasParams = true;
    } else if (github === 'error') {
      useUIStore.getState().addToast('Failed to connect GitHub. Please try again.', 'error');
      setActiveTab('integrations');
      hasParams = true;
    }

    if (hasParams) {
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      useUIStore.getState().addToast('Name cannot be empty.', 'error');
      return;
    }
    const success = await updateProfile(editName);
    if (success) {
      setIsEditingProfile(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      await apiClient.delete(API_ROUTES.USERS.ME);
      useAuthStore.getState().logout();
      navigate('/login');
    } catch (err) {
      useUIStore.getState().addToast('Failed to delete account.', 'error');
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  return (
    <div className="min-h-screen bg-forge-bg bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-900/50 via-forge-bg to-forge-bg text-forge-text flex flex-col">
      {/* Top App Header */}
      <header className="h-16 border-b border-forge-border bg-forge-surface/80 backdrop-blur-md flex items-center justify-between px-8 sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/')}
            className="px-3 py-1.5 -ml-3 text-zinc-400 hover:text-white hover:bg-forge-surface rounded-lg transition-colors flex items-center gap-2"
          >
            <ArrowLeft size={16} />
            <span className="text-sm font-semibold">Back to Dashboard</span>
          </button>
        </div>
        <div className="flex items-center gap-3">
          <Layers className="text-forge-accent" size={24} />
          <h1 className="text-lg font-bold tracking-wide bg-gradient-to-r from-forge-accent to-forge-coder bg-clip-text text-transparent">
            AgenticForge
          </h1>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-8 animate-in fade-in duration-500">
        
        {/* Profile Summary Block */}
        <div className="flex items-center gap-6 mb-10 pb-10 border-b border-forge-border/50">
          <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-forge-accent/20 to-forge-accent/5 border border-forge-accent/30 flex items-center justify-center shadow-inner shrink-0">
            <UserIcon size={40} className="text-forge-accent" />
          </div>
          <div className="flex-1">
            {isEditingProfile ? (
              <div className="flex items-center gap-3 mb-2">
                <input 
                  type="text" 
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="bg-[#12121a] border border-forge-accent rounded-lg py-1.5 px-3 text-white focus:outline-none text-xl font-bold max-w-[250px]"
                  autoFocus
                />
                <button 
                  onClick={handleSaveProfile}
                  disabled={isLoading}
                  className="p-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-md transition-colors"
                >
                  <Check size={18} />
                </button>
                <button 
                  onClick={() => { setIsEditingProfile(false); setEditName(user?.name || ''); }}
                  className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-md transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 mb-1">
                <h2 className="text-3xl font-bold text-white tracking-tight">{user?.name || 'Architect'}</h2>
                <button 
                  onClick={() => setIsEditingProfile(true)}
                  className="p-1.5 text-zinc-500 hover:text-forge-accent hover:bg-forge-accent/10 rounded-md transition-all"
                  title="Edit Profile"
                >
                  <Edit2 size={16} />
                </button>
              </div>
            )}
            <div className="flex items-center gap-3 mt-1">
              <p className="text-sm text-forge-muted-text font-mono">{user?.email || 'architect@agenticforge.com'}</p>
              <div className="px-2 py-0.5 rounded bg-forge-surface border border-forge-border flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-forge-coder animate-pulse" />
                <span className="text-xs font-bold text-forge-muted-text uppercase tracking-wider">Engine:</span>
                <span className="text-xs font-bold text-forge-text capitalize">{llmProvider}</span>
              </div>
            </div>
            {user?.created_at && (
              <p className="text-xs text-zinc-500 mt-2 font-medium">Member since: {new Date(user.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            )}
          </div>
        </div>

        {/* Tab Navigation Menu */}
        <div className="flex gap-2 mb-8">
          <button
            onClick={() => setActiveTab('billing')}
            className={`px-6 py-3 rounded-lg text-sm font-bold transition-all flex items-center gap-2 tracking-wide ${
              activeTab === 'billing' 
                ? 'bg-[#12121a] border border-forge-border text-white shadow-lg' 
                : 'text-zinc-500 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <CreditCard size={16} /> Billing & Subscription
          </button>
          <button
            onClick={() => setActiveTab('usage')}
            className={`px-6 py-3 rounded-lg text-sm font-bold transition-all flex items-center gap-2 tracking-wide ${
              activeTab === 'usage' 
                ? 'bg-[#12121a] border border-forge-border text-white shadow-lg' 
                : 'text-zinc-500 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <Activity size={16} /> API Token Usage
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`px-6 py-3 rounded-lg text-sm font-bold transition-all flex items-center gap-2 tracking-wide ${
              activeTab === 'security' 
                ? 'bg-[#12121a] border border-forge-border text-white shadow-lg' 
                : 'text-zinc-500 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <Shield size={16} /> Security
          </button>
          <button
            onClick={() => setActiveTab('integrations')}
            className={`px-6 py-3 rounded-lg text-sm font-bold transition-all flex items-center gap-2 tracking-wide ${
              activeTab === 'integrations' 
                ? 'bg-[#12121a] border border-forge-border text-white shadow-lg' 
                : 'text-zinc-500 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <Link2 size={16} /> Integrations
          </button>
        </div>

        {/* Tab Content Renderer */}
        <div className="animate-in slide-in-from-bottom-4 duration-300">
          {activeTab === 'billing' && <BillingTab />}
          {activeTab === 'usage' && <UsageChart />}
          {activeTab === 'security' && <SecurityTab />}
          {activeTab === 'integrations' && <IntegrationsTab />}
        </div>

        {/* Danger Zone */}
        <div className="mt-16 pt-8 border-t border-red-900/30">
          <h3 className="text-lg font-bold text-red-400 mb-2">Danger Zone</h3>
          <p className="text-sm text-zinc-500 mb-6">Permanently delete your account and all associated projects and settings. This action cannot be undone.</p>
          <button 
            onClick={() => setShowDeleteModal(true)}
            disabled={isDeleting}
            className="px-6 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 hover:border-red-500/40 font-bold rounded-lg transition-all"
          >
            Delete Account
          </button>
        </div>
      </main>

      <ConfirmModal 
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteAccount}
        title="Delete Account"
        message="Are you absolutely sure you want to delete your account? All data, projects, and configurations will be lost forever."
        confirmText="Delete Account"
        isDanger={true}
        isLoading={isDeleting}
      />
    </div>
  );
}

export default Settings;
