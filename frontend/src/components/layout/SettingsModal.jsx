import { useState } from 'react';
import { X, Settings2, Key, Cpu, Wifi } from 'lucide-react';
import useSettingsStore from '@/store/useSettingsStore';
import useUIStore from '@/store/useUIStore';
import Button from '@/components/common/Button';
import apiClient from '@/services/apiClient';
import { z } from 'zod';
import { API_ROUTES } from '@/config/constants';

const settingsSchema = z.object({
  llmProvider: z.enum(['groq', 'openai', 'anthropic'], {
    errorMap: () => ({ message: 'Invalid Intelligence Engine selected.' })
  }),
  apiKey: z.string().optional()
});

// Inline Github icon definition since it's not exported by the installed lucide-react version
const GithubIcon = ({ size = 18, className = "" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
);

/**
 * SettingsModal — Provides a UI for users to swap LLM providers 
 * and enter Bring-Your-Own-Key credentials.
 */
function SettingsModal() {
  const { isSettingsOpen, closeSettings, llmProvider, setLlmProvider, apiKey, setApiKey, hasGithubToken, isSaving } = useSettingsStore();
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const handleTest = async () => {
    const validation = settingsSchema.safeParse({ llmProvider, apiKey });
    if (!validation.success) {
      useUIStore.getState().addToast(validation.error.issues[0].message, 'error');
      return;
    }

    setIsTesting(true);
    setTestResult(null);
    try {
      const { data } = await apiClient.post(API_ROUTES.LLM_TEST, {
        provider: llmProvider,
        api_key: apiKey === '••••••••••••••••' ? undefined : apiKey
      });
      setTestResult('success');
      useUIStore.getState().addToast(`Connection successful! LLM says: ${data.response}`, 'success');
    } catch (error) {
      setTestResult('error');
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    const validation = settingsSchema.safeParse({ llmProvider, apiKey });
    if (!validation.success) {
      useUIStore.getState().addToast(validation.error.issues[0].message, 'error');
      return;
    }

    try {
      await useSettingsStore.getState().saveSettings();
      useUIStore.getState().addToast('Configuration saved!', 'success');
      closeSettings();
    } catch (error) {
      useUIStore.getState().addToast('Failed to save settings.', 'error');
    }
  };

  const getApiKeyPlaceholder = () => {
    switch (llmProvider) {
      case 'groq': return 'gsk_... (Groq API Key)';
      case 'anthropic': return 'sk-ant-api03-... (Anthropic API Key)';
      case 'openai': return 'sk-... (OpenAI API Key)';
      default: return 'sk-... (Optional if backend provisioned)';
    }
  };

  if (!isSettingsOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-auto">
      {/* Frosted Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={closeSettings}
      />
      
      {/* Modal Surface */}
      <div className="glass-card relative z-10 w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2 text-forge-text">
            <Settings2 size={22} className="text-forge-accent" />
            <h2 className="text-xl font-bold tracking-tight">Workspace Settings</h2>
          </div>
          <button 
            onClick={closeSettings}
            className="text-forge-muted-text hover:text-white bg-forge-surface/50 hover:bg-forge-surface p-1.5 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Configuration Forms */}
        <div className="space-y-5">
          <div className="space-y-2">
            <label className="text-xs font-bold text-forge-muted-text uppercase tracking-wider flex items-center gap-2">
              <Cpu size={14} /> Intelligence Engine
            </label>
            <select 
              value={llmProvider}
              onChange={(e) => setLlmProvider(e.target.value)}
              className="w-full bg-[#12121a] border border-forge-border rounded-lg py-3 px-3 text-forge-text focus:outline-none focus:border-forge-accent focus:ring-1 focus:ring-forge-accent transition-all cursor-pointer shadow-inner appearance-none"
            >
              <option value="groq">Groq (Llama-3 70B)</option>
              <option value="openai">OpenAI (GPT-4o)</option>
              <option value="anthropic">Anthropic (Claude 3.5 Sonnet)</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-forge-muted-text uppercase tracking-wider flex items-center gap-2">
              <Key size={14} /> Provider API Key <span className="normal-case opacity-60 ml-auto font-normal">Bring Your Own Key</span>
            </label>
            <input 
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={getApiKeyPlaceholder()}
              className="w-full bg-[#12121a] border border-forge-border rounded-lg py-3 px-3 text-forge-text focus:outline-none focus:border-forge-accent focus:ring-1 focus:ring-forge-accent transition-all placeholder-zinc-600 font-mono text-sm tracking-wide shadow-inner"
            />
            <p className="text-xs text-zinc-500 mt-2 leading-relaxed">
              Your key is transmitted securely and encrypted at rest in our cloud database to enable multi-agent execution.
            </p>
            <div className="flex items-center gap-3 mt-3">
              <Button 
                onClick={handleTest} 
                isLoading={isTesting}
                className="flex-1 py-2 bg-forge-surface/40 hover:bg-forge-surface border border-forge-border flex items-center justify-center gap-2 text-sm shadow-inner text-forge-accent"
              >
                <Wifi size={16} />
                Test Connection
              </Button>
              {testResult === 'success' && <span className="text-emerald-400 shrink-0 px-2">✅</span>}
              {testResult === 'error' && <span className="text-red-400 shrink-0 px-2">❌</span>}
            </div>
          </div>

          <div className="space-y-3 pt-4 border-t border-forge-border/50">
            <label className="text-xs font-bold text-forge-muted-text uppercase tracking-wider flex items-center gap-2">
              <GithubIcon size={14} /> Source Control
            </label>
            <button
              disabled={hasGithubToken}
              onClick={async () => {
                try {
                  const { data } = await apiClient.get(API_ROUTES.GIT.GITHUB_LOGIN);
                  window.location.href = data.url;
                } catch (err) {
                  useUIStore.getState().addToast('Failed to initiate GitHub connect', 'error');
                }
              }}
              className={`w-full flex items-center justify-center gap-2 border border-forge-border rounded-lg py-3 px-3 text-forge-text font-medium transition-all shadow-inner ${
                hasGithubToken ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' : 'bg-[#12121a] hover:bg-[#1a1a24]'
              }`}
            >
              <GithubIcon size={18} />
              {hasGithubToken ? 'GitHub Connected' : 'Connect GitHub Account'}
            </button>
          </div>
        </div>

        <div className="mt-8 flex justify-end">
          <Button onClick={handleSave} isLoading={isSaving} className="px-6 py-2.5 shadow-lg shadow-forge-accent/20">
            Save Configuration
          </Button>
        </div>
      </div>
    </div>
  );
}

export default SettingsModal;
