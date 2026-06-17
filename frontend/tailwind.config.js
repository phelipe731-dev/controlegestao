/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0f172a',
        mist: '#f1f5f9',
        sand: '#fef3e2',
        teal: '#0d9488',
        'teal-dark': '#0f766e',
        amber: '#d97706',
        rose: '#e11d48',
        sidebar: '#1e293b',
        'sidebar-hover': '#334155',
        'sidebar-active': '#0d9488',
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        body: ['"Work Sans"', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px 0 rgba(0,0,0,0.08), 0 1px 2px -1px rgba(0,0,0,0.06)',
        'card-md': '0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -2px rgba(0,0,0,0.05)',
        glow: '0 0 0 3px rgba(13,148,136,0.15)',
      },
    },
  },
  plugins: [],
}
