import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          900: '#162032',
          700: '#1B5FE8'
        }
      }
    }
  },
  plugins: []
} satisfies Config;
