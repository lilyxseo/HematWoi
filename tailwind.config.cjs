/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: 'hsl(var(--brand-h) var(--brand-s) var(--brand-l))',
          foreground: 'var(--brand-foreground)',
          soft: 'var(--brand-soft)',
          ring: 'var(--brand-ring)'
        },
        success: 'var(--success)',
        warning: 'var(--warning)',
        danger: 'var(--danger)',
        info: 'var(--info)',
        bg: 'var(--bg)',
        'surface-1': 'var(--surface)',
        'surface-2': 'var(--surface-2)',
        border: 'var(--border)',
        text: 'var(--text)',
        muted: 'var(--text-muted)',
        ring: 'var(--ring)'
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
