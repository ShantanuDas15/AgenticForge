import { useState } from 'react';
import useFlowStore from '@/store/useFlowStore';
import Textarea from '@/components/common/Textarea';
import Button from '@/components/common/Button';

/**
 * HitlModal — Human-in-the-Loop Review Modal.
 * Interrupts the workspace view when the backend graph pauses, 
 * requiring the user to inject feedback before continuing.
 */
function HitlModal({ onSendResume }) {
  const interrupted = useFlowStore((state) => state.interrupted);
  const interruptState = useFlowStore((state) => state.interruptState);
  
  const [feedback, setFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Do not render if not interrupted
  if (!interrupted) return null;

  const handleContinue = async () => {
    setIsSubmitting(true);
    
    // Trigger the WebSocket resume event
    if (onSendResume) {
      await onSendResume(feedback);
    }
    
    // We intentionally use setState to clear the interrupt flag 
    // instead of resetCanvas() to preserve the existing React Flow graph and logs.
    useFlowStore.setState({ 
      interrupted: false, 
      interruptState: null,
      workflowStatus: 'running' 
    });
    
    setFeedback('');
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="glass-card w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden border-forge-accent/50">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-forge-border bg-forge-surface">
          <h2 className="text-xl font-bold text-forge-text flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-forge-reviewer animate-pulse"></span>
            Human-in-the-Loop Review
          </h2>
          <p className="text-sm text-forge-muted-text mt-1">
            The Coder has completed the draft. Review the output and provide optional instructions before the Reviewer agent takes over.
          </p>
        </div>

        {/* Code Preview Area */}
        <div className="p-6 overflow-y-auto flex-1 bg-forge-bg">
          <h3 className="text-xs font-bold tracking-wider uppercase text-forge-muted-text mb-2">
            Draft Output Preview
          </h3>
          <pre className="code-surface max-h-[300px] overflow-auto">
            <code>
              {interruptState?.current_code || '// No code output provided in state.'}
            </code>
          </pre>
        </div>

        {/* Feedback Input & Actions */}
        <div className="p-6 border-t border-forge-border bg-forge-surface space-y-4">
          <div>
            <label className="block text-xs font-bold tracking-wider uppercase text-forge-muted-text mb-2">
              Inject Feedback
            </label>
            <Textarea 
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="e.g., Please refactor the fetch call to use async/await..."
            />
          </div>
          
          <div className="flex justify-end pt-2">
            <Button onClick={handleContinue} isLoading={isSubmitting}>
              Approve & Continue Workflow
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
}

export default HitlModal;
