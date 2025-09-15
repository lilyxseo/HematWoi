/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ["./index.html","./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      // default accent color palette used across the app
      colors: {
        brand: "#3898f8",
        "brand-hover": "#2584e4",
        "brand-secondary": "#50b6ff",
        "brand-secondary-hover": "#379de7",
        "brand-text": "#13436d",
        // keep legacy name to avoid breaking existing classes
        "brand-var": "#3898f8",
      },
    },
  },
  plugins: [],
};
