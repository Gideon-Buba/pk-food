/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  corePlugins: { preflight: false },
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#316752',
          dark: '#265442',
          darker: '#1a3830',
          light: '#c8dfd8',
          subtle: '#eef6f3',
          foreground: '#ffffff',
        },
        secondary: { DEFAULT: '#f3f4f6', foreground: '#1f2937' },
        muted: { DEFAULT: '#f9fafb', foreground: '#6b7280' },
        destructive: { DEFAULT: '#dc2626', foreground: '#ffffff' },
        border: '#e5e7eb',
        input: '#e5e7eb',
        ring: '#316752',
        background: '#ffffff',
        foreground: '#111827',
      },
      borderRadius: {
        lg: '10px',
        md: '8px',
        sm: '6px',
      },
      fontFamily: {
        ui: ['Glacial Indifference', 'Trebuchet MS', 'sans-serif'],
        heading: ['Cormorant Garamond', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
