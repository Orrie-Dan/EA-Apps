/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ground:   '#FBFAF7',
        surface:  '#FFFFFF',
        hairline: '#E4E1DA',
        ink:      '#12100E',
        inkMuted: '#6E6A63',
        onDark:   '#F4F2ED',
        brand:    '#009DD9',
      },
      fontFamily: {
        display: ['Archivo', 'system-ui', 'sans-serif'],
        sans:    ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: { card: '2px' },
      transitionTimingFunction: {
        portal: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
}
