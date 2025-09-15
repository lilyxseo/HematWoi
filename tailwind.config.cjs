/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#3898f8',
          300: '#50b6ff',
          500: '#3898f8',
          600: '#2584e4',
        },
        success: '#22c55e',
        danger: '#ef4444',
        surface: {
          1: '#ffffff',
          2: '#f1f5f9',
        },
        text: '#0f172a',
        muted: '#94a3b8',
      },
      fontSize: {
        h1: ['clamp(2rem,5vw,2.5rem)', { lineHeight: '1.2' }],
        h2: ['clamp(1.5rem,4vw,2rem)', { lineHeight: '1.3' }],
        h3: ['clamp(1.25rem,3vw,1.5rem)', { lineHeight: '1.4' }],
        h4: ['clamp(1.125rem,2vw,1.25rem)', { lineHeight: '1.4' }],
        h5: ['clamp(1rem,1.5vw,1.125rem)', { lineHeight: '1.4' }],
        h6: ['1rem', { lineHeight: '1.5' }],
      },
      spacing: {
        18: '4.5rem',
      },
      borderRadius: {
        DEFAULT: '0.5rem',
        md: '0.375rem',
        sm: '0.25rem',
      },
      boxShadow: {
        sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        md: '0 2px 4px -2px rgb(0 0 0 / 0.05), 0 4px 6px -1px rgb(0 0 0 / 0.05)',
        lg: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
    require('@tailwindcss/line-clamp'),
    require('@tailwindcss/aspect-ratio'),
    require('@tailwindcss/container-queries'),
  ],
};
