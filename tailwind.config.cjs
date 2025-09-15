/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ["./index.html","./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      // default accent color
      colors: { brand: "#3898f8" },
    },
  },
  plugins: [],
};
