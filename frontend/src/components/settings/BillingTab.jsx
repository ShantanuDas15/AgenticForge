import { useState, useEffect } from 'react';
import { CheckCircle2, Zap } from 'lucide-react';
import apiClient from '@/services/apiClient';
import useUIStore from '@/store/useUIStore';
import useAuthStore from '@/store/useAuthStore';
import Button from '@/components/common/Button';
import ConfirmModal from '@/components/common/ConfirmModal';
import { API_ROUTES } from '@/config/constants';

/**
 * BillingTab — Displays the user's current subscription tier and an upgrade path.
 */
function BillingTab() {
  const [tier, setTier] = useState('Loading...');
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [isDowngrading, setIsDowngrading] = useState(false);
  const [showDowngradeModal, setShowDowngradeModal] = useState(false);

  useEffect(() => {
    const isUpgradeSuccess = new URLSearchParams(window.location.search).get('upgrade') === 'success';

    const fetchStatus = async (attempt = 0) => {
      try {
        const { data } = await apiClient.get(API_ROUTES.BILLING.STATUS);
        const isPro = data.subscription_tier === 'pro_architect' || data.subscription_tier === 'Pro Architect';
        
        if (isUpgradeSuccess && !isPro && attempt < 3) {
          const delay = (attempt + 1) * 1000; // 1s, 2s, 3s
          setTimeout(() => fetchStatus(attempt + 1), delay);
          return;
        }

        setTier(data.subscription_tier);
        useAuthStore.getState().setTier(data.subscription_tier);
        useAuthStore.getState().setIsActive(data.is_active);
      } catch (err) {
        setTier('Free Developer');
        console.error('Failed to fetch billing status', err);
      }
    };

    if (isUpgradeSuccess) setTier('Syncing...');
    fetchStatus(0);
  }, []);

  const handleUpgrade = async () => {
    setIsUpgrading(true);
    try {
      const { data } = await apiClient.post(API_ROUTES.BILLING.UPGRADE, { tier_id: 'pro_architect' });
      
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      }
    } catch (err) {
      useUIStore.getState().addToast('Failed to process upgrade.', 'error');
      setIsUpgrading(false);
    }
  };

  const handleDowngrade = async () => {
    setShowDowngradeModal(false); // ponytail: close modal before async starts
    
    setIsDowngrading(true);
    try {
      await apiClient.post(API_ROUTES.BILLING.DOWNGRADE);
      useUIStore.getState().addToast('Successfully downgraded to Free Developer.', 'success');
      
      const { data } = await apiClient.get(API_ROUTES.BILLING.STATUS);
      setTier(data.subscription_tier);
      useAuthStore.getState().setTier(data.subscription_tier);
      useAuthStore.getState().setIsActive(data.is_active);
    } catch (err) {
      useUIStore.getState().addToast('Failed to downgrade.', 'error');
    } finally {
      setIsDowngrading(false);
    }
  };

  const isPro = tier === 'Pro Architect' || tier === 'pro_architect';

  return (
    <div className="glass-card p-8 border-forge-border shadow-xl">
      <div className="flex items-center justify-between border-b border-forge-border/50 pb-6 mb-8">
        <div>
          <h3 className="text-lg font-bold text-forge-text tracking-tight">Subscription Plan</h3>
          <p className="text-sm text-forge-muted-text mt-1">Manage your billing, invoices, and tier upgrades.</p>
        </div>
        <div className="px-5 py-2 rounded-full bg-[#12121a] border border-forge-border text-xs font-bold text-forge-muted-text flex items-center gap-2 shadow-inner uppercase tracking-wider">
          Current Tier: <span className="text-white">{tier}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Free Tier */}
        <div className="bg-[#12121a] border border-forge-border rounded-xl p-8 relative shadow-inner">
          {!isPro && (
            <div className="absolute top-0 right-0 p-5">
               <span className="text-[10px] font-bold bg-zinc-800 text-zinc-300 px-2.5 py-1 rounded tracking-widest">ACTIVE</span>
            </div>
          )}
          <h4 className="text-xl font-bold text-white mb-2">Free Developer</h4>
          <p className="text-sm text-zinc-500 mb-8 max-w-[250px]">Perfect for testing concepts and small personal projects.</p>
          <div className="text-4xl font-bold text-white mb-8">$0 <span className="text-sm text-zinc-600 font-normal">/ month</span></div>
          
          <ul className="space-y-4 mb-8">
            {['100k LLM Tokens / mo', 'Local Sandbox Execution', 'Community Support'].map((feature, i) => (
              <li key={i} className="flex items-center gap-3 text-sm text-zinc-300">
                <CheckCircle2 size={18} className="text-zinc-600" />
                {feature}
              </li>
            ))}
          </ul>
          
          {isPro && (
            <Button 
              className="w-full py-3.5 text-sm bg-zinc-800 hover:bg-zinc-700 text-white"
              onClick={() => setShowDowngradeModal(true)}
              isLoading={isDowngrading}
            >
              Downgrade to Free
            </Button>
          )}
        </div>

        {/* Pro Tier */}
        <div className="bg-gradient-to-b from-forge-accent/10 to-transparent border border-forge-accent/30 rounded-xl p-8 shadow-[0_0_40px_rgba(168,85,247,0.1)] relative">
          {isPro && (
            <div className="absolute top-0 right-0 p-5">
               <span className="text-[10px] font-bold bg-forge-accent/20 text-forge-accent border border-forge-accent/30 px-2.5 py-1 rounded tracking-widest">ACTIVE</span>
            </div>
          )}
          <h4 className="text-xl font-bold text-forge-accent mb-2 flex items-center gap-2">
            <Zap size={20} className="fill-forge-accent" /> Pro Architect
          </h4>
          <p className="text-sm text-zinc-400 mb-8 max-w-[250px]">For serious professionals building production-ready applications.</p>
          <div className="text-4xl font-bold text-white mb-8">$49 <span className="text-sm text-zinc-500 font-normal">/ month</span></div>
          
          <ul className="space-y-4 mb-10">
            {['Unlimited LLM Tokens', 'Cloud Deployment Hooks (Vercel/Netlify)', 'GitHub Private Repo Integration', 'Priority Email Support'].map((feature, i) => (
              <li key={i} className="flex items-center gap-3 text-sm text-white font-medium">
                <CheckCircle2 size={18} className="text-forge-accent" />
                {feature}
              </li>
            ))}
          </ul>

          {!isPro && (
            <Button 
              className="w-full py-3.5 text-sm shadow-xl shadow-forge-accent/20"
              onClick={handleUpgrade}
              isLoading={isUpgrading}
            >
              Upgrade to Pro
            </Button>
          )}
        </div>
      </div>
      <ConfirmModal
        isOpen={showDowngradeModal}
        onClose={() => setShowDowngradeModal(false)}
        onConfirm={handleDowngrade}
        title="Downgrade Subscription"
        message="You will lose Cloud Deployment and GitHub integration immediately. Are you sure?"
        confirmText="Downgrade"
        isDanger={true}
        isLoading={isDowngrading}
      />
    </div>
  );
}

export default BillingTab;
