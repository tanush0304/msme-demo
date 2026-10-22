/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#1B1D22',
        // Custom accent, renamed from `amber` so Tailwind's full amber-50..950
        // scale (status pills, warning banners) is generated again.
        'brand-amber': '#D98B2A',
        // Brand palette -- per-module via CSS variables set by ModuleThemeProvider
        // (theme/moduleTheme.js); fallbacks are the original neutral blues.
        brandblue: 'rgb(var(--brand-blue, 30 76 138) / <alpha-value>)', // primary Save / links
        brandnavy: 'rgb(var(--brand-navy, 15 42 82) / <alpha-value>)', // headings, section-header text
        brandsky: 'rgb(var(--brand-sky, 220 234 251) / <alpha-value>)', // section-header / Export pale fill
        brandslate: '#8B93A1', // Edit / Delete / Clear buttons
      },
    },
  },
  plugins: [],
}

