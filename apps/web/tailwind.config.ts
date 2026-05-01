import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#F04E37',
          50: '#FEF2F0',
          100: '#FDE5E1',
          200: '#FACBC3',
          300: '#F7A99C',
          400: '#F47A69',
          500: '#F04E37',
          600: '#D93A24',
          700: '#B42E1C',
          800: '#8F2416',
          900: '#6A1B10',
        },
        accent: {
          DEFAULT: '#D93A24',
          light: '#F47A69',
          dark: '#B42E1C',
        },
        gold: {
          DEFAULT: '#E8A817',
          50: '#FEF9E7',
          100: '#FDF3CF',
          200: '#FBE79F',
          300: '#F9DB6F',
          400: '#F0C73F',
          500: '#E8A817',
          600: '#C48D12',
          700: '#A0720E',
          800: '#7C5709',
          900: '#583D05',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '1rem',       // 16px — all cards
        button: '0.75rem',  // 12px — buttons & inputs
        pill: '9999px',     // full — pills & badges
      },
      boxShadow: {
        card: '0 1px 3px 0 rgb(0 0 0 / 0.04), 0 1px 2px -1px rgb(0 0 0 / 0.04)',
        'card-hover': '0 10px 15px -3px rgb(0 0 0 / 0.08), 0 4px 6px -4px rgb(0 0 0 / 0.04)',
        sticky: '0 -4px 12px rgba(0, 0, 0, 0.05)',
      },
      spacing: {
        section: '3.5rem', // 56px — standard section padding
      },
    },
  },
  plugins: [],
};

export default config;
