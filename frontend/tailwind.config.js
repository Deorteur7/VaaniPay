/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        paytm: {
          blue:      '#00BAF2',
          dark:      '#0066CC',
          navy:      '#1A1A2E',
          bg:        '#F5F6FA',
          muted:     '#9EA3B0',
          border:    '#E8ECF0',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '16px',
        '3xl': '24px',
      },
      boxShadow: {
        card: '0 2px 12px rgba(0,0,0,0.06)',
        blue: '0 4px 20px rgba(0,186,242,0.35)',
      },
    },
  },
  plugins: [],
};
