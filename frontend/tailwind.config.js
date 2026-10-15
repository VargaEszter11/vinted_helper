/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  // 'media' (the default) makes NativeWind throw on web in dev mode; the app has no dark theme.
  darkMode: 'class',
  theme: {
    extend: {},
  },
  plugins: [],
};
