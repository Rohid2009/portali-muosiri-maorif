import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#0b4f8a', dark: '#0a3d6b', light: '#e7f0fa', sky: '#8cc0ee' },
        gold: { DEFAULT: '#e9a822', light: '#fff6e0' },
        page: '#f4f7fb',
        ink: '#0f1b2d',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        script: ['var(--font-script)', 'cursive'],
      },
      boxShadow: {
        soft: '0 1px 2px rgba(15,27,45,.05), 0 4px 16px rgba(15,27,45,.06)',
      },
    },
  },
  plugins: [],
};

export default config;
