/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: 'hsl(var(--color-primary) / <alpha-value>)',
          foreground: 'hsl(var(--color-primary-foreground) / <alpha-value>)',
          soft: 'hsl(var(--color-primary-soft) / <alpha-value>)',
          ring: 'hsl(var(--color-ring-primary) / <alpha-value>)',
        },
        primary: {
          DEFAULT: 'hsl(var(--color-primary) / <alpha-value>)',
          foreground: 'hsl(var(--color-primary-foreground) / <alpha-value>)',
          soft: 'hsl(var(--color-primary-soft) / <alpha-value>)',
        },
        success: 'hsl(var(--color-success) / <alpha-value>)',
        warning: 'hsl(var(--color-warning) / <alpha-value>)',
        danger: 'hsl(var(--color-danger) / <alpha-value>)',
        info: 'hsl(var(--color-info) / <alpha-value>)',
        bg: 'rgb(var(--color-bg) / <alpha-value>)',
        background: 'rgb(var(--color-bg) / <alpha-value>)',
        surface: {
          DEFAULT: 'rgb(var(--color-surface) / <alpha-value>)',
          alt: 'rgb(var(--color-surface-alt) / <alpha-value>)',
          elevated: 'rgb(var(--color-surface-elevated) / <alpha-value>)',
        },
        card: 'rgb(var(--color-surface) / <alpha-value>)',
        'surface-1': 'rgb(var(--color-surface) / <alpha-value>)',
        'surface-2': 'rgb(var(--color-surface-alt) / <alpha-value>)',
        border: 'rgb(var(--color-border-subtle) / <alpha-value>)',
        'border-subtle': 'rgb(var(--color-border-subtle) / <alpha-value>)',
        'border-strong': 'rgb(var(--color-border-strong) / <alpha-value>)',
        text: 'rgb(var(--color-text-primary) / <alpha-value>)',
        'text-primary': 'rgb(var(--color-text-primary) / <alpha-value>)',
        muted: 'rgb(var(--color-text-muted) / <alpha-value>)',
        'text-muted': 'rgb(var(--color-text-muted) / <alpha-value>)',
        'text-inverse': 'rgb(var(--color-text-inverse) / <alpha-value>)',
        foreground: 'rgb(var(--color-text-primary) / <alpha-value>)',
        'muted-foreground': 'rgb(var(--color-text-muted) / <alpha-value>)',
        ring: {
          DEFAULT: 'hsl(var(--color-ring-primary) / <alpha-value>)',
          primary: 'hsl(var(--color-ring-primary) / <alpha-value>)',
          danger: 'hsl(var(--color-ring-danger) / <alpha-value>)',
        },
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
