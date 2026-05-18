import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  darkMode: ['class', '[data-mode="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: {
          base: 'var(--bg-base)',
          surface: 'var(--bg-surface)',
          elevated: 'var(--bg-elevated)',
          sunken: 'var(--bg-sunken)',
          hover: 'var(--bg-hover)',
          selected: 'var(--bg-selected)',
          disabled: 'var(--bg-disabled)',
        },
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          tertiary: 'var(--text-tertiary)',
          disabled: 'var(--text-disabled)',
          'on-brand': 'var(--text-on-brand)',
          'on-amber': 'var(--text-on-amber)',
          'on-dark': 'var(--text-on-dark)',
        },
        brand: {
          ui: 'var(--brand-ui)',
          text: 'var(--brand-text)',
          hover: 'var(--brand-hover)',
          secondary: 'var(--brand-secondary)',
          subtle: 'var(--brand-subtle)',
          'subtle-text': 'var(--brand-subtle-text)',
        },
        'toggle-on': 'var(--toggle-on)',
        'toggle-on-hover': 'var(--toggle-on-hover)',
        'toggle-on-subtle': 'var(--toggle-on-subtle)',
        success: {
          DEFAULT: 'var(--success)',
          bg: 'var(--success-bg)',
        },
        warning: {
          DEFAULT: 'var(--warning)',
          bg: 'var(--warning-bg)',
        },
        error: {
          DEFAULT: 'var(--error)',
          bg: 'var(--error-bg)',
        },
        info: {
          DEFAULT: 'var(--info)',
          bg: 'var(--info-bg)',
        },
        border: {
          subtle: 'var(--border-subtle)',
          default: 'var(--border-default)',
          interactive: 'var(--border-interactive)',
          strong: 'var(--border-strong)',
          brand: 'var(--border-brand)',
          focus: 'var(--border-focus)',
        },
        hl: {
          amber: 'var(--hl-amber)',
          'amber-t': 'var(--hl-amber-t)',
          auburn: 'var(--hl-auburn)',
          'auburn-t': 'var(--hl-auburn-t)',
          yellow: 'var(--hl-yellow)',
          'yellow-t': 'var(--hl-yellow-t)',
          sage: 'var(--hl-sage)',
          'sage-t': 'var(--hl-sage-t)',
          cobalt: 'var(--hl-cobalt)',
          'cobalt-t': 'var(--hl-cobalt-t)',
          crimson: 'var(--hl-crimson)',
          'crimson-t': 'var(--hl-crimson-t)',
          purple: 'var(--hl-purple)',
          'purple-t': 'var(--hl-purple-t)',
        },
      },
      fontFamily: {
        fraunces: ['var(--font-fraunces)', 'Georgia', 'serif'],
        'source-serif-4': ['var(--font-source-serif-4)', 'Georgia', 'serif'],
        'dm-sans': ['var(--font-dm-sans)', 'system-ui', 'sans-serif'],
        'dm-mono': ['var(--font-dm-mono)', 'monospace'],
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
      },
      borderRadius: {
        sm: '0.25rem',
        DEFAULT: '0.5rem',
        md: '0.5rem',
        lg: '0.75rem',
        xl: '1rem',
        '2xl': '1.5rem',
      },
      maxWidth: {
        page: '1160px',
        prose: '720px',
      },
    },
  },
  plugins: [],
}

export default config
