/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Paleta "workshop-friendly": alto contraste para leerse bajo sol
        // directo o en ambiente con polvo. Tres familias industriales.

        // Madera — fondos cálidos y bordes (tono taller de carpintería).
        madera: {
          50: '#faf6f0',
          100: '#f2e8da',
          200: '#e4cfae',
          300: '#d3b07f',
          400: '#c08f54',
          500: '#a9733b',
          600: '#8a5a2e',
          700: '#6e4727',
          800: '#523524',
          900: '#3a2619',
        },
        // Naranja "taller" — acción primaria, urgencias, CTA. Muy visible.
        taller: {
          50: '#fff5ed',
          100: '#ffe6d4',
          200: '#ffc8a8',
          300: '#ffa170',
          400: '#fd7235',
          500: '#f25410', // primario
          600: '#e23d06',
          700: '#bb2c08',
          800: '#94250f',
          900: '#782210',
        },
        // Azul "acero" — encabezados, estados confirmados, estructura.
        acero: {
          50: '#eef4fb',
          100: '#d7e5f4',
          200: '#b3cde9',
          300: '#82acd9',
          400: '#4f86c6',
          500: '#2f68ad',
          600: '#234f8c',
          700: '#1e3a5f', // primario oscuro / barra superior
          800: '#1a3050',
          900: '#162640',
        },
      },
      fontFamily: {
        sans: ['system-ui', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        // Sombra marcada para que las tarjetas se despeguen bajo mucha luz.
        card: '0 2px 0 0 rgba(0,0,0,0.06), 0 6px 16px -6px rgba(0,0,0,0.25)',
      },
      borderRadius: {
        xl: '0.9rem',
      },
    },
  },
  plugins: [],
};
