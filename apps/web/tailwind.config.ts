import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        stellar: {
          dark: '#070913',
          card: '#0D1127',
          border: '#1F294D',
          hover: '#182040',
          cyan: '#00E5FF',
          emerald: '#00F5A0',
          violet: '#8A2BE2',
          accent: '#3B82F6',
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'stream-glow': 'radial-gradient(circle at 50% 0%, rgba(0, 229, 255, 0.15) 0%, transparent 70%)',
      },
      animation: {
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'stream-flow': 'flow 2s linear infinite',
      },
      keyframes: {
        flow: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
