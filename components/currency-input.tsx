'use client';

import { Input } from './ui';

/** Dollar amount input. The parent receives the raw dollar string. */
export function CurrencyInput({
  usd,
  onUsd,
  step = '0.01',
  placeholder = '0.00',
}: {
  usd: string;
  onUsd: (v: string) => void;
  step?: string;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono text-xs text-ink-400">$</span>
      <Input
        className="pl-9"
        type="number"
        min="0"
        step={step}
        placeholder={placeholder}
        value={usd}
        onChange={(e) => onUsd(e.target.value)}
      />
    </div>
  );
}
