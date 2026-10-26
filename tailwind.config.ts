import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          // X-style neutrals: true black canvas, cool grays, soft white text
          950: '#000000',
          900: '#0A0A0B',
          850: '#101113',
          800: '#16181C',
          700: '#2F3336',
          600: '#3E4246',
          500: '#71767B',
          400: '#8B9096',
          300: '#AAB0B6',
          200: '#CDD1D5',
          100: '#DFE2E5',
          50: '#E7E9EA',
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
        display: ['Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
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
        glow: {
          '0%, 100%': { opacity: '0.75', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.08)' },
        },
        sheen: {
          '0%': { backgroundPosition: '0% center' },
          '100%': { backgroundPosition: '200% center' },
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
        'marquee-slow': 'marquee 80s linear infinite',
        shimmer: 'shimmer 1.6s linear infinite',
        'pulse-dot': 'pulseDot 2.2s ease-in-out infinite',
        drift: 'drift 18s ease-in-out infinite',
        glow: 'glow 8s ease-in-out infinite',
        sheen: 'sheen 6s linear infinite',
      },
    },
  },
  plugins: [],
};
export default config;
