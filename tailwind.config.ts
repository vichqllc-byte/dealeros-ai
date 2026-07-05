import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        background: '#f7f6f2',
        foreground: '#28251d',
        primary: '#01696f',
        surface: '#f9f8f5',
        border: '#d4d1ca'
      }
    }
  },
  plugins: []
};

export default config;
