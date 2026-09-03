import type { Config } from 'tailwindcss';

/**
 * FileTools Design Tokens
 * Dark-only, near-black palette with subtle hairlines and emerald accent.
 */
const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        surface: {
          DEFAULT: 'var(--surface)',
          raised: 'var(--surface-raised)',
        },
        muted: {
          DEFAULT: 'var(--surface)',
          foreground: 'var(--muted-foreground)',
        },
        border: {
          DEFAULT: 'var(--border)',
          strong: 'var(--border-strong)',
        },
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)',
        },
        accent: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)',
          subtle: 'var(--accent-subtle)',
        },
        destructive: {
          DEFAULT: 'var(--destructive)',
          foreground: 'var(--foreground)',
        },
      },
      fontFamily: {
        sans: ['var(--font-ui)', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-code)', 'JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        sm: '3px',
        md: '5px',
        lg: '6px',
        xl: '8px',
      },
    },
  },
  plugins: [],
};

export default config;
