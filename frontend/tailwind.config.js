/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#102127',
        mist: '#eff4f2',
        sand: '#f4ebe3',
        teal: '#0f766e',
        amber: '#c8843a',
        rose: '#a64a52',
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        body: ['"Work Sans"', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 24px 60px -24px rgba(14, 43, 48, 0.45)',
      },
      backgroundImage: {
        'campaign-grid':
          'radial-gradient(circle at top right, rgba(200,132,58,0.16), transparent 35%), radial-gradient(circle at 15% 20%, rgba(15,118,110,0.12), transparent 40%)',
      },
    },
  },
  plugins: [],
}
