import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'dc-bg': '#0a0a0f',
        'dc-surface': '#12121a',
        'dc-border': '#1e1e2e',
        'dc-gold': '#c9a84c',
        'dc-gold-light': '#f0d080',
        'dc-red': '#8b1a1a',
        'dc-red-light': '#e05252',
        'dc-green': '#1a4a2e',
        'dc-green-light': '#4ade80',
        'dc-blue': '#1a2a4a',
        'dc-purple': '#2a1a4a',
        'dc-text': '#e2e0d4',
        'dc-muted': '#6b6b7b',
      },
      fontFamily: {
        'fantasy': ['Georgia', 'Palatino', 'serif'],
      },
      backgroundImage: {
        'dc-gradient': 'linear-gradient(135deg, #0a0a0f 0%, #12121a 50%, #0f0a1a 100%)',
        'gold-gradient': 'linear-gradient(135deg, #c9a84c 0%, #f0d080 50%, #c9a84c 100%)',
      },
      boxShadow: {
        'gold': '0 0 20px rgba(201, 168, 76, 0.3)',
        'card': '0 4px 24px rgba(0,0,0,0.5)',
      },
    },
  },
  plugins: [],
}

export default config
