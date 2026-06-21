import { Loader2 } from 'lucide-react';

/**
 * Button — Design-system-aware button primitive.
 *
 * Props:
 *   variant     'primary' | 'ghost'  — visual style (default: 'primary')
 *   isLoading   boolean              — shows a spinner and disables the button
 *   children    ReactNode            — button label / content
 *   ...rest     standard <button> attributes (onClick, type, disabled, etc.)
 */
function Button({ variant = 'primary', isLoading = false, children, className = '', ...rest }) {
  const base = variant === 'ghost' ? 'btn-ghost' : 'btn-primary';

  return (
    <button
      className={`${base} inline-flex items-center gap-2 ${className}`}
      disabled={isLoading || rest.disabled}
      {...rest}
    >
      {isLoading && (
        <Loader2
          size={16}
          className="animate-spin shrink-0"
          aria-hidden="true"
        />
      )}
      {children}
    </button>
  );
}

export default Button;
