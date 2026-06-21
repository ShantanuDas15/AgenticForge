import { Handle, Position } from '@xyflow/react';
import { motion } from 'framer-motion';
import { Brain, Code, CheckCircle, AlertTriangle } from 'lucide-react';

/**
 * AgentNode — Custom React Flow node representing a LangGraph agent.
 * Animates and changes border ring based on real-time execution status.
 */

// Map the agent role to a specific Lucide icon
const roleIcons = {
  architect: Brain,
  engineer: Code,
  qa: CheckCircle,
};

function AgentNode({ data }) {
  const { label, role, status } = data;
  
  // Resolve the correct icon, fallback to AlertTriangle if unknown
  const Icon = roleIcons[role] || AlertTriangle;

  // Map the status to our Tailwind design system classes
  const ringClass = `agent-ring-${status}`;

  // Define subtle Framer Motion scale animations
  const nodeVariants = {
    idle: { scale: 1 },
    active: { scale: 1.05 },
    complete: { scale: 1 },
    error: { scale: 0.95 },
  };

  return (
    <motion.div
      variants={nodeVariants}
      initial="idle"
      animate={status}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className={`glass-card p-4 flex items-center gap-3 min-w-[200px] ${ringClass}`}
    >
      {/* Incoming edge connection point */}
      <Handle 
        type="target" 
        position={Position.Left} 
        className="w-2 h-2 !bg-forge-muted !border-none" 
      />
      
      {/* Icon container */}
      <div className="p-2 rounded-lg bg-forge-bg border border-forge-border">
        <Icon 
          size={20} 
          className={status === 'active' ? 'text-forge-accent' : 'text-forge-muted-text'} 
        />
      </div>
      
      {/* Node label and status text */}
      <div>
        <h3 className="text-sm font-bold text-forge-text">{label}</h3>
        <p className={`text-xs uppercase tracking-wider font-semibold mt-0.5 ${
          status === 'active' ? 'text-forge-accent' : 
          status === 'complete' ? 'text-forge-reviewer' : 
          status === 'error' ? 'text-forge-error' : 
          'text-forge-muted-text'
        }`}>
          {status}
        </p>
      </div>

      {/* Outgoing edge connection point */}
      <Handle 
        type="source" 
        position={Position.Right} 
        className="w-2 h-2 !bg-forge-muted !border-none" 
      />
    </motion.div>
  );
}

export default AgentNode;
