import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'glass';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', type = 'button', ...props }, ref) => {
    const variants: Record<NonNullable<ButtonProps['variant']>, string> = {
      primary:
        'bg-[#001E50] text-white hover:bg-[#00437A] active:scale-[0.99] shadow-xs border border-transparent',
      secondary:
        'bg-[#F1F5F9] text-[#091224] hover:bg-[#E2E8F0] active:scale-[0.99] border border-transparent',
      outline:
        'bg-white text-[#001E50] border border-[#CBD5E1] hover:border-[#001E50] hover:bg-[#F8FAFC] active:scale-[0.99]',
      ghost:
        'bg-transparent text-[#091224] hover:bg-[#F1F5F9] border border-transparent',
      glass:
        'bg-white/15 text-white backdrop-blur-md border border-white/30 hover:bg-white/25 active:scale-[0.99]',
    };

    const sizes: Record<NonNullable<ButtonProps['size']>, string> = {
      sm: 'h-9 px-4 text-xs font-medium',
      md: 'h-11 px-6 text-sm font-medium',
      lg: 'h-12 px-7 text-sm font-semibold',
    };

    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-lg transition-all duration-150 ease-out whitespace-nowrap shrink-0 cursor-pointer disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00437A] focus-visible:ring-offset-2',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-xl border border-[#E2E8F0] bg-white text-[#091224] transition-colors duration-200',
        className
      )}
      {...props}
    />
  )
);
Card.displayName = 'Card';

export const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn('block text-xs font-medium text-[#334155] mb-1.5', className)}
      {...props}
    />
  )
);
Label.displayName = 'Label';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'flex h-11 w-full rounded-lg border border-[#CBD5E1] bg-white px-3.5 py-2 text-sm text-[#091224] placeholder:text-[#94A3B8] transition-colors focus-visible:outline-none focus-visible:border-[#001E50] focus-visible:ring-2 focus-visible:ring-[#00437A]/15 disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
);
Input.displayName = 'Input';

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'flex h-11 w-full rounded-lg border border-[#CBD5E1] bg-white px-3.5 py-2 text-sm text-[#091224] transition-colors focus-visible:outline-none focus-visible:border-[#001E50] focus-visible:ring-2 focus-visible:ring-[#00437A]/15 disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
);
Select.displayName = 'Select';

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'flex min-h-[96px] w-full rounded-lg border border-[#CBD5E1] bg-white px-3.5 py-2.5 text-sm text-[#091224] placeholder:text-[#94A3B8] transition-colors focus-visible:outline-none focus-visible:border-[#001E50] focus-visible:ring-2 focus-visible:ring-[#00437A]/15 disabled:cursor-not-allowed disabled:opacity-50',
      className
    )}
    {...props}
  />
));
Textarea.displayName = 'Textarea';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  maxWidthClass?: string;
  children: React.ReactNode;
}

export function Dialog({
  open,
  onClose,
  title,
  subtitle,
  maxWidthClass = 'max-w-xl',
  children,
}: DialogProps) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dialog-title"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 bg-[#091224]/60 backdrop-blur-xs"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              'relative z-10 w-full max-h-[90vh] overflow-y-auto rounded-2xl border border-[#E2E8F0] bg-white shadow-2xl',
              maxWidthClass
            )}
          >
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[#E2E8F0] bg-white/95 px-6 py-5 backdrop-blur-md">
              <div>
                <h2 id="dialog-title" className="text-lg font-semibold tracking-tight text-[#091224]">
                  {title}
                </h2>
                {subtitle && <p className="mt-1 text-sm text-[#475569]">{subtitle}</p>}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close modal"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#E2E8F0] text-[#475569] transition-colors hover:bg-[#F8FAFC] hover:text-[#091224] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00437A] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-6">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

interface SheetProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export function Sheet({ open, onClose, children }: SheetProps) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Mobile menu">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-[#091224]/50 backdrop-blur-xs"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-y-0 right-0 w-full max-w-sm border-l border-[#E2E8F0] bg-white shadow-2xl flex flex-col"
          >
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
