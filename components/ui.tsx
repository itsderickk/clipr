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
    sm: 'h-8 px-4 text-[13px]',
    md: 'h-10 px-5 text-[15px]',
    lg: 'h-12 px-7 text-base',
  };
  const variants = {
    primary:
      'bg-ink-50 text-ink-950 hover:bg-ink-200',
    ghost: 'bg-transparent text-ink-50 hover:bg-ink-50/10',
    outline:
      'border border-ink-600 bg-transparent text-ink-50 hover:bg-ink-50/10',
    danger:
      'border border-ink-600 bg-transparent text-ink-50 hover:border-red-500/60 hover:bg-red-500/10 hover:text-red-400',
  };
  return (
    <motion.button
      ref={ref}
      whileTap={{ scale: disabled || loading ? 1 : 0.97 }}
      className={`group/btn inline-flex select-none items-center justify-center gap-2 rounded-full font-bold transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-40 ${sizes[size]} ${variants[variant]} ${className}`}
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
    <span className={`text-[13px] font-medium text-ink-500 ${className}`}>
      {children}
    </span>
  );
}

/* ---------- status badge ---------- */

const badgeStyles: Record<string, string> = {
  ACTIVE: 'border-ink-600 text-ink-50',
  DRAFT: 'border-ink-700 text-ink-500',
  PAUSED: 'border-ink-700 text-ink-300',
  COMPLETED: 'border-ink-700 text-ink-500',
  PENDING: 'border-ink-700 text-ink-300',
  APPROVED: 'border-ink-600 text-ink-50',
  REJECTED: 'border-ink-700 text-ink-500',
  PAID: 'bg-ink-50 border-ink-50 text-ink-950',
};

export function Badge({ status, pulse }: { status: string; pulse?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${
        badgeStyles[status] || 'border-ink-600 text-ink-300'
      }`}
    >
      <span
        className={`h-1 w-1 rounded-full ${
          status === 'PAID' ? 'bg-ink-950' : status === 'ACTIVE' || status === 'APPROVED' ? 'bg-brand-400' : 'bg-current'
        } ${pulse ? 'animate-pulse-dot' : ''}`}
      />
      {status.toLowerCase()}
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
      className={`rounded-2xl border border-ink-700 bg-ink-950 ${
        hover ? 'transition-colors duration-200 hover:bg-ink-900' : ''
      } ${className}`}
    >
      {children}
    </motion.div>
  );
}

/* ---------- form fields ---------- */

export function Label({ children }: { children: ReactNode }) {
  return (
    <label className="mb-2 block text-[13px] font-medium text-ink-500">
      {children}
    </label>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className = '', ...rest }, ref) {
    return (
      <input
        ref={ref}
        className={`h-11 w-full rounded-md border border-ink-700 bg-ink-950 px-4 text-[15px] text-ink-50 outline-none transition-all duration-200 placeholder:text-ink-500 focus:border-ink-300 focus:ring-1 focus:ring-ink-300 ${className}`}
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
        className={`w-full rounded-md border border-ink-700 bg-ink-950 px-4 py-3 text-[15px] text-ink-50 outline-none transition-all duration-200 placeholder:text-ink-500 focus:border-ink-300 focus:ring-1 focus:ring-ink-300 ${className}`}
        {...rest}
      />
    );
  }
);

/* ---------- animated progress ---------- */

export function Progress({ value, className = '' }: { value: number; className?: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={`h-1 w-full overflow-hidden rounded-full bg-ink-800 ${className}`}>
      <motion.div
        className="h-full rounded-full bg-ink-50"
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
      className="inline-flex items-center gap-2 rounded-full border border-ink-700 bg-ink-950 px-3 py-1.5 font-mono text-xs text-ink-200 transition hover:bg-ink-900"
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
            className="absolute inset-0 bg-[rgba(91,112,131,0.4)]"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 32, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98, transition: { duration: 0.2 } }}
            transition={{ duration: 0.4, ease: EASE }}
            className={`relative w-full ${wide ? 'max-w-2xl' : 'max-w-md'} rounded-2xl bg-ink-950 p-6 shadow-[0_0_15px_rgba(255,255,255,0.12)]`}
          >
            <div className="mb-5 flex items-center justify-between">
              <h3 className="font-display text-xl font-bold text-ink-50">{title}</h3>
              <button
                onClick={onClose}
                className="rounded-full p-2 text-ink-50 transition hover:bg-ink-50/10"
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
