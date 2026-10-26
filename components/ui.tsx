'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { forwardRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { ArrowUpRight, Check, Copy, Loader2, X } from 'lucide-react';
import { EASE } from './motion';
import { shortAddr } from '@/lib/format';

/* ---------- buttons ---------- */

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'outline' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  arrow?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button(
  { variant = 'primary', size = 'md', loading, arrow, className = '', children, disabled, ...rest },
  ref
) {
  const sizes = {
    sm: 'h-8 px-3 text-[11px]',
    md: 'h-10 px-5 text-xs',
    lg: 'h-12 px-7 text-sm',
  };
  const variants = {
    primary:
      'bg-brand-500 text-white hover:bg-brand-400 hover:shadow-[0_0_32px_rgba(92,124,255,0.4)]',
    ghost: 'bg-transparent text-ink-200 hover:bg-ink-800 hover:text-ink-50',
    outline:
      'border border-ink-600 bg-transparent text-ink-100 hover:border-ink-300 hover:bg-ink-800/60',
    danger:
      'border border-ink-600 bg-transparent text-ink-300 hover:border-ink-300 hover:text-ink-50 hover:bg-ink-800/60',
  };
  return (
    <motion.button
      ref={ref}
      whileTap={{ scale: disabled || loading ? 1 : 0.97 }}
      className={`group/btn inline-flex select-none items-center justify-center gap-2 rounded-lg font-mono uppercase tracking-[0.12em] transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-40 ${sizes[size]} ${variants[variant]} ${className}`}
      disabled={disabled || loading}
      {...(rest as any)}
    >
      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {children}
      {arrow && !loading && (
        <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5" />
      )}
    </motion.button>
  );
});

/* ---------- micro label ---------- */

export function Micro({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span className={`font-mono text-[10px] uppercase tracking-micro text-ink-400 ${className}`}>
      {children}
    </span>
  );
}

/* ---------- status badge ---------- */

const badgeStyles: Record<string, string> = {
  ACTIVE: 'border-brand-400 text-brand-300',
  DRAFT: 'border-ink-600 text-ink-400',
  PAUSED: 'border-ink-600 text-ink-300',
  COMPLETED: 'border-ink-600 text-ink-400',
  PENDING: 'border-ink-600 text-ink-300',
  APPROVED: 'border-brand-400 text-brand-300',
  REJECTED: 'border-ink-700 text-ink-500',
  PAID: 'bg-brand-500 border-brand-500 text-white',
};

export function Badge({ status, pulse }: { status: string; pulse?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] ${
        badgeStyles[status] || 'border-ink-600 text-ink-300'
      }`}
    >
      <span
        className={`h-1 w-1 rounded-full ${
          status === 'PAID' ? 'bg-white' : 'bg-current'
        } ${pulse ? 'animate-pulse-dot' : ''}`}
      />
      {status}
    </span>
  );
}

/* ---------- card ---------- */

export function Card({
  children,
  className = '',
  hover = true,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return (
    <motion.div
      whileHover={hover ? { y: -3 } : undefined}
      transition={{ duration: 0.25, ease: EASE }}
      className={`rounded-xl border border-ink-700 bg-gradient-to-b from-ink-850 to-ink-900 ${
        hover ? 'transition-colors duration-300 hover:border-ink-500' : ''
      } ${className}`}
    >
      {children}
    </motion.div>
  );
}

/* ---------- form fields ---------- */

export function Label({ children }: { children: ReactNode }) {
  return (
    <label className="mb-2 block font-mono text-[10px] uppercase tracking-micro text-ink-300">
      {children}
    </label>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className = '', ...rest }, ref) {
    return (
      <input
        ref={ref}
        className={`h-11 w-full rounded-lg border border-ink-600 bg-ink-900 px-4 text-sm text-ink-50 outline-none transition-all duration-200 placeholder:text-ink-500 focus:border-ink-300 focus:shadow-[0_0_0_3px_rgba(237,237,237,0.06)] ${className}`}
        {...rest}
      />
    );
  }
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className = '', ...rest }, ref) {
    return (
      <textarea
        ref={ref}
        className={`w-full rounded-lg border border-ink-600 bg-ink-900 px-4 py-3 text-sm text-ink-50 outline-none transition-all duration-200 placeholder:text-ink-500 focus:border-ink-300 focus:shadow-[0_0_0_3px_rgba(237,237,237,0.06)] ${className}`}
        {...rest}
      />
    );
  }
);

/* ---------- animated progress ---------- */

export function Progress({ value, className = '' }: { value: number; className?: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={`h-1 w-full overflow-hidden rounded-full bg-ink-700 ${className}`}>
      <motion.div
        className="h-full rounded-full bg-brand-400"
        initial={{ width: 0 }}
        whileInView={{ width: `${pct}%` }}
        viewport={{ once: true }}
        transition={{ duration: 1, ease: EASE }}
      />
    </div>
  );
}

/* ---------- skeleton ---------- */

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`shimmer rounded-lg ${className}`} />;
}

/* ---------- copy chip ---------- */

export function CopyChip({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(value).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      }}
      className="inline-flex items-center gap-2 rounded-md border border-ink-600 bg-ink-900 px-2.5 py-1.5 font-mono text-[11px] text-ink-200 transition hover:border-ink-400"
      title={value}
    >
      {label || shortAddr(value)}
      {copied ? <Check className="h-3 w-3 text-ink-50" /> : <Copy className="h-3 w-3 text-ink-400" />}
    </button>
  );
}

/* ---------- modal ---------- */

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-end justify-center p-4 sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="absolute inset-0 bg-ink-950/85 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 32, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98, transition: { duration: 0.2 } }}
            transition={{ duration: 0.4, ease: EASE }}
            className={`relative w-full ${wide ? 'max-w-2xl' : 'max-w-md'} rounded-2xl border border-ink-600 bg-ink-900 p-6 shadow-[0_40px_120px_rgba(0,0,0,0.7)]`}
          >
            <div className="mb-5 flex items-center justify-between">
              <h3 className="font-display text-lg font-medium text-ink-50">{title}</h3>
              <button
                onClick={onClose}
                className="rounded-md p-1.5 text-ink-400 transition hover:bg-ink-800 hover:text-ink-50"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
