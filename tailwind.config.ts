import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#0A0416',
          900: '#120A26',
          850: '#180F33',
          800: '#201546',
          700: '#2E1F5E',
          600: '#3F2E7A',
          500: '#8C7FBD',
          400: '#A79BD1',
          300: '#C2B8E3',
          200: '#DAD3F0',
          100: '#ECE7FA',
          50: '#F8F6FE',
        },
        brand: {
          300: '#C4B5FD',
          400: '#A78BFA',
          500: '#8B5CF6',
          600: '#7C3AED',
          700: '#6D28D9',
        },
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      letterSpacing: {
        micro: '0.22em',
      },
      keyframes: {
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        pulseDot: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.35', transform: 'scale(0.75)' },
        },
        drift: {
          '0%': { transform: 'translate(0,0)' },
          '50%': { transform: 'translate(4%, -3%)' },
          '100%': { transform: 'translate(0,0)' },
        },
      },
      animation: {
        marquee: 'marquee 36s linear infinite',
        'marquee-fast': 'marquee 22s linear infinite',
        shimmer: 'shimmer 1.6s linear infinite',
        'pulse-dot': 'pulseDot 2.2s ease-in-out infinite',
        drift: 'drift 18s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
export default config;
