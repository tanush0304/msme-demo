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
        // Brand palette -- sampled from the client's reference Customer Master screen
        brandblue: '#1E4C8A', // Save button / header gradient light stop / links
        brandnavy: '#0F2A52', // header gradient dark stop, footer bar, headings
        brandsky: '#DCEAFB', // section-header / Export button pale blue fill
        brandslate: '#8B93A1', // Edit / Delete / Clear buttons
      },
    },
  },
  plugins: [],
}

