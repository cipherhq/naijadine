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
    },
  },
  plugins: [],
};

export default config;
