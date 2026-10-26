'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { Check, X, ExternalLink } from 'lucide-react';
import { EASE } from './motion';

type Toast = {
  id: number;
  kind: 'success' | 'error' | 'info';
  message: string;
  link?: { href: string; label: string };
};

const ToastCtx = createContext<{
  toast: (kind: Toast['kind'], message: string, link?: Toast['link']) => void;
}>({ toast: () => {} });

export const useToast = () => useContext(ToastCtx);

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);

  const toast = useCallback((kind: Toast['kind'], message: string, link?: Toast['link']) => {
    const id = nextId++;
    setItems((t) => [...t, { id, kind, message, link }]);
    setTimeout(() => setItems((t) => t.filter((i) => i.id !== id)), link ? 9000 : 4500);
  }, []);

  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed bottom-6 right-6 z-[100] flex w-[min(360px,calc(100vw-3rem))] flex-col gap-2">
        <AnimatePresence>
          {items.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, x: 40, filter: 'blur(4px)' }}
              animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, x: 24, transition: { duration: 0.25 } }}
              transition={{ duration: 0.45, ease: EASE }}
              className="pointer-events-auto flex items-start gap-3 rounded-lg border border-ink-600 bg-ink-900/95 px-4 py-3 shadow-[0_20px_60px_rgba(0,0,0,0.6)] backdrop-blur"
            >
              <span
                className={`mt-0.5 flex h-4 w-4 items-center justify-center rounded-full border ${
                  t.kind === 'success'
                    ? 'border-ink-50 bg-ink-50 text-ink-950'
                    : t.kind === 'error'
                      ? 'border-ink-400 text-ink-200'
                      : 'border-ink-500 text-ink-300'
                }`}
              >
                {t.kind === 'error' ? <X className="h-2.5 w-2.5" /> : <Check className="h-2.5 w-2.5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] leading-snug text-ink-100">{t.message}</p>
                {t.link && (
                  <a
                    href={t.link.href}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-micro text-ink-300 transition hover:text-ink-50"
                  >
                    {t.link.label} <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}
