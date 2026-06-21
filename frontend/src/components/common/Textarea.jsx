import { useRef, useEffect } from 'react';

/**
 * Textarea — Auto-expanding textarea for prompt input.
 * Adheres to the AgenticForge design system.
 */
function Textarea({ value, onChange, placeholder = 'Type your prompt...', className = '', ...rest }) {
  const textareaRef = useRef(null);

  // Auto-expand logic
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto'; // Reset height
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`; // Set to scroll height, max 200px
    }
  }, [value]);

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={`
        w-full min-h-[44px] bg-forge-surface text-forge-text 
        border border-forge-border rounded-lg px-4 py-2 
        placeholder:text-forge-muted-text focus:outline-none 
        focus:ring-2 focus:ring-forge-accent resize-none
        transition-shadow duration-200
        ${className}
      `}
      rows={1}
      {...rest}
    />
  );
}

export default Textarea;
